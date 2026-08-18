import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { ORG_ID } from '@/lib/orgContext';
import type { AdminAuditLogRow } from '@/types/admin';

export interface AuditLogFilters {
  module?: string;
  action?: string;
  dateFrom?: string;
  dateTo?: string;
}

/**
 * audit_logs has never been queried from the frontend before this page —
 * actor_user_id only references auth.users, with no FK to employees, so the
 * display name is resolved via a separate batch lookup (same pattern as
 * Notifications' recipient-name resolution) rather than a PostgREST embed.
 * Capped at 500 rows: an append-only table with no server-side pagination
 * UI built this session — a pragmatic MVP limit, not a hard cap.
 */
export function useAuditLogs(filters: AuditLogFilters) {
  return useQuery({
    queryKey: ['admin-audit-logs', filters],
    queryFn: async (): Promise<AdminAuditLogRow[]> => {
      let query = supabase
        .from('audit_logs')
        .select('id, actor_user_id, actor_role, employee_id, action, module, record_id, old_value, new_value, ip_address, result, created_at')
        .eq('organization_id', ORG_ID)
        .order('created_at', { ascending: false })
        .limit(500);
      if (filters.module) query = query.eq('module', filters.module);
      if (filters.action) query = query.eq('action', filters.action);
      if (filters.dateFrom) query = query.gte('created_at', `${filters.dateFrom}T00:00:00`);
      if (filters.dateTo) query = query.lte('created_at', `${filters.dateTo}T23:59:59`);
      const { data, error } = await query;
      if (error) throw error;
      const rows = data ?? [];

      const actorIds = Array.from(new Set(rows.map((r) => r.actor_user_id).filter((id): id is string => Boolean(id))));
      const nameByUserId = new Map<string, string>();
      if (actorIds.length > 0) {
        const { data: employees, error: employeesError } = await supabase
          .from('employees')
          .select('user_id, first_name, last_name')
          .in('user_id', actorIds);
        if (employeesError) throw employeesError;
        for (const e of employees ?? []) {
          if (e.user_id) nameByUserId.set(e.user_id, [e.first_name, e.last_name].filter(Boolean).join(' '));
        }
      }

      const employeeIds = Array.from(new Set(rows.map((r) => r.employee_id).filter((id): id is string => Boolean(id))));
      const nameByEmployeeId = new Map<string, string>();
      if (employeeIds.length > 0) {
        const { data: employees, error: employeesError } = await supabase
          .from('employees')
          .select('id, first_name, last_name')
          .in('id', employeeIds);
        if (employeesError) throw employeesError;
        for (const e of employees ?? []) {
          nameByEmployeeId.set(e.id, [e.first_name, e.last_name].filter(Boolean).join(' '));
        }
      }

      return rows.map((r) => ({
        id: r.id,
        actorUserId: r.actor_user_id,
        actorName: r.actor_user_id ? (nameByUserId.get(r.actor_user_id) ?? 'Unknown user') : 'System',
        actorRole: r.actor_role,
        employeeId: r.employee_id,
        employeeName: r.employee_id ? (nameByEmployeeId.get(r.employee_id) ?? '-') : null,
        action: r.action,
        module: r.module,
        recordId: r.record_id,
        oldValue: r.old_value,
        newValue: r.new_value,
        ipAddress: r.ip_address,
        result: r.result,
        createdAt: r.created_at,
      }));
    },
  });
}
