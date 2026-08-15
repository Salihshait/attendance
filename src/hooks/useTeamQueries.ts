import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { formatDateISO } from '@/lib/utils';
import { computeTeamStats } from '@/lib/teamStatsCalc';
import type { TeamAttendanceRow, TeamLeaveRequestRow, TeamMemberRow, TeamStats } from '@/types/manager';

type EmployeeJoin = { first_name: string; last_name: string | null; employee_code: string } | null;

function employeeName(e: EmployeeJoin): string {
  return e ? [e.first_name, e.last_name].filter(Boolean).join(' ') : '-';
}

/** Direct reports only — deliberately not the transitive is_manager_of() chain. */
export function useTeamMembers(managerId: string | undefined) {
  return useQuery({
    queryKey: ['team-members', managerId],
    enabled: Boolean(managerId),
    queryFn: async (): Promise<TeamMemberRow[]> => {
      const { data, error } = await supabase
        .from('employees')
        .select('id, employee_code, first_name, last_name, employment_status, department:departments!employees_department_id_fkey(name), designation:designations(name)')
        .eq('reporting_manager_id', managerId)
        .order('first_name');
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id,
        employeeCode: row.employee_code,
        employeeName: [row.first_name, row.last_name].filter(Boolean).join(' '),
        departmentName: (row.department as unknown as { name: string } | null)?.name ?? null,
        designationName: (row.designation as unknown as { name: string } | null)?.name ?? null,
        employmentStatus: row.employment_status,
      }));
    },
  });
}

export function useTeamAttendance(teamEmployeeIds: string[], start: Date, end: Date) {
  const startStr = formatDateISO(start);
  const endStr = formatDateISO(end);

  return useQuery({
    queryKey: ['team-attendance', teamEmployeeIds, startStr, endStr],
    enabled: teamEmployeeIds.length > 0,
    queryFn: async (): Promise<TeamAttendanceRow[]> => {
      const { data, error } = await supabase
        .from('attendance')
        .select(
          'id, employee_id, attendance_date, check_in, check_out, effective_minutes, late_minutes, early_going_minutes, excess_stay_minutes, shortfall_minutes, day_status, validation_status, remarks, shift:shifts(name), employee:employees(first_name, last_name, employee_code)',
        )
        .in('employee_id', teamEmployeeIds)
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
        effectiveMinutes: row.effective_minutes,
        lateMinutes: row.late_minutes,
        earlyGoingMinutes: row.early_going_minutes,
        excessStayMinutes: row.excess_stay_minutes,
        shortfallMinutes: row.shortfall_minutes,
        dayStatus: row.day_status,
        validationStatus: row.validation_status,
        remarks: row.remarks,
        employeeName: employeeName(row.employee as unknown as EmployeeJoin),
        employeeCode: (row.employee as unknown as EmployeeJoin)?.employee_code ?? '-',
      }));
    },
  });
}

export function useTeamLeaveRequests(teamEmployeeIds: string[]) {
  return useQuery({
    queryKey: ['team-leave-requests', teamEmployeeIds],
    enabled: teamEmployeeIds.length > 0,
    queryFn: async (): Promise<TeamLeaveRequestRow[]> => {
      const { data, error } = await supabase
        .from('leave_requests')
        .select(
          'id, employee_id, from_date, to_date, duration_days, applied_on, reason, approval_remarks, status, leave_type:leave_types(name), employee:employees(first_name, last_name, employee_code)',
        )
        .in('employee_id', teamEmployeeIds)
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

export function useTeamStats(teamEmployeeIds: string[], date: Date) {
  const dateStr = formatDateISO(date);

  return useQuery({
    queryKey: ['team-stats', teamEmployeeIds, dateStr],
    enabled: teamEmployeeIds.length > 0,
    queryFn: async (): Promise<TeamStats> => {
      const { data, error } = await supabase
        .from('attendance')
        .select('day_status, late_minutes, early_going_minutes')
        .in('employee_id', teamEmployeeIds)
        .eq('attendance_date', dateStr);
      if (error) throw error;
      return computeTeamStats(teamEmployeeIds.length, data ?? []);
    },
  });
}
