import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { formatDateISO } from '@/lib/utils';
import type { TeamAttendanceRow, TeamPermissionRow } from '@/types/manager';

type EmployeeJoin = { first_name: string; last_name: string | null; employee_code: string } | null;

function employeeName(e: EmployeeJoin): string {
  return e ? [e.first_name, e.last_name].filter(Boolean).join(' ') : '-';
}

/**
 * One fetch of the team's `attendance` rows for a date range, shared by the
 * Attendance / Late / Absent / Early Going / Overtime report types on Team
 * Reports — those are filtered client-side views of this same dataset.
 */
export function useTeamReportData(teamEmployeeIds: string[], start: Date, end: Date) {
  const startStr = formatDateISO(start);
  const endStr = formatDateISO(end);

  return useQuery({
    queryKey: ['team-report-attendance', teamEmployeeIds, startStr, endStr],
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

export function useTeamPermissionRequests(teamEmployeeIds: string[], start: Date, end: Date) {
  const startStr = formatDateISO(start);
  const endStr = formatDateISO(end);

  return useQuery({
    queryKey: ['team-report-permissions', teamEmployeeIds, startStr, endStr],
    enabled: teamEmployeeIds.length > 0,
    queryFn: async (): Promise<TeamPermissionRow[]> => {
      const { data, error } = await supabase
        .from('permission_requests')
        .select(
          'id, employee_id, permission_date, from_time, to_time, duration_minutes, status, employee:employees(first_name, last_name, employee_code)',
        )
        .in('employee_id', teamEmployeeIds)
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
