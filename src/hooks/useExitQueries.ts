import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { calculateExpectedLastWorkingDate } from '@/lib/exitCalc';
import type { ExitClearanceRow, ExitRequestRow, ExitSettlementRow, HrContact } from '@/types/exit';

type EmployeeNameJoin = { first_name: string; last_name: string | null } | null;
function employeeName(e: EmployeeNameJoin): string | null {
  return e ? [e.first_name, e.last_name].filter(Boolean).join(' ') : null;
}

const EXIT_REQUEST_SELECT =
  'id, employee_id, manager_id, resignation_date, proposed_last_working_date, notice_period_days, expected_last_working_date, ' +
  'reason, detailed_comments, attachment_url, status, manager_remarks, hr_remarks, created_at, ' +
  'employee:employees!exit_requests_employee_id_fkey(first_name, last_name, employee_code), ' +
  'manager:employees!exit_requests_manager_id_fkey(first_name, last_name)';

interface ExitRequestQueryRow {
  id: string;
  employee_id: string;
  manager_id: string | null;
  resignation_date: string;
  proposed_last_working_date: string;
  notice_period_days: number;
  expected_last_working_date: string;
  reason: string;
  detailed_comments: string | null;
  attachment_url: string | null;
  status: ExitRequestRow['status'];
  manager_remarks: string | null;
  hr_remarks: string | null;
  created_at: string;
  employee: (EmployeeNameJoin & { employee_code: string }) | null;
  manager: EmployeeNameJoin;
}

function mapExitRequest(r: ExitRequestQueryRow): ExitRequestRow {
  return {
    id: r.id,
    employeeId: r.employee_id,
    employeeName: employeeName(r.employee) ?? '-',
    employeeCode: r.employee?.employee_code ?? '-',
    resignationDate: r.resignation_date,
    proposedLastWorkingDate: r.proposed_last_working_date,
    noticePeriodDays: r.notice_period_days,
    expectedLastWorkingDate: r.expected_last_working_date,
    reason: r.reason,
    detailedComments: r.detailed_comments,
    attachmentUrl: r.attachment_url,
    status: r.status,
    managerId: r.manager_id,
    managerName: employeeName(r.manager),
    managerRemarks: r.manager_remarks,
    hrRemarks: r.hr_remarks,
    createdAt: r.created_at,
  };
}

/** All of the current employee's own resignations, most recent first. */
export function useMyExitRequests(employeeId: string | undefined) {
  return useQuery({
    queryKey: ['my-exit-requests', employeeId],
    enabled: Boolean(employeeId),
    queryFn: async (): Promise<ExitRequestRow[]> => {
      const { data, error } = await supabase
        .from('exit_requests')
        .select(EXIT_REQUEST_SELECT)
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => mapExitRequest(r as unknown as ExitRequestQueryRow));
    },
  });
}

/** Every resignation visible to the current user under RLS — their team if a manager, the whole org if HR/admin. */
export function useManageableExitRequests() {
  return useQuery({
    queryKey: ['manageable-exit-requests'],
    queryFn: async (): Promise<ExitRequestRow[]> => {
      const { data, error } = await supabase.from('exit_requests').select(EXIT_REQUEST_SELECT).order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => mapExitRequest(r as unknown as ExitRequestQueryRow));
    },
  });
}

interface NewExitRequestInput {
  organizationId: string;
  employeeId: string;
  managerId: string | null;
  resignationDate: string;
  noticePeriodDays: number;
  proposedLastWorkingDate: string;
  reason: string;
  detailedComments?: string;
  attachmentUrl?: string | null;
}

export function useCreateExitRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewExitRequestInput) => {
      const expectedLastWorkingDate = calculateExpectedLastWorkingDate(input.resignationDate, input.noticePeriodDays);
      const { error } = await supabase.from('exit_requests').insert({
        organization_id: input.organizationId,
        employee_id: input.employeeId,
        manager_id: input.managerId,
        resignation_date: input.resignationDate,
        notice_period_days: input.noticePeriodDays,
        proposed_last_working_date: input.proposedLastWorkingDate,
        expected_last_working_date: expectedLastWorkingDate,
        reason: input.reason,
        detailed_comments: input.detailedComments ?? null,
        attachment_url: input.attachmentUrl ?? null,
        status: 'submitted',
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['my-exit-requests', variables.employeeId] });
      queryClient.invalidateQueries({ queryKey: ['manageable-exit-requests'] });
    },
  });
}

type ExitRequestAction = 'manager_approve' | 'manager_reject' | 'hr_approve' | 'hr_reject' | 'withdraw';

export function useActOnExitRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ exitRequestId, action, remarks }: { exitRequestId: string; action: ExitRequestAction; remarks?: string }) => {
      const { error } = await supabase.rpc('act_on_exit_request', {
        _exit_request_id: exitRequestId,
        _action: action,
        _remarks: remarks ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-exit-requests'] });
      queryClient.invalidateQueries({ queryKey: ['manageable-exit-requests'] });
      queryClient.invalidateQueries({ queryKey: ['exit-clearances'] });
    },
  });
}

// --- Clearance ---

export function useExitClearances(exitRequestId: string | undefined) {
  return useQuery({
    queryKey: ['exit-clearances', exitRequestId],
    enabled: Boolean(exitRequestId),
    queryFn: async (): Promise<ExitClearanceRow[]> => {
      const { data, error } = await supabase
        .from('exit_clearances')
        .select('id, exit_request_id, department, status, remarks, cleared_at, cleared_by:employees(first_name, last_name)')
        .eq('exit_request_id', exitRequestId)
        .order('department');
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        exitRequestId: r.exit_request_id,
        department: r.department,
        status: r.status,
        remarks: r.remarks,
        clearedByName: employeeName(r.cleared_by as unknown as EmployeeNameJoin),
        clearedAt: r.cleared_at,
      }));
    },
  });
}

export function useActOnExitClearance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ clearanceId, status, remarks }: { clearanceId: string; exitRequestId: string; status: 'cleared' | 'rejected'; remarks?: string }) => {
      const { error } = await supabase.rpc('act_on_exit_clearance', {
        _clearance_id: clearanceId,
        _status: status,
        _remarks: remarks ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['exit-clearances', variables.exitRequestId] });
      queryClient.invalidateQueries({ queryKey: ['my-exit-requests'] });
      queryClient.invalidateQueries({ queryKey: ['manageable-exit-requests'] });
    },
  });
}

// --- Final Settlement ---

export function useExitSettlement(exitRequestId: string | undefined) {
  return useQuery({
    queryKey: ['exit-settlement', exitRequestId],
    enabled: Boolean(exitRequestId),
    queryFn: async (): Promise<ExitSettlementRow | null> => {
      const { data, error } = await supabase
        .from('exit_settlements')
        .select('id, exit_request_id, last_working_date, leave_encashment, notice_pay, pending_salary, deductions, bonus, other_adjustments, final_settlement_amount, status, released_at')
        .eq('exit_request_id', exitRequestId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        id: data.id,
        exitRequestId: data.exit_request_id,
        lastWorkingDate: data.last_working_date,
        leaveEncashment: Number(data.leave_encashment),
        noticePay: Number(data.notice_pay),
        pendingSalary: Number(data.pending_salary),
        deductions: Number(data.deductions),
        bonus: Number(data.bonus),
        otherAdjustments: Number(data.other_adjustments),
        finalSettlementAmount: Number(data.final_settlement_amount),
        status: data.status,
        releasedAt: data.released_at,
      };
    },
  });
}

interface UpsertExitSettlementInput {
  exitRequestId: string;
  lastWorkingDate: string;
  leaveEncashment: number;
  noticePay: number;
  pendingSalary: number;
  deductions: number;
  bonus: number;
  otherAdjustments: number;
  release: boolean;
  releasedBy: string;
}

export function useUpsertExitSettlement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpsertExitSettlementInput) => {
      const { error } = await supabase.from('exit_settlements').upsert(
        {
          exit_request_id: input.exitRequestId,
          last_working_date: input.lastWorkingDate,
          leave_encashment: input.leaveEncashment,
          notice_pay: input.noticePay,
          pending_salary: input.pendingSalary,
          deductions: input.deductions,
          bonus: input.bonus,
          other_adjustments: input.otherAdjustments,
          status: input.release ? 'released' : 'draft',
          released_by: input.release ? input.releasedBy : null,
          released_at: input.release ? new Date().toISOString() : null,
        },
        { onConflict: 'exit_request_id' },
      );
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['exit-settlement', variables.exitRequestId] });
    },
  });
}

export function useHrContact(employeeId: string | undefined) {
  return useQuery({
    queryKey: ['hr-contact', employeeId],
    enabled: Boolean(employeeId),
    queryFn: async (): Promise<HrContact | null> => {
      const { data, error } = await supabase.rpc('get_hr_contact');
      if (error) throw error;
      const row = data?.[0];
      if (!row) return null;
      return { displayName: row.display_name, email: row.email };
    },
  });
}
