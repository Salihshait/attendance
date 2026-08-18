import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { LeaveBalanceRow, LeaveRequestRow, PermissionBalanceRow, PermissionRequestRow, RegularizationRow, RequestStatus } from '@/types/attendance';

export function useLeaveTypes(organizationId: string | undefined) {
  return useQuery({
    queryKey: ['leave-types', organizationId],
    enabled: Boolean(organizationId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leave_types')
        .select('id, code, name, allow_half_day')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useLeaveBalances(employeeId: string | undefined) {
  return useQuery({
    queryKey: ['leave-balances', employeeId],
    enabled: Boolean(employeeId),
    queryFn: async (): Promise<LeaveBalanceRow[]> => {
      const { data, error } = await supabase
        .from('leave_balances')
        .select('leave_type_id, period_start, period_end, opening, credited, used, balance, leave_type:leave_types(name)')
        .eq('employee_id', employeeId)
        .order('leave_type_id')
        .order('period_start');
      if (error) throw error;
      return (data ?? []).map((row) => ({
        leaveTypeId: row.leave_type_id,
        leaveTypeName: (row.leave_type as unknown as { name: string } | null)?.name ?? '-',
        periodStart: row.period_start,
        periodEnd: row.period_end,
        opening: Number(row.opening),
        credited: Number(row.credited),
        used: Number(row.used),
        balance: Number(row.balance),
      }));
    },
  });
}

// `entry_by` is always the employee themselves for the self-service flows
// built so far, so the display name is passed in rather than joined —
// avoids embedding `employees` a second time via another FK on this table
// (see the reporting_manager lesson in AuthProvider.tsx).
export function useLeaveRequests(employeeId: string | undefined, selfDisplayName: string) {
  return useQuery({
    queryKey: ['leave-requests', employeeId],
    enabled: Boolean(employeeId),
    queryFn: async (): Promise<LeaveRequestRow[]> => {
      const { data, error } = await supabase
        .from('leave_requests')
        .select('id, from_date, to_date, duration_days, applied_on, reason, approval_remarks, status, leave_type:leave_types(name)')
        .eq('employee_id', employeeId)
        .order('from_date', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        leaveTypeName: (row.leave_type as unknown as { name: string } | null)?.name ?? '-',
        fromDate: row.from_date,
        toDate: row.to_date,
        durationDays: Number(row.duration_days),
        entryByName: selfDisplayName,
        appliedOn: row.applied_on,
        reason: row.reason,
        approvalRemarks: row.approval_remarks,
        status: row.status,
      }));
    },
  });
}

export interface OndutyRequestRow {
  id: string;
  ondutyType: 'on_duty' | 'work_from_home';
  fromDate: string;
  toDate: string;
  reason: string;
  location: string | null;
  appliedOn: string;
  approvalRemarks: string | null;
  status: RequestStatus;
}

export function useOndutyRequests(employeeId: string | undefined) {
  return useQuery({
    queryKey: ['onduty-requests', employeeId],
    enabled: Boolean(employeeId),
    queryFn: async (): Promise<OndutyRequestRow[]> => {
      const { data, error } = await supabase
        .from('onduty_requests')
        .select('id, onduty_type, from_date, to_date, reason, location, applied_on, approval_remarks, status')
        .eq('employee_id', employeeId)
        .order('from_date', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        ondutyType: row.onduty_type,
        fromDate: row.from_date,
        toDate: row.to_date,
        reason: row.reason,
        location: row.location,
        appliedOn: row.applied_on,
        approvalRemarks: row.approval_remarks,
        status: row.status,
      }));
    },
  });
}

export interface NewOndutyRequestInput {
  organizationId: string;
  employeeId: string;
  reportingManagerId: string | null;
  ondutyType: 'on_duty' | 'work_from_home';
  fromDate: string;
  toDate: string;
  reason: string;
  location?: string | null;
}

export function useCreateOndutyRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewOndutyRequestInput) => {
      const { error } = await supabase.from('onduty_requests').insert({
        organization_id: input.organizationId,
        employee_id: input.employeeId,
        reporting_manager_id: input.reportingManagerId,
        onduty_type: input.ondutyType,
        from_date: input.fromDate,
        to_date: input.toDate,
        reason: input.reason,
        location: input.location ?? null,
        entry_by: input.employeeId,
        status: 'pending',
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['onduty-requests', variables.employeeId] });
    },
  });
}

// Current calendar month's permission balance for the employee. Monthly
// periods mirror leave_balances' period_start/period_end shape — a
// year-wise view would sum every period_start falling in that year for the
// employee, same pattern as any other monthly-bucketed ledger.
export function useMyPermissionBalance(employeeId: string | undefined) {
  return useQuery({
    queryKey: ['permission-balance', employeeId],
    enabled: Boolean(employeeId),
    queryFn: async (): Promise<PermissionBalanceRow | null> => {
      const today = new Date();
      const periodStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
      const { data, error } = await supabase
        .from('permission_balances')
        .select('period_start, period_end, opening_minutes, credited_minutes, used_minutes, balance_minutes')
        .eq('employee_id', employeeId)
        .eq('period_start', periodStart)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        periodStart: data.period_start,
        periodEnd: data.period_end,
        openingMinutes: data.opening_minutes,
        creditedMinutes: data.credited_minutes,
        usedMinutes: data.used_minutes,
        balanceMinutes: data.balance_minutes,
      };
    },
  });
}

export function usePermissionRequests(employeeId: string | undefined, selfDisplayName: string) {
  return useQuery({
    queryKey: ['permission-requests', employeeId],
    enabled: Boolean(employeeId),
    queryFn: async (): Promise<PermissionRequestRow[]> => {
      const { data, error } = await supabase
        .from('permission_requests')
        .select('id, permission_date, from_time, to_time, duration_minutes, applied_on, reason, approval_remarks, status')
        .eq('employee_id', employeeId)
        .order('permission_date', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        permissionDate: row.permission_date,
        fromTime: row.from_time,
        toTime: row.to_time,
        durationMinutes: row.duration_minutes,
        entryByName: selfDisplayName,
        appliedOn: row.applied_on,
        reason: row.reason,
        approvalRemarks: row.approval_remarks,
        status: row.status,
      }));
    },
  });
}

export function useRegularizations(employeeId: string | undefined) {
  return useQuery({
    queryKey: ['regularizations', employeeId],
    enabled: Boolean(employeeId),
    queryFn: async (): Promise<RegularizationRow[]> => {
      const { data, error } = await supabase
        .from('attendance_regularizations')
        .select('id, attendance_date, regularization_type, applied_on, reason, approval_remarks, status')
        .eq('employee_id', employeeId)
        .order('attendance_date', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        attendanceDate: row.attendance_date,
        regularizationType: row.regularization_type,
        entryByName: null,
        appliedOn: row.applied_on,
        reason: row.reason,
        approvalRemarks: row.approval_remarks,
        status: row.status,
      }));
    },
  });
}

// --- Mutations for the "Apply" flows ---

interface NewLeaveRequestInput {
  organizationId: string;
  employeeId: string;
  reportingManagerId: string | null;
  leaveTypeId: string;
  fromDate: string;
  toDate: string;
  durationDays: number;
  reason: string;
  attachmentUrl?: string | null;
}

export function useCreateLeaveRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewLeaveRequestInput) => {
      const { error } = await supabase.from('leave_requests').insert({
        organization_id: input.organizationId,
        employee_id: input.employeeId,
        reporting_manager_id: input.reportingManagerId,
        entry_by: input.employeeId,
        leave_type_id: input.leaveTypeId,
        from_date: input.fromDate,
        to_date: input.toDate,
        duration_days: input.durationDays,
        reason: input.reason,
        attachment_url: input.attachmentUrl ?? null,
        status: 'pending',
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests', variables.employeeId] });
    },
  });
}

interface NewPermissionRequestInput {
  organizationId: string;
  employeeId: string;
  reportingManagerId: string | null;
  permissionDate: string;
  fromTime: string;
  toTime: string;
  durationMinutes: number;
  reason: string;
}

export function useCreatePermissionRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewPermissionRequestInput) => {
      const { error } = await supabase.from('permission_requests').insert({
        organization_id: input.organizationId,
        employee_id: input.employeeId,
        reporting_manager_id: input.reportingManagerId,
        entry_by: input.employeeId,
        permission_date: input.permissionDate,
        from_time: input.fromTime,
        to_time: input.toTime,
        duration_minutes: input.durationMinutes,
        reason: input.reason,
        status: 'pending',
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['permission-requests', variables.employeeId] });
    },
  });
}

interface NewRegularizationInput {
  organizationId: string;
  employeeId: string;
  attendanceDate: string;
  regularizationType: string;
  requestedCheckIn?: string | null;
  requestedCheckOut?: string | null;
  reason: string;
}

export function useCreateRegularization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewRegularizationInput) => {
      const { error } = await supabase.from('attendance_regularizations').insert({
        organization_id: input.organizationId,
        employee_id: input.employeeId,
        attendance_date: input.attendanceDate,
        regularization_type: input.regularizationType,
        requested_check_in: input.requestedCheckIn ?? null,
        requested_check_out: input.requestedCheckOut ?? null,
        reason: input.reason,
        status: 'pending',
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['regularizations', variables.employeeId] });
    },
  });
}

// --- Cancel actions, shared shape across the three request tables ---

function useCancelMutation(table: 'leave_requests' | 'permission_requests' | 'attendance_regularizations' | 'onduty_requests', queryKey: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; employeeId: string }) => {
      const { error } = await supabase.from(table).update({ status: 'cancelled' }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [queryKey, variables.employeeId] });
    },
  });
}

export function useCancelLeaveRequest() {
  return useCancelMutation('leave_requests', 'leave-requests');
}
export function useCancelPermissionRequest() {
  return useCancelMutation('permission_requests', 'permission-requests');
}
export function useCancelRegularization() {
  return useCancelMutation('attendance_regularizations', 'regularizations');
}
export function useCancelOndutyRequest() {
  return useCancelMutation('onduty_requests', 'onduty-requests');
}
