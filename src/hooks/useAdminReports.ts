import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { ORG_ID } from '@/lib/orgContext';
import { formatDateISO } from '@/lib/utils';
import type { TeamAttendanceRow, TeamLeaveRequestRow, TeamPermissionRow } from '@/types/manager';

type EmployeeJoin = { first_name: string; last_name: string | null; employee_code: string } | null;

function employeeName(e: EmployeeJoin): string {
  return e ? [e.first_name, e.last_name].filter(Boolean).join(' ') : '-';
}

/** Org-wide analog of useTeamReportData — same `attendance` shape, scoped by organization_id instead of a team-id list. */
export function useOrgReportData(start: Date, end: Date) {
  const startStr = formatDateISO(start);
  const endStr = formatDateISO(end);

  return useQuery({
    queryKey: ['admin-report-attendance', startStr, endStr],
    queryFn: async (): Promise<TeamAttendanceRow[]> => {
      const { data, error } = await supabase
        .from('attendance')
        .select(
          'id, employee_id, attendance_date, check_in, check_out, gross_minutes, break_minutes, effective_minutes, payable_minutes, has_excess_break, late_minutes, early_going_minutes, excess_stay_minutes, shortfall_minutes, missing_in, missing_out, day_status, validation_status, remarks, shift:shifts(name), employee:employees(first_name, last_name, employee_code)',
        )
        .eq('organization_id', ORG_ID)
        .gte('attendance_date', startStr)
        .lte('attendance_date', endStr)
        .order('attendance_date', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        employeeId: row.employee_id,
        attendanceDate: row.attendance_date,
        shiftName: (row.shift as unknown as { name: string } | null)?.name ?? null,
        checkIn: row.check_in,
        checkOut: row.check_out,
        grossMinutes: row.gross_minutes,
        breakMinutes: row.break_minutes,
        effectiveMinutes: row.effective_minutes,
        payableMinutes: row.payable_minutes,
        hasExcessBreak: row.has_excess_break,
        lateMinutes: row.late_minutes,
        earlyGoingMinutes: row.early_going_minutes,
        excessStayMinutes: row.excess_stay_minutes,
        shortfallMinutes: row.shortfall_minutes,
        missingIn: row.missing_in,
        missingOut: row.missing_out,
        dayStatus: row.day_status,
        validationStatus: row.validation_status,
        remarks: row.remarks,
        employeeName: employeeName(row.employee as unknown as EmployeeJoin),
        employeeCode: (row.employee as unknown as EmployeeJoin)?.employee_code ?? '-',
      }));
    },
  });
}

export function useOrgLeaveRequests() {
  return useQuery({
    queryKey: ['admin-report-leave-requests'],
    queryFn: async (): Promise<TeamLeaveRequestRow[]> => {
      const { data, error } = await supabase
        .from('leave_requests')
        .select(
          'id, employee_id, from_date, to_date, duration_days, applied_on, reason, approval_remarks, status, leave_type:leave_types(name), employee:employees(first_name, last_name, employee_code)',
        )
        .eq('organization_id', ORG_ID)
        .order('from_date', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        employeeId: row.employee_id,
        employeeName: employeeName(row.employee as unknown as EmployeeJoin),
        employeeCode: (row.employee as unknown as EmployeeJoin)?.employee_code ?? '-',
        leaveTypeName: (row.leave_type as unknown as { name: string } | null)?.name ?? '-',
        fromDate: row.from_date,
        toDate: row.to_date,
        durationDays: Number(row.duration_days),
        reason: row.reason,
        appliedOn: row.applied_on,
        approvalRemarks: row.approval_remarks,
        status: row.status,
      }));
    },
  });
}

export function useOrgPermissionRequests(start: Date, end: Date) {
  const startStr = formatDateISO(start);
  const endStr = formatDateISO(end);

  return useQuery({
    queryKey: ['admin-report-permissions', startStr, endStr],
    queryFn: async (): Promise<TeamPermissionRow[]> => {
      const { data, error } = await supabase
        .from('permission_requests')
        .select(
          'id, employee_id, permission_date, from_time, to_time, duration_minutes, status, employee:employees(first_name, last_name, employee_code)',
        )
        .eq('organization_id', ORG_ID)
        .gte('permission_date', startStr)
        .lte('permission_date', endStr)
        .order('permission_date', { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        employeeId: row.employee_id,
        employeeName: employeeName(row.employee as unknown as EmployeeJoin),
        employeeCode: (row.employee as unknown as EmployeeJoin)?.employee_code ?? '-',
        permissionDate: row.permission_date,
        fromTime: row.from_time,
        toTime: row.to_time,
        durationMinutes: row.duration_minutes,
        status: row.status,
      }));
    },
  });
}
