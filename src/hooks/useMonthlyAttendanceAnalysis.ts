import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { MonthlyAttendanceSummaryRow } from '@/types/attendance';

/**
 * Self/manager/HR-scoped server-side by get_monthly_attendance_summary()
 * itself (same scoped_employees pattern as get_missing_attendance() and
 * run_attendance_reconciliation()) -- works unmodified for all three roles.
 * Employee/Department/Manager/Location filtering happens client-side on
 * top of this one fetch (same "derive filter options from the already
 * -scoped result set" pattern as MissingAttendancePage), rather than
 * re-querying per filter change -- a month's worth of rows for whichever
 * employees the caller can already see is a small, cheap dataset.
 */
export function useMonthlyAttendanceAnalysis(year: number, month: number) {
  return useQuery({
    queryKey: ['monthly-attendance-analysis', year, month],
    queryFn: async (): Promise<MonthlyAttendanceSummaryRow[]> => {
      const { data, error } = await supabase.rpc('get_monthly_attendance_summary', { _year: year, _month: month });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        employeeId: r.employee_id,
        employeeCode: r.employee_code,
        employeeName: r.employee_name,
        departmentName: r.department_name,
        locationName: r.location_name,
        managerName: r.manager_name,
        workingDays: r.working_days,
        presentDays: r.present_days,
        absentDays: r.absent_days,
        leaveDays: r.leave_days,
        wfhDays: r.wfh_days,
        onDutyDays: r.on_duty_days,
        permissionCount: r.permission_count,
        permissionMinutes: r.permission_minutes,
        lateDays: r.late_days,
        earlyGoingDays: r.early_going_days,
        missingPunchDays: r.missing_punch_days,
        effectiveMinutes: Number(r.effective_minutes),
        requiredMinutes: Number(r.required_minutes),
        shortfallMinutes: Number(r.shortfall_minutes),
        excessStayMinutes: Number(r.excess_stay_minutes),
        compOffEarned: Number(r.comp_off_earned),
        compOffUsed: Number(r.comp_off_used),
      }));
    },
  });
}
