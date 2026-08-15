import { describe, expect, it } from 'vitest';
import {
  computeAttendanceMetrics,
  determineDayStatus,
  isOvernightShift,
  normalizedPunchMinutes,
  normalizedShiftEndMinutes,
  parseClockToMinutes,
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
