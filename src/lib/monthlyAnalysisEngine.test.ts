import { describe, expect, it } from 'vitest';
import { aggregateMonthlyAttendance, sumMonthlySummaries, ZERO_MONTHLY_SUMMARY, type DailyAttendanceRecord } from './monthlyAnalysisEngine';

function day(overrides: Partial<DailyAttendanceRecord>): DailyAttendanceRecord {
  return {
    dayStatus: 'present',
    remarks: null,
    lateMinutes: 0,
    earlyGoingMinutes: 0,
    missingIn: false,
    missingOut: false,
    effectiveMinutes: 0,
    shortfallMinutes: 0,
    excessStayMinutes: 0,
    isHoliday: false,
    isWeeklyOff: false,
    requiredMinutesForDay: 540,
    ...overrides,
  };
}

describe('aggregateMonthlyAttendance — validated against a realistic 15-day attendance record set', () => {
  // A hand-built, hand-counted month slice: 2 weekoffs, 1 holiday, 4 normal
  // present days (on-time, late, early-going, excess-stay), 1 half day, 2
  // absent, 1 leave, 1 WFH, 1 On-Duty, 1 missing-punch day, 1 present day
  // that's both late AND excess-stay. Every field mirrors exactly what
  // recompute_attendance_day() would have already computed and stored --
  // this test only checks that aggregation sums/counts them correctly, not
  // that the per-day numbers themselves are right (that's
  // attendanceCalc.test.ts's job).
  const days: DailyAttendanceRecord[] = [
    day({ dayStatus: 'weekoff', isWeeklyOff: true, requiredMinutesForDay: 0 }), // 1: weekoff
    day({ dayStatus: 'weekoff', isWeeklyOff: true, requiredMinutesForDay: 0 }), // 2: weekoff
    day({ dayStatus: 'holiday', isHoliday: true, requiredMinutesForDay: 0 }), // 3: holiday
    day({ dayStatus: 'present', effectiveMinutes: 540 }), // 4: on-time, full day
    day({ dayStatus: 'present', lateMinutes: 30, effectiveMinutes: 510, shortfallMinutes: 30 }), // 5: late
    day({ dayStatus: 'present', earlyGoingMinutes: 45, effectiveMinutes: 495, shortfallMinutes: 45 }), // 6: early going
    day({ dayStatus: 'present', effectiveMinutes: 600, excessStayMinutes: 60 }), // 7: excess stay
    day({ dayStatus: 'half_day', effectiveMinutes: 200, shortfallMinutes: 340 }), // 8: half day
    day({ dayStatus: 'absent', effectiveMinutes: 0, shortfallMinutes: 540 }), // 9: absent
    day({ dayStatus: 'absent', effectiveMinutes: 0, shortfallMinutes: 540 }), // 10: absent
    day({ dayStatus: 'leave' }), // 11: leave -- a working day on the calendar, but recompute_attendance_day() never touches it, so effective/shortfall stay 0
    day({ dayStatus: 'present', remarks: 'Work From Home' }), // 12: WFH
    day({ dayStatus: 'present', remarks: 'On Duty' }), // 13: On-Duty
    day({ dayStatus: 'half_day', missingOut: true, effectiveMinutes: 180, shortfallMinutes: 360 }), // 14: missing OUT
    day({ dayStatus: 'present', lateMinutes: 20, effectiveMinutes: 560, excessStayMinutes: 20 }), // 15: late AND excess stay
  ];

  const summary = aggregateMonthlyAttendance(days);

  it('counts Working Days as every day that is neither a holiday nor a weekly off', () => {
    expect(summary.workingDays).toBe(12);
  });

  it('counts Present as present + half_day', () => {
    // days 4,5,6,7,8,12,13,14,15 = 9
    expect(summary.presentDays).toBe(9);
  });

  it('counts Absent', () => {
    expect(summary.absentDays).toBe(2);
  });

  it('counts Leave', () => {
    expect(summary.leaveDays).toBe(1);
  });

  it('counts WFH via the Work From Home remark, not a dedicated status', () => {
    expect(summary.wfhDays).toBe(1);
  });

  it('counts On-Duty via the On Duty remark', () => {
    expect(summary.onDutyDays).toBe(1);
  });

  it('counts Late Coming days', () => {
    // days 5 and 15
    expect(summary.lateDays).toBe(2);
  });

  it('counts Early Going days', () => {
    expect(summary.earlyGoingDays).toBe(1);
  });

  it('counts Missing Punch days', () => {
    expect(summary.missingPunchDays).toBe(1);
  });

  it('sums Effective Hours across every day', () => {
    // 540+510+495+600+200+0+0+0+0+0+180+560
    expect(summary.effectiveMinutes).toBe(3085);
  });

  it('sums Required Hours across every working day, including leave/WFH/On-Duty days', () => {
    expect(summary.requiredMinutes).toBe(12 * 540);
  });

  it('sums Shortfall across every day', () => {
    // 30+45+340+540+540+360
    expect(summary.shortfallMinutes).toBe(1855);
  });

  it('sums Excess Stay across every day', () => {
    // 60+20
    expect(summary.excessStayMinutes).toBe(80);
  });
});

describe('aggregateMonthlyAttendance — edge cases', () => {
  it('returns all zeros for an empty month (e.g. a brand new employee)', () => {
    expect(aggregateMonthlyAttendance([])).toEqual(ZERO_MONTHLY_SUMMARY);
  });

  it('counts an entire month of weekoffs/holidays as zero working days', () => {
    const summary = aggregateMonthlyAttendance([
      day({ dayStatus: 'weekoff', isWeeklyOff: true, requiredMinutesForDay: 0 }),
      day({ dayStatus: 'holiday', isHoliday: true, requiredMinutesForDay: 0 }),
    ]);
    expect(summary.workingDays).toBe(0);
    expect(summary.requiredMinutes).toBe(0);
    expect(summary.presentDays).toBe(0);
  });

  it('does not double-count a day that is both late and has a missing punch', () => {
    const summary = aggregateMonthlyAttendance([day({ dayStatus: 'half_day', lateMinutes: 15, missingOut: true, effectiveMinutes: 100 })]);
    expect(summary.lateDays).toBe(1);
    expect(summary.missingPunchDays).toBe(1);
    expect(summary.presentDays).toBe(1); // half_day still counts as present
  });
});

describe('sumMonthlySummaries', () => {
  it('adds every field across multiple employees, e.g. for org-wide dashboard cards', () => {
    const empA = aggregateMonthlyAttendance([
      day({ dayStatus: 'present', effectiveMinutes: 540 }),
      day({ dayStatus: 'absent', shortfallMinutes: 540 }),
    ]);
    const empB = aggregateMonthlyAttendance([
      day({ dayStatus: 'leave' }),
      day({ dayStatus: 'present', remarks: 'Work From Home' }),
    ]);

    const total = sumMonthlySummaries([empA, empB]);
    expect(total.presentDays).toBe(2); // 1 from A + 1 from B (the WFH day)
    expect(total.absentDays).toBe(1);
    expect(total.leaveDays).toBe(1);
    expect(total.wfhDays).toBe(1);
    expect(total.workingDays).toBe(4);
  });

  it('returns all zeros for an empty list of summaries', () => {
    expect(sumMonthlySummaries([])).toEqual(ZERO_MONTHLY_SUMMARY);
  });
});
