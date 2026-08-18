import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { ORG_ID } from '@/lib/orgContext';
import type { AdminReconciliationFindingRow, ReconciliationResolutionStatus } from '@/types/admin';

export interface ReconciliationFilters {
  fromDate: string;
  toDate: string;
  resolutionStatus?: ReconciliationResolutionStatus;
  mismatchType?: string;
}

/**
 * Employee/resolver names are resolved via a separate batch lookup (same
 * pattern as useAuditLogs/useAdminNotifications) rather than a PostgREST
 * embed -- two differently-aliased embeds into the same `employees` table
 * (employee_id and resolved_by both -> employees) defeats supabase-js's
 * select-string type inference, and this is the already-proven fix for
 * that class of problem elsewhere in this codebase.
 */
export function useReconciliationFindings(filters: ReconciliationFilters) {
  return useQuery({
    queryKey: ['admin-reconciliation-findings', filters],
    enabled: Boolean(filters.fromDate && filters.toDate),
    queryFn: async (): Promise<AdminReconciliationFindingRow[]> => {
      let query = supabase
        .from('attendance_reconciliation_findings')
        .select('id, employee_id, finding_date, mismatch_type, biometric_status, hr_status, expected_status, resolution_status, resolved_by, resolved_at, remarks, created_at')
        .eq('organization_id', ORG_ID)
        .gte('finding_date', filters.fromDate)
        .lte('finding_date', filters.toDate)
        .order('finding_date', { ascending: false });
      if (filters.resolutionStatus) query = query.eq('resolution_status', filters.resolutionStatus);
      if (filters.mismatchType) query = query.eq('mismatch_type', filters.mismatchType);

      const { data, error } = await query;
      if (error) throw error;
      const rows = data ?? [];

      const employeeIds = Array.from(new Set([...rows.map((r) => r.employee_id), ...rows.map((r) => r.resolved_by).filter((id): id is string => Boolean(id))]));
      const employeeById = new Map<string, { name: string; code: string }>();
      if (employeeIds.length > 0) {
        const { data: employees, error: employeesError } = await supabase
          .from('employees')
          .select('id, first_name, last_name, employee_code')
          .in('id', employeeIds);
        if (employeesError) throw employeesError;
        for (const e of employees ?? []) {
          employeeById.set(e.id, { name: [e.first_name, e.last_name].filter(Boolean).join(' '), code: e.employee_code });
        }
      }

      return rows.map((r) => ({
        id: r.id,
        employeeId: r.employee_id,
        employeeName: employeeById.get(r.employee_id)?.name ?? '-',
        employeeCode: employeeById.get(r.employee_id)?.code ?? '-',
        findingDate: r.finding_date,
        mismatchType: r.mismatch_type,
        biometricStatus: r.biometric_status,
        hrStatus: r.hr_status,
        expectedStatus: r.expected_status,
        resolutionStatus: r.resolution_status,
        resolvedByName: r.resolved_by ? (employeeById.get(r.resolved_by)?.name ?? '-') : null,
        resolvedAt: r.resolved_at,
        remarks: r.remarks,
        createdAt: r.created_at,
      }));
    },
  });
}

/** Scans the given date range and upserts findings -- safe to re-run, an already-resolved finding is not reset to 'open' (see run_attendance_reconciliation()'s comment). */
export function useRunReconciliation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ fromDate, toDate }: { fromDate: string; toDate: string }) => {
      const { data, error } = await supabase.rpc('run_attendance_reconciliation', { _from_date: fromDate, _to_date: toDate });
      if (error) throw error;
      return data as number;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-reconciliation-findings'] }),
  });
}

/**
 * A plain RLS-gated UPDATE (not an RPC) -- the generic audit trigger
 * (0048, now covering attendance_reconciliation_findings) records every one
 * of these automatically, satisfying "every manual resolution must
 * generate an audit record" without a bespoke audit-insert call here.
 */
export function useResolveReconciliationFinding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      resolutionStatus,
      remarks,
      resolvedByEmployeeId,
    }: {
      id: string;
      resolutionStatus: 'resolved' | 'accepted' | 'overridden';
      remarks: string;
      resolvedByEmployeeId: string;
    }) => {
      const { error } = await supabase
        .from('attendance_reconciliation_findings')
        .update({ resolution_status: resolutionStatus, remarks, resolved_by: resolvedByEmployeeId, resolved_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-reconciliation-findings'] }),
  });
}
