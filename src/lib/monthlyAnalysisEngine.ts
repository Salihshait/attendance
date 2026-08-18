// Monthly Attendance Analysis — pure aggregation over already-computed
// daily attendance records. This deliberately does NOT recompute effective
// hours, shortfall, excess stay, late/early, or missing-punch flags --
// those come from the centralized Attendance Calculation Engine
// (src/lib/attendanceCalc.ts's evaluateAttendanceDay(), mirrored
// server-side by recompute_attendance_day()). This file only sums/counts
// what the engine already produced, the same TS-mirrors-SQL relationship
// get_monthly_attendance_summary() (supabase/migrations/0049) has to this
// file -- "do not duplicate calculation logic" means this layer must never
// re-derive effective/shortfall/excess/late/early itself, only aggregate.

export interface DailyAttendanceRecord {
  dayStatus: string;
  remarks: string | null;
  lateMinutes: number;
  earlyGoingMinutes: number;
  missingIn: boolean;
  missingOut: boolean;
  effectiveMinutes: number;
  shortfallMinutes: number;
  excessStayMinutes: number;
  isHoliday: boolean;
  isWeeklyOff: boolean;
  /** Required minutes for this specific day (0 on a holiday/weekoff) -- from the shift active that day, same source recompute_attendance_day() itself used. */
  requiredMinutesForDay: number;
}

export interface MonthlyAttendanceSummary {
  workingDays: number;
  presentDays: number;
  absentDays: number;
  leaveDays: number;
  wfhDays: number;
  onDutyDays: number;
  lateDays: number;
  earlyGoingDays: number;
  missingPunchDays: number;
  effectiveMinutes: number;
  requiredMinutes: number;
  shortfallMinutes: number;
  excessStayMinutes: number;
}

export const ZERO_MONTHLY_SUMMARY: MonthlyAttendanceSummary = {
  workingDays: 0,
  presentDays: 0,
  absentDays: 0,
  leaveDays: 0,
  wfhDays: 0,
  onDutyDays: 0,
  lateDays: 0,
  earlyGoingDays: 0,
  missingPunchDays: 0,
  effectiveMinutes: 0,
  requiredMinutes: 0,
  shortfallMinutes: 0,
  excessStayMinutes: 0,
};

/**
 * Working Days = calendar days that are neither a holiday nor a weekly off,
 * regardless of the day's actual outcome (a working day the employee was
 * absent on still counts as a working day). WFH/On-Duty are both stored as
 * day_status='present' with a distinguishing remark (the live schema has no
 * separate 'wfh' status -- see attendanceCalc.ts's evaluateAttendanceDay()
 * doc comment), so they're counted via remarks, not day_status, exactly
 * matching what's actually live.
 */
export function aggregateMonthlyAttendance(days: DailyAttendanceRecord[]): MonthlyAttendanceSummary {
  const summary: MonthlyAttendanceSummary = { ...ZERO_MONTHLY_SUMMARY };

  for (const day of days) {
    if (!day.isHoliday && !day.isWeeklyOff) summary.workingDays += 1;
    if (day.dayStatus === 'present' || day.dayStatus === 'half_day') summary.presentDays += 1;
    if (day.dayStatus === 'absent') summary.absentDays += 1;
    if (day.dayStatus === 'leave') summary.leaveDays += 1;
    if (day.dayStatus === 'present' && day.remarks === 'Work From Home') summary.wfhDays += 1;
    if (day.dayStatus === 'on_duty' || (day.dayStatus === 'present' && day.remarks === 'On Duty')) summary.onDutyDays += 1;
    if (day.lateMinutes > 0) summary.lateDays += 1;
    if (day.earlyGoingMinutes > 0) summary.earlyGoingDays += 1;
    if (day.missingIn || day.missingOut) summary.missingPunchDays += 1;
    summary.effectiveMinutes += day.effectiveMinutes;
    summary.requiredMinutes += day.requiredMinutesForDay;
    summary.shortfallMinutes += day.shortfallMinutes;
    summary.excessStayMinutes += day.excessStayMinutes;
  }

  return summary;
}

export function sumMonthlySummaries(summaries: MonthlyAttendanceSummary[]): MonthlyAttendanceSummary {
  return summaries.reduce(
    (acc, s) => ({
      workingDays: acc.workingDays + s.workingDays,
      presentDays: acc.presentDays + s.presentDays,
      absentDays: acc.absentDays + s.absentDays,
      leaveDays: acc.leaveDays + s.leaveDays,
      wfhDays: acc.wfhDays + s.wfhDays,
      onDutyDays: acc.onDutyDays + s.onDutyDays,
      lateDays: acc.lateDays + s.lateDays,
      earlyGoingDays: acc.earlyGoingDays + s.earlyGoingDays,
      missingPunchDays: acc.missingPunchDays + s.missingPunchDays,
      effectiveMinutes: acc.effectiveMinutes + s.effectiveMinutes,
      requiredMinutes: acc.requiredMinutes + s.requiredMinutes,
      shortfallMinutes: acc.shortfallMinutes + s.shortfallMinutes,
      excessStayMinutes: acc.excessStayMinutes + s.excessStayMinutes,
    }),
    { ...ZERO_MONTHLY_SUMMARY },
  );
}
