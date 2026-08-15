import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { formatDDMMYYYY, formatHoursMinutes, formatTime12h } from '@/lib/dateFormat';
import type { ApprovalRequestType, PendingApprovalRow } from '@/types/attendance';

type EmployeeJoin = { first_name: string; last_name: string | null; employee_code: string } | null;

function employeeName(e: EmployeeJoin): string {
  return e ? [e.first_name, e.last_name].filter(Boolean).join(' ') : '-';
}

/**
 * Pending leave/permission/regularization/on-duty(WFH)/other requests
 * visible to the current user — RLS (is_manager_of / is_hr_or_admin) already
 * scopes each table's select policy to "my team" or "my organization", so
 * this simply reads the request tables directly rather than requiring every
 * seeded request to have a pre-existing approval_instances row.
 *
 * "On Duty" (onduty_type = 'on_duty') rows are intentionally excluded — the
 * spec's approval categories only name "Work From Home", not "On Duty".
 */
export function usePendingApprovals() {
  return useQuery({
    queryKey: ['pending-approvals'],
    queryFn: async (): Promise<PendingApprovalRow[]> => {
      const [leaveRes, permissionRes, regularizationRes, onDutyRes, otherRes] = await Promise.all([
        supabase
          .from('leave_requests')
          .select('id, employee_id, from_date, to_date, duration_days, reason, applied_on, leave_type:leave_types(name), employee:employees!leave_requests_employee_id_fkey(first_name, last_name, employee_code)')
          .eq('status', 'pending')
          .order('applied_on', { ascending: false }),
        supabase
          .from('permission_requests')
          .select('id, employee_id, permission_date, from_time, to_time, duration_minutes, reason, applied_on, employee:employees!permission_requests_employee_id_fkey(first_name, last_name, employee_code)')
          .eq('status', 'pending')
          .order('applied_on', { ascending: false }),
        supabase
          .from('attendance_regularizations')
          .select('id, employee_id, attendance_date, regularization_type, reason, applied_on, employee:employees!attendance_regularizations_employee_id_fkey(first_name, last_name, employee_code)')
          .eq('status', 'pending')
          .order('applied_on', { ascending: false }),
        supabase
          .from('onduty_requests')
          .select('id, employee_id, from_date, to_date, location, reason, applied_on, employee:employees!onduty_requests_employee_id_fkey(first_name, last_name, employee_code)')
          .eq('status', 'pending')
          .eq('onduty_type', 'work_from_home')
          .order('applied_on', { ascending: false }),
        supabase
          .from('other_requests')
          .select('id, employee_id, request_title, request_date, reason, applied_on, employee:employees!other_requests_employee_id_fkey(first_name, last_name, employee_code)')
          .eq('status', 'pending')
          .order('applied_on', { ascending: false }),
      ]);

      if (leaveRes.error) throw leaveRes.error;
      if (permissionRes.error) throw permissionRes.error;
      if (regularizationRes.error) throw regularizationRes.error;
      if (onDutyRes.error) throw onDutyRes.error;
      if (otherRes.error) throw otherRes.error;

      const leaveRows: PendingApprovalRow[] = (leaveRes.data ?? []).map((r) => ({
        requestType: 'leave_request',
        id: r.id,
        employeeId: r.employee_id,
        employeeName: employeeName(r.employee as unknown as EmployeeJoin),
        employeeCode: (r.employee as unknown as EmployeeJoin)?.employee_code ?? '-',
        dateLabel: r.from_date === r.to_date ? formatDDMMYYYY(r.from_date) : `${formatDDMMYYYY(r.from_date)} - ${formatDDMMYYYY(r.to_date)}`,
        detailLabel: `${(r.leave_type as unknown as { name: string } | null)?.name ?? 'Leave'} · ${r.duration_days} day(s)`,
        reason: r.reason,
        appliedOn: r.applied_on,
      }));

      const permissionRows: PendingApprovalRow[] = (permissionRes.data ?? []).map((r) => ({
        requestType: 'permission_request',
        id: r.id,
        employeeId: r.employee_id,
        employeeName: employeeName(r.employee as unknown as EmployeeJoin),
        employeeCode: (r.employee as unknown as EmployeeJoin)?.employee_code ?? '-',
        dateLabel: formatDDMMYYYY(r.permission_date),
        detailLabel: `${formatTime12h(r.from_time)} - ${formatTime12h(r.to_time)} (${formatHoursMinutes(r.duration_minutes)})`,
        reason: r.reason,
        appliedOn: r.applied_on,
      }));

      const regularizationRows: PendingApprovalRow[] = (regularizationRes.data ?? []).map((r) => ({
        requestType: 'attendance_regularization',
        id: r.id,
        employeeId: r.employee_id,
        employeeName: employeeName(r.employee as unknown as EmployeeJoin),
        employeeCode: (r.employee as unknown as EmployeeJoin)?.employee_code ?? '-',
        dateLabel: formatDDMMYYYY(r.attendance_date),
        detailLabel: String(r.regularization_type).replace(/_/g, ' '),
        reason: r.reason,
        appliedOn: r.applied_on,
      }));

      const onDutyRows: PendingApprovalRow[] = (onDutyRes.data ?? []).map((r) => ({
        requestType: 'onduty_request',
        id: r.id,
        employeeId: r.employee_id,
        employeeName: employeeName(r.employee as unknown as EmployeeJoin),
        employeeCode: (r.employee as unknown as EmployeeJoin)?.employee_code ?? '-',
        dateLabel: r.from_date === r.to_date ? formatDDMMYYYY(r.from_date) : `${formatDDMMYYYY(r.from_date)} - ${formatDDMMYYYY(r.to_date)}`,
        detailLabel: `Work From Home${r.location ? ` · ${r.location}` : ''}`,
        reason: r.reason,
        appliedOn: r.applied_on,
      }));

      const otherRows: PendingApprovalRow[] = (otherRes.data ?? []).map((r) => ({
        requestType: 'other_request',
        id: r.id,
        employeeId: r.employee_id,
        employeeName: employeeName(r.employee as unknown as EmployeeJoin),
        employeeCode: (r.employee as unknown as EmployeeJoin)?.employee_code ?? '-',
        dateLabel: formatDDMMYYYY(r.request_date),
        detailLabel: r.request_title,
        reason: r.reason,
        appliedOn: r.applied_on,
      }));

      return [...leaveRows, ...permissionRows, ...regularizationRows, ...onDutyRows, ...otherRows].sort((a, b) =>
        a.appliedOn < b.appliedOn ? 1 : -1,
      );
    },
  });
}

interface ActOnApprovalInput {
  requestType: ApprovalRequestType;
  requestId: string;
  action: 'approved' | 'rejected';
  remarks?: string;
}

export function useActOnApproval() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ActOnApprovalInput) => {
      const { error } = await supabase.rpc('act_on_approval', {
        _request_type: input.requestType,
        _request_id: input.requestId,
        _action: input.action,
        _remarks: input.remarks ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
    },
  });
}
