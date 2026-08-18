import { describe, expect, it } from 'vitest';
import {
  computeAttendanceMetrics,
  computeSessionsFromPunches,
  deriveShortfallAndExcess,
  derivePayableMinutes,
  determineDayStatus,
  evaluateAttendanceDay,
  isOvernightShift,
  normalizedPunchMinutes,
  normalizedShiftEndMinutes,
  parseClockToMinutes,
  type AttendanceEngineInput,
  type AttendanceEngineShift,
  type BreakPolicy,
} from './attendanceCalc';

const GENERAL_SHIFT = { startMinutes: parseClockToMinutes('09:30'), endMinutes: parseClockToMinutes('18:30'), graceMinutes: 15 };
const NIGHT_SHIFT = { startMinutes: parseClockToMinutes('22:00'), endMinutes: parseClockToMinutes('06:00'), graceMinutes: 10 };
const REQUIRED_MINUTES = 9 * 60;

describe('computeAttendanceMetrics — normal attendance', () => {
  it('reports zero late/excess/shortfall for an on-time, full-day punch', () => {
    const metrics = computeAttendanceMetrics({
      shift: GENERAL_SHIFT,
      checkInMinutes: parseClockToMinutes('09:30'),
      checkOutMinutes: parseClockToMinutes('18:30'),
      requiredShiftMinutes: REQUIRED_MINUTES,
    });
    expect(metrics).toEqual({
      effectiveMinutes: 540,
      lateMinutes: 0,
      earlyGoingMinutes: 0,
      excessStayMinutes: 0,
      shortfallMinutes: 0,
    });
  });

  it('stays within grace period without counting as late', () => {
    const metrics = computeAttendanceMetrics({
      shift: GENERAL_SHIFT,
      checkInMinutes: parseClockToMinutes('09:44'),
      checkOutMinutes: parseClockToMinutes('18:30'),
      requiredShiftMinutes: REQUIRED_MINUTES,
    });
    expect(metrics.lateMinutes).toBe(0);
  });
});

describe('computeAttendanceMetrics — late attendance', () => {
  it('counts minutes past shift start + grace as late', () => {
    const metrics = computeAttendanceMetrics({
      shift: GENERAL_SHIFT,
      checkInMinutes: parseClockToMinutes('10:15'),
      checkOutMinutes: parseClockToMinutes('18:30'),
      requiredShiftMinutes: REQUIRED_MINUTES,
    });
    // 10:15 - (09:30 + 15) = 30 minutes late
    expect(metrics.lateMinutes).toBe(30);
  });
});

describe('computeAttendanceMetrics — early going', () => {
  it('counts minutes short of shift end as early going', () => {
    const metrics = computeAttendanceMetrics({
      shift: GENERAL_SHIFT,
      checkInMinutes: parseClockToMinutes('09:30'),
      checkOutMinutes: parseClockToMinutes('17:00'),
      requiredShiftMinutes: REQUIRED_MINUTES,
    });
    expect(metrics.earlyGoingMinutes).toBe(90);
    expect(metrics.excessStayMinutes).toBe(0);
  });
});

describe('computeAttendanceMetrics — overtime / excess stay', () => {
  it('counts minutes past shift end as excess stay', () => {
    const metrics = computeAttendanceMetrics({
      shift: GENERAL_SHIFT,
      checkInMinutes: parseClockToMinutes('09:30'),
      checkOutMinutes: parseClockToMinutes('20:00'),
      requiredShiftMinutes: REQUIRED_MINUTES,
    });
    expect(metrics.excessStayMinutes).toBe(90);
    expect(metrics.earlyGoingMinutes).toBe(0);
  });

  it('has zero shortfall once effective hours meet the requirement', () => {
    const metrics = computeAttendanceMetrics({
      shift: GENERAL_SHIFT,
      checkInMinutes: parseClockToMinutes('09:30'),
      checkOutMinutes: parseClockToMinutes('20:00'),
      requiredShiftMinutes: REQUIRED_MINUTES,
    });
    expect(metrics.shortfallMinutes).toBe(0);
  });
});

describe('computeAttendanceMetrics — shortfall', () => {
  it('counts the gap between effective hours and required hours', () => {
    const metrics = computeAttendanceMetrics({
      shift: GENERAL_SHIFT,
      checkInMinutes: parseClockToMinutes('09:30'),
      checkOutMinutes: parseClockToMinutes('14:30'),
      requiredShiftMinutes: REQUIRED_MINUTES,
    });
    expect(metrics.effectiveMinutes).toBe(300);
    expect(metrics.shortfallMinutes).toBe(240);
  });
});

describe('computeAttendanceMetrics — excess stay is effective vs required, not time-of-day', () => {
  it('does not count excess stay for a late arrival that still only completes the required hours', () => {
    const metrics = computeAttendanceMetrics({
      shift: GENERAL_SHIFT,
      checkInMinutes: parseClockToMinutes('10:30'),
      checkOutMinutes: parseClockToMinutes('19:30'),
      requiredShiftMinutes: REQUIRED_MINUTES,
    });
    expect(metrics.effectiveMinutes).toBe(REQUIRED_MINUTES);
    expect(metrics.excessStayMinutes).toBe(0);
  });

  it('counts excess stay once effective hours exceed required hours, even before shift end', () => {
    const metrics = computeAttendanceMetrics({
      shift: GENERAL_SHIFT,
      checkInMinutes: parseClockToMinutes('07:00'),
      checkOutMinutes: parseClockToMinutes('16:30'),
      requiredShiftMinutes: REQUIRED_MINUTES,
    });
    // 07:00 -> 16:30 is 9h30 effective, 30 min past the 9h requirement, even
    // though checkout (16:30) is well before the shift's own end (18:30).
    expect(metrics.effectiveMinutes).toBe(REQUIRED_MINUTES + 30);
    expect(metrics.excessStayMinutes).toBe(30);
  });
});

describe('computeSessionsFromPunches — multi-session effective hours', () => {
  it('sums multiple valid in/out sessions, not first-in to final-out', () => {
    // The spec's own worked example: 10:00-11:00 + 11:15-18:30 = 08:15,
    // with the 11:00-11:15 gap counted as break, not effective time.
    const summary = computeSessionsFromPunches([
      { type: 'in', minutes: parseClockToMinutes('10:00') },
      { type: 'out', minutes: parseClockToMinutes('11:00') },
      { type: 'in', minutes: parseClockToMinutes('11:15') },
      { type: 'out', minutes: parseClockToMinutes('18:30') },
    ]);
    expect(summary.effectiveMinutes).toBe(8 * 60 + 15);
    expect(summary.grossMinutes).toBe(8 * 60 + 30);
    expect(summary.breakMinutes).toBe(15);
    expect(summary.firstInMinutes).toBe(parseClockToMinutes('10:00'));
    expect(summary.lastOutMinutes).toBe(parseClockToMinutes('18:30'));
    expect(summary.missingIn).toBe(false);
    expect(summary.missingOut).toBe(false);
  });

  it('flags a trailing unclosed in as missing out, without crediting effective time for it', () => {
    const summary = computeSessionsFromPunches([
      { type: 'in', minutes: parseClockToMinutes('10:00') },
      { type: 'out', minutes: parseClockToMinutes('13:00') },
      { type: 'in', minutes: parseClockToMinutes('14:00') },
    ]);
    expect(summary.effectiveMinutes).toBe(3 * 60);
    expect(summary.missingOut).toBe(true);
    expect(summary.missingIn).toBe(false);
    expect(summary.lastOutMinutes).toBe(parseClockToMinutes('13:00'));
  });

  it('flags an orphan out with no in punch at all as missing in', () => {
    const summary = computeSessionsFromPunches([{ type: 'out', minutes: parseClockToMinutes('18:00') }]);
    expect(summary.effectiveMinutes).toBe(0);
    expect(summary.missingIn).toBe(true);
    expect(summary.missingOut).toBe(false);
    expect(summary.firstInMinutes).toBeNull();
    expect(summary.lastOutMinutes).toBe(parseClockToMinutes('18:00'));
  });

  it('ignores a duplicate consecutive in punch, keeping the earlier one open', () => {
    const summary = computeSessionsFromPunches([
      { type: 'in', minutes: parseClockToMinutes('09:30') },
      { type: 'in', minutes: parseClockToMinutes('09:45') }, // duplicate, e.g. a double biometric scan
      { type: 'out', minutes: parseClockToMinutes('18:30') },
    ]);
    expect(summary.effectiveMinutes).toBe(9 * 60);
    expect(summary.firstInMinutes).toBe(parseClockToMinutes('09:30'));
  });

  it('ignores an orphan out mid-sequence (invalid punch order) but still pairs the valid session around it', () => {
    const summary = computeSessionsFromPunches([
      { type: 'out', minutes: parseClockToMinutes('08:00') }, // orphan, no preceding in
      { type: 'in', minutes: parseClockToMinutes('09:30') },
      { type: 'out', minutes: parseClockToMinutes('18:30') },
    ]);
    expect(summary.effectiveMinutes).toBe(9 * 60);
    expect(summary.missingIn).toBe(false); // a real in punch did occur later
  });

  it('handles an overnight session (in before midnight, out after) via caller-normalized minutes', () => {
    // Caller is responsible for rolling the post-midnight out forward past
    // 1440, same convention as normalizedPunchMinutes elsewhere in this file.
    const summary = computeSessionsFromPunches([
      { type: 'in', minutes: parseClockToMinutes('22:00') },
      { type: 'out', minutes: parseClockToMinutes('06:00') + 24 * 60 },
    ]);
    expect(summary.effectiveMinutes).toBe(8 * 60);
    expect(summary.grossMinutes).toBe(8 * 60);
    expect(summary.breakMinutes).toBe(0);
  });

  it('returns zero/missing-both for a day with no punches at all', () => {
    const summary = computeSessionsFromPunches([]);
    expect(summary.effectiveMinutes).toBe(0);
    expect(summary.grossMinutes).toBe(0);
    expect(summary.missingIn).toBe(false);
    expect(summary.missingOut).toBe(false);
    expect(summary.firstInMinutes).toBeNull();
    expect(summary.lastOutMinutes).toBeNull();
  });

  it('end-to-end worked example: 10:00-11:00 + 11:15-18:30 against a 09:00 requirement', () => {
    // Gross 08:30, Break 00:15, Effective 08:15, Shortfall 00:45, Excess 00:00.
    const summary = computeSessionsFromPunches([
      { type: 'in', minutes: parseClockToMinutes('10:00') },
      { type: 'out', minutes: parseClockToMinutes('11:00') },
      { type: 'in', minutes: parseClockToMinutes('11:15') },
      { type: 'out', minutes: parseClockToMinutes('18:30') },
    ]);
    expect(summary.grossMinutes).toBe(8 * 60 + 30);
    expect(summary.breakMinutes).toBe(15);
    expect(summary.effectiveMinutes).toBe(8 * 60 + 15);

    const { shortfallMinutes, excessStayMinutes } = deriveShortfallAndExcess(summary.effectiveMinutes, 9 * 60);
    expect(shortfallMinutes).toBe(45);
    expect(excessStayMinutes).toBe(0);
  });
});

describe('computeSessionsFromPunches — configurable break policy', () => {
  const POLICY: BreakPolicy = {
    minBreakMinutes: 10,
    maxBreakMinutes: 120,
    standardBreakMinutes: 45,
    deductionMode: 'actual',
  };

  it('does not treat a gap shorter than the configured minimum as a formal break -- it is bridged into effective time', () => {
    // 10:00 IN, 10:10 OUT, 10:15 IN, 18:00 OUT -- the 5-minute gap is below
    // the 10-minute minimum, so it is not deducted at all.
    const summary = computeSessionsFromPunches(
      [
        { type: 'in', minutes: parseClockToMinutes('10:00') },
        { type: 'out', minutes: parseClockToMinutes('10:10') },
        { type: 'in', minutes: parseClockToMinutes('10:15') },
        { type: 'out', minutes: parseClockToMinutes('18:00') },
      ],
      POLICY,
    );
    expect(summary.grossMinutes).toBe(8 * 60);
    expect(summary.breakMinutes).toBe(0);
    expect(summary.effectiveMinutes).toBe(8 * 60);
    expect(summary.hasExcessBreak).toBe(false);
  });

  it('deducts a gap at or above the minimum as a real break (actual mode)', () => {
    // 10:00 IN, 13:00 OUT, 14:00 IN, 18:30 OUT -- a real 1-hour lunch break.
    const summary = computeSessionsFromPunches(
      [
        { type: 'in', minutes: parseClockToMinutes('10:00') },
        { type: 'out', minutes: parseClockToMinutes('13:00') },
        { type: 'in', minutes: parseClockToMinutes('14:00') },
        { type: 'out', minutes: parseClockToMinutes('18:30') },
      ],
      POLICY,
    );
    expect(summary.grossMinutes).toBe(8 * 60 + 30);
    expect(summary.breakMinutes).toBe(60);
    expect(summary.effectiveMinutes).toBe(7 * 60 + 30);
    expect(summary.hasExcessBreak).toBe(false);
  });

  it('flags an excess break once a qualifying gap exceeds the configured maximum, without inventing effective time for it', () => {
    // A 3-hour break against a 2-hour (120 min) maximum.
    const summary = computeSessionsFromPunches(
      [
        { type: 'in', minutes: parseClockToMinutes('09:00') },
        { type: 'out', minutes: parseClockToMinutes('12:00') },
        { type: 'in', minutes: parseClockToMinutes('15:00') },
        { type: 'out', minutes: parseClockToMinutes('18:00') },
      ],
      POLICY,
    );
    expect(summary.breakMinutes).toBe(3 * 60);
    expect(summary.effectiveMinutes).toBe(6 * 60);
    expect(summary.hasExcessBreak).toBe(true);
  });

  it('deducts a flat standard duration instead of the actual gap when deductionMode is "standard"', () => {
    const standardPolicy: BreakPolicy = { ...POLICY, deductionMode: 'standard' };
    // Actual gap is 90 minutes, but policy always deducts the standard 45.
    const summary = computeSessionsFromPunches(
      [
        { type: 'in', minutes: parseClockToMinutes('10:00') },
        { type: 'out', minutes: parseClockToMinutes('13:00') },
        { type: 'in', minutes: parseClockToMinutes('14:30') },
        { type: 'out', minutes: parseClockToMinutes('18:30') },
      ],
      standardPolicy,
    );
    expect(summary.breakMinutes).toBe(45);
    expect(summary.effectiveMinutes).toBe(summary.grossMinutes - 45);
  });

  it('deducts nothing under standard mode when no qualifying break occurred at all', () => {
    const standardPolicy: BreakPolicy = { ...POLICY, deductionMode: 'standard' };
    // The only gap (5 min) is below the minimum, so no break happened.
    const summary = computeSessionsFromPunches(
      [
        { type: 'in', minutes: parseClockToMinutes('10:00') },
        { type: 'out', minutes: parseClockToMinutes('10:10') },
        { type: 'in', minutes: parseClockToMinutes('10:15') },
        { type: 'out', minutes: parseClockToMinutes('18:00') },
      ],
      standardPolicy,
    );
    expect(summary.breakMinutes).toBe(0);
    expect(summary.effectiveMinutes).toBe(summary.grossMinutes);
  });

  it('end-to-end worked example: 10:00 IN, 13:00 OUT, 14:00 IN, 20:00 OUT against a 09:00 requirement', () => {
    // Gross 10:00, Break 01:00 (a real qualifying lunch break, under the
    // shift's default 120-min max, so not flagged), Effective 09:00,
    // Shortfall 00:00, Excess 00:00.
    const defaultShiftPolicy: BreakPolicy = { minBreakMinutes: 10, maxBreakMinutes: 120, standardBreakMinutes: 60, deductionMode: 'actual' };
    const summary = computeSessionsFromPunches(
      [
        { type: 'in', minutes: parseClockToMinutes('10:00') },
        { type: 'out', minutes: parseClockToMinutes('13:00') },
        { type: 'in', minutes: parseClockToMinutes('14:00') },
        { type: 'out', minutes: parseClockToMinutes('20:00') },
      ],
      defaultShiftPolicy,
    );
    expect(summary.grossMinutes).toBe(10 * 60);
    expect(summary.breakMinutes).toBe(60);
    expect(summary.effectiveMinutes).toBe(9 * 60);
    expect(summary.hasExcessBreak).toBe(false);

    const { shortfallMinutes, excessStayMinutes } = deriveShortfallAndExcess(summary.effectiveMinutes, 9 * 60);
    expect(shortfallMinutes).toBe(0);
    expect(excessStayMinutes).toBe(0);
  });
});

describe('derivePayableMinutes — paid vs unpaid break', () => {
  it('does not add break time back for an unpaid break', () => {
    expect(derivePayableMinutes(450, 60, false)).toBe(450);
  });

  it('adds break time back for a paid break, so it still counts toward required hours', () => {
    expect(derivePayableMinutes(450, 60, true)).toBe(510);
  });
});

describe('overnight shift handling', () => {
  it('flags a shift whose end clock time is earlier than its start as overnight', () => {
    expect(isOvernightShift(NIGHT_SHIFT)).toBe(true);
    expect(isOvernightShift(GENERAL_SHIFT)).toBe(false);
  });

  it('normalizes the shift end to fall after the start (06:00 -> 30:00)', () => {
    expect(normalizedShiftEndMinutes(NIGHT_SHIFT)).toBe(parseClockToMinutes('06:00') + 24 * 60);
  });

  it('treats 22:00 -> 06:00 as an 8-hour shift, not a negative duration', () => {
    const metrics = computeAttendanceMetrics({
      shift: NIGHT_SHIFT,
      checkInMinutes: parseClockToMinutes('22:00'),
      checkOutMinutes: parseClockToMinutes('06:00'),
      requiredShiftMinutes: 8 * 60,
    });
    expect(metrics.effectiveMinutes).toBe(8 * 60);
    expect(metrics.effectiveMinutes).toBeGreaterThan(0);
    expect(metrics.shortfallMinutes).toBe(0);
  });

  it('rolls a post-midnight checkout forward before diffing against check-in', () => {
    // Checked in 22:10, checked out 06:20 the next morning.
    const checkIn = parseClockToMinutes('22:10');
    const checkOut = normalizedPunchMinutes(parseClockToMinutes('06:20'), checkIn);
    expect(checkOut).toBeGreaterThan(checkIn);
    expect(checkOut - checkIn).toBe(8 * 60 + 10);
  });
});

describe('missing punch', () => {
  it('is treated as absent when either check-in or check-out is missing', () => {
    expect(
      determineDayStatus({
        isWeekoff: false,
        isHoliday: false,
        hasCheckIn: true,
        hasCheckOut: false,
        effectiveMinutes: 0,
      }),
    ).toBe('absent');

    expect(
      determineDayStatus({
        isWeekoff: false,
        isHoliday: false,
        hasCheckIn: false,
        hasCheckOut: false,
        effectiveMinutes: 0,
      }),
    ).toBe('absent');
  });
});

describe('determineDayStatus — non-working / override days', () => {
  it('marks weekoffs regardless of punches', () => {
    expect(
      determineDayStatus({ isWeekoff: true, isHoliday: false, hasCheckIn: false, hasCheckOut: false, effectiveMinutes: 0 }),
    ).toBe('weekoff');
  });

  it('marks holidays regardless of punches', () => {
    expect(
      determineDayStatus({ isWeekoff: false, isHoliday: true, hasCheckIn: false, hasCheckOut: false, effectiveMinutes: 0 }),
    ).toBe('holiday');
  });

  it('marks approved leave days as leave', () => {
    expect(
      determineDayStatus({
        isWeekoff: false,
        isHoliday: false,
        isOnLeave: true,
        hasCheckIn: false,
        hasCheckOut: false,
        effectiveMinutes: 0,
      }),
    ).toBe('leave');
  });

  it('marks permission-only days as permission', () => {
    expect(
      determineDayStatus({
        isWeekoff: false,
        isHoliday: false,
        isPermissionOnly: true,
        hasCheckIn: true,
        hasCheckOut: true,
        effectiveMinutes: 480,
      }),
    ).toBe('permission');
  });

  it('marks a regularized present-correction day as present once both punches exist', () => {
    expect(
      determineDayStatus({
        isWeekoff: false,
        isHoliday: false,
        hasCheckIn: true,
        hasCheckOut: true,
        effectiveMinutes: 540,
      }),
    ).toBe('present');
  });

  it('marks a short effective-hours day as half_day below the cutoff', () => {
    expect(
      determineDayStatus({
        isWeekoff: false,
        isHoliday: false,
        hasCheckIn: true,
        hasCheckOut: true,
        effectiveMinutes: 200,
      }),
    ).toBe('half_day');
  });
});

// ============================================================
// evaluateAttendanceDay — the centralized attendance calculation service
// ============================================================

const ENGINE_SHIFT: AttendanceEngineShift = {
  startMinutes: parseClockToMinutes('09:30'),
  endMinutes: parseClockToMinutes('18:30'),
  graceMinutes: 15,
  requiredMinutes: 9 * 60,
  halfDayMinutes: 4.5 * 60,
};

const NIGHT_ENGINE_SHIFT: AttendanceEngineShift = {
  startMinutes: parseClockToMinutes('22:00'),
  endMinutes: parseClockToMinutes('06:00'),
  graceMinutes: 10,
  requiredMinutes: 8 * 60,
  halfDayMinutes: 4 * 60,
};

function baseEngineInput(overrides: Partial<AttendanceEngineInput> = {}): AttendanceEngineInput {
  return {
    employeeId: 'emp-1',
    date: '2026-08-18',
    shift: ENGINE_SHIFT,
    punches: [],
    approvedLeave: false,
    approvedWfh: false,
    approvedOnDuty: false,
    approvedPermission: false,
    isHoliday: false,
    isWeeklyOff: false,
    ...overrides,
  };
}

describe('evaluateAttendanceDay — 1. one IN + one OUT', () => {
  it('computes a normal full day from a single punch pair', () => {
    const result = evaluateAttendanceDay(
      baseEngineInput({
        punches: [
          { type: 'in', minutes: parseClockToMinutes('09:30') },
          { type: 'out', minutes: parseClockToMinutes('18:30') },
        ],
      }),
    );
    expect(result.attendanceStatus).toBe('present');
    expect(result.firstIn).toBe('09:30');
    expect(result.lastOut).toBe('18:30');
    expect(result.grossHours).toBe('09:00');
    expect(result.effectiveHours).toBe('09:00');
    expect(result.shortfallHours).toBe('00:00');
    expect(result.excessStayHours).toBe('00:00');
    expect(result.missingIn).toBe(false);
    expect(result.missingOut).toBe(false);
    expect(result.regularizationStatus).toBe('none');
  });
});

describe('evaluateAttendanceDay — 2. multiple IN/OUT sessions', () => {
  it('sums sessions, not first-in to final-out, using the shift default break policy', () => {
    const result = evaluateAttendanceDay(
      baseEngineInput({
        punches: [
          { type: 'in', minutes: parseClockToMinutes('10:00') },
          { type: 'out', minutes: parseClockToMinutes('11:00') },
          { type: 'in', minutes: parseClockToMinutes('11:15') },
          { type: 'out', minutes: parseClockToMinutes('18:30') },
        ],
        breakPolicy: { minBreakMinutes: 0, maxBreakMinutes: Infinity, standardBreakMinutes: 0, deductionMode: 'actual' },
      }),
    );
    expect(result.firstIn).toBe('10:00');
    expect(result.lastOut).toBe('18:30');
    expect(result.grossHours).toBe('08:30');
    expect(result.breakHours).toBe('00:15');
    expect(result.effectiveHours).toBe('08:15');
  });
});

describe('evaluateAttendanceDay — 3. missing OUT', () => {
  it('flags missingOut and does not credit the unclosed session', () => {
    const result = evaluateAttendanceDay(baseEngineInput({ punches: [{ type: 'in', minutes: parseClockToMinutes('09:30') }] }));
    expect(result.missingOut).toBe(true);
    expect(result.missingIn).toBe(false);
    expect(result.firstIn).toBe('09:30');
    expect(result.lastOut).toBeNull();
    expect(result.effectiveHours).toBe('00:00');
  });
});

describe('evaluateAttendanceDay — 4. missing IN', () => {
  it('flags missingIn for an orphan OUT with no IN punch at all', () => {
    const result = evaluateAttendanceDay(baseEngineInput({ punches: [{ type: 'out', minutes: parseClockToMinutes('18:30') }] }));
    expect(result.missingIn).toBe(true);
    expect(result.missingOut).toBe(false);
    expect(result.firstIn).toBeNull();
    expect(result.lastOut).toBe('18:30');
    expect(result.effectiveHours).toBe('00:00');
  });
});

describe('evaluateAttendanceDay — 5. duplicate IN', () => {
  it('ignores a duplicate consecutive IN, keeping the earlier one open', () => {
    const result = evaluateAttendanceDay(
      baseEngineInput({
        punches: [
          { type: 'in', minutes: parseClockToMinutes('09:30') },
          { type: 'in', minutes: parseClockToMinutes('09:45') },
          { type: 'out', minutes: parseClockToMinutes('18:30') },
        ],
      }),
    );
    expect(result.firstIn).toBe('09:30');
    expect(result.effectiveHours).toBe('09:00');
    expect(result.missingIn).toBe(false);
    expect(result.missingOut).toBe(false);
  });
});

describe('evaluateAttendanceDay — 6. duplicate OUT', () => {
  it('ignores a spurious extra OUT after a session already closed', () => {
    const result = evaluateAttendanceDay(
      baseEngineInput({
        punches: [
          { type: 'in', minutes: parseClockToMinutes('09:30') },
          { type: 'out', minutes: parseClockToMinutes('18:30') },
          { type: 'out', minutes: parseClockToMinutes('18:35') }, // duplicate/spurious
        ],
      }),
    );
    expect(result.effectiveHours).toBe('09:00');
    expect(result.lastOut).toBe('18:35'); // last OUT seen still updates for display
    expect(result.missingOut).toBe(false);
  });
});

describe('evaluateAttendanceDay — 7. IN after OUT (invalid/out-of-order sequence)', () => {
  it('ignores a leading orphan OUT that precedes any IN, without corrupting the real session', () => {
    const result = evaluateAttendanceDay(
      baseEngineInput({
        punches: [
          { type: 'out', minutes: parseClockToMinutes('08:00') }, // stray, precedes any real IN
          { type: 'in', minutes: parseClockToMinutes('09:30') },
          { type: 'out', minutes: parseClockToMinutes('18:30') },
        ],
      }),
    );
    expect(result.effectiveHours).toBe('09:00');
    expect(result.missingIn).toBe(false); // a real IN did eventually occur
    expect(result.attendanceStatus).toBe('present');
  });
});

describe('evaluateAttendanceDay — 8. overnight shift', () => {
  it('treats 22:00 -> 06:00 (next day, pre-normalized) as an 8-hour day, not negative', () => {
    const result = evaluateAttendanceDay(
      baseEngineInput({
        shift: NIGHT_ENGINE_SHIFT,
        punches: [
          { type: 'in', minutes: parseClockToMinutes('22:00') },
          { type: 'out', minutes: parseClockToMinutes('06:00') + 24 * 60 },
        ],
      }),
    );
    expect(result.effectiveHours).toBe('08:00');
    expect(result.shortfallHours).toBe('00:00');
    expect(result.attendanceStatus).toBe('present');
  });
});

describe('evaluateAttendanceDay — 9. exactly required hours', () => {
  it('has zero shortfall and zero excess at exactly 9 hours effective', () => {
    const result = evaluateAttendanceDay(
      baseEngineInput({
        punches: [
          { type: 'in', minutes: parseClockToMinutes('09:30') },
          { type: 'out', minutes: parseClockToMinutes('18:30') },
        ],
      }),
    );
    expect(result.effectiveHours).toBe('09:00');
    expect(result.shortfallHours).toBe('00:00');
    expect(result.excessStayHours).toBe('00:00');
  });
});

describe('evaluateAttendanceDay — 10. less than required hours', () => {
  it('reports a real shortfall', () => {
    const result = evaluateAttendanceDay(
      baseEngineInput({
        punches: [
          { type: 'in', minutes: parseClockToMinutes('09:30') },
          { type: 'out', minutes: parseClockToMinutes('16:30') },
        ],
      }),
    );
    expect(result.effectiveHours).toBe('07:00');
    expect(result.shortfallHours).toBe('02:00');
    expect(result.excessStayHours).toBe('00:00');
    expect(result.attendanceStatus).toBe('present'); // still above the half-day cutoff
  });
});

describe('evaluateAttendanceDay — 11. more than required hours', () => {
  it('reports real excess stay', () => {
    const result = evaluateAttendanceDay(
      baseEngineInput({
        punches: [
          { type: 'in', minutes: parseClockToMinutes('09:30') },
          { type: 'out', minutes: parseClockToMinutes('20:00') },
        ],
      }),
    );
    expect(result.effectiveHours).toBe('10:30');
    expect(result.shortfallHours).toBe('00:00');
    expect(result.excessStayHours).toBe('01:30');
  });
});

describe('evaluateAttendanceDay — 12. approved WFH', () => {
  it('is a full-day override with zero punch-derived hours, not marked absent', () => {
    const result = evaluateAttendanceDay(baseEngineInput({ approvedWfh: true, punches: [] }));
    expect(result.attendanceStatus).not.toBe('absent');
    expect(result.effectiveHours).toBe('00:00');
    expect(result.regularizationStatus).toBe('not_applicable');
  });
});

describe('evaluateAttendanceDay — 13. approved leave', () => {
  it('is a full-day override regardless of any punches present', () => {
    const result = evaluateAttendanceDay(
      baseEngineInput({
        approvedLeave: true,
        punches: [{ type: 'in', minutes: parseClockToMinutes('09:30') }],
      }),
    );
    expect(result.attendanceStatus).toBe('leave');
    expect(result.effectiveHours).toBe('00:00');
  });
});

describe('evaluateAttendanceDay — 14. approved on-duty', () => {
  it('is a full-day override, not marked absent', () => {
    const result = evaluateAttendanceDay(baseEngineInput({ approvedOnDuty: true }));
    expect(result.attendanceStatus).toBe('on_duty');
    expect(result.effectiveHours).toBe('00:00');
  });
});

describe('evaluateAttendanceDay — 15. holiday', () => {
  it('wins over every other status, including real punches', () => {
    const result = evaluateAttendanceDay(
      baseEngineInput({
        isHoliday: true,
        punches: [
          { type: 'in', minutes: parseClockToMinutes('09:30') },
          { type: 'out', minutes: parseClockToMinutes('18:30') },
        ],
      }),
    );
    expect(result.attendanceStatus).toBe('holiday');
    expect(result.effectiveHours).toBe('00:00');
  });
});

describe('evaluateAttendanceDay — 16. weekly off', () => {
  it('is a full-day override', () => {
    const result = evaluateAttendanceDay(baseEngineInput({ isWeeklyOff: true }));
    expect(result.attendanceStatus).toBe('weekoff');
    expect(result.effectiveHours).toBe('00:00');
  });
});

describe('evaluateAttendanceDay — priority order', () => {
  it('holiday wins over weekly off, leave, WFH, and on-duty simultaneously', () => {
    const result = evaluateAttendanceDay(
      baseEngineInput({ isHoliday: true, isWeeklyOff: true, approvedLeave: true, approvedWfh: true, approvedOnDuty: true }),
    );
    expect(result.attendanceStatus).toBe('holiday');
  });

  it('weekly off wins over leave/WFH/on-duty when holiday is false', () => {
    const result = evaluateAttendanceDay(baseEngineInput({ isWeeklyOff: true, approvedLeave: true, approvedWfh: true }));
    expect(result.attendanceStatus).toBe('weekoff');
  });

  it('approved leave wins over WFH/on-duty', () => {
    const result = evaluateAttendanceDay(baseEngineInput({ approvedLeave: true, approvedWfh: true, approvedOnDuty: true }));
    expect(result.attendanceStatus).toBe('leave');
  });
});

describe('evaluateAttendanceDay — approved permission (partial-day, not a full override)', () => {
  it('still computes real hours from punches, only relabeling the status', () => {
    const result = evaluateAttendanceDay(
      baseEngineInput({
        approvedPermission: true,
        punches: [
          { type: 'in', minutes: parseClockToMinutes('09:30') },
          { type: 'out', minutes: parseClockToMinutes('18:30') },
        ],
      }),
    );
    expect(result.attendanceStatus).toBe('permission');
    expect(result.effectiveHours).toBe('09:00');
    expect(result.shortfallHours).toBe('00:00');
  });
});

describe('evaluateAttendanceDay — approved regularization merges as a synthetic punch', () => {
  it('fills in a missing OUT via the approved regularization, composing with the real IN punch', () => {
    const result = evaluateAttendanceDay(
      baseEngineInput({
        punches: [{ type: 'in', minutes: parseClockToMinutes('09:30') }],
        approvedRegularization: { checkOutMinutes: parseClockToMinutes('18:30') },
      }),
    );
    expect(result.missingOut).toBe(false);
    expect(result.effectiveHours).toBe('09:00');
    expect(result.regularizationStatus).toBe('applied');
  });

  it('reports regularizationStatus "none" when no regularization was provided', () => {
    const result = evaluateAttendanceDay(
      baseEngineInput({
        punches: [
          { type: 'in', minutes: parseClockToMinutes('09:30') },
          { type: 'out', minutes: parseClockToMinutes('18:30') },
        ],
      }),
    );
    expect(result.regularizationStatus).toBe('none');
  });
});

describe('evaluateAttendanceDay — absent (no punches, no override)', () => {
  it('is absent when there is nothing at all for the day', () => {
    const result = evaluateAttendanceDay(baseEngineInput({ punches: [] }));
    expect(result.attendanceStatus).toBe('absent');
    expect(result.missingIn).toBe(false);
    expect(result.missingOut).toBe(false);
  });
});

describe('evaluateAttendanceDay — late coming and early going', () => {
  it('reports late coming past shift start + grace', () => {
    const result = evaluateAttendanceDay(
      baseEngineInput({
        punches: [
          { type: 'in', minutes: parseClockToMinutes('10:15') },
          { type: 'out', minutes: parseClockToMinutes('18:30') },
        ],
      }),
    );
    expect(result.lateComing).toBe('00:30'); // 10:15 - (09:30 + 15)
  });

  it('reports early going before shift end', () => {
    const result = evaluateAttendanceDay(
      baseEngineInput({
        punches: [
          { type: 'in', minutes: parseClockToMinutes('09:30') },
          { type: 'out', minutes: parseClockToMinutes('17:00') },
        ],
      }),
    );
    expect(result.earlyGoing).toBe('01:30');
  });
});

describe('evaluateAttendanceDay — worked example against the spec\'s own table', () => {
  it('10:00 IN, 13:00 OUT, 14:00 IN, 20:00 OUT against a 09:00 requirement', () => {
    const result = evaluateAttendanceDay(
      baseEngineInput({
        punches: [
          { type: 'in', minutes: parseClockToMinutes('10:00') },
          { type: 'out', minutes: parseClockToMinutes('13:00') },
          { type: 'in', minutes: parseClockToMinutes('14:00') },
          { type: 'out', minutes: parseClockToMinutes('20:00') },
        ],
        breakPolicy: { minBreakMinutes: 10, maxBreakMinutes: 120, standardBreakMinutes: 60, deductionMode: 'actual' },
      }),
    );
    expect(result.firstIn).toBe('10:00');
    expect(result.lastOut).toBe('20:00');
    expect(result.grossHours).toBe('10:00');
    expect(result.breakHours).toBe('01:00');
    expect(result.effectiveHours).toBe('09:00');
    expect(result.requiredHours).toBe('09:00');
    expect(result.shortfallHours).toBe('00:00');
    expect(result.excessStayHours).toBe('00:00');
  });
});
