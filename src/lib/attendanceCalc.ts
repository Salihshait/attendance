// Pure attendance-rule calculations (spec section 2). Kept framework-free so
// they can run both in the browser (live previews in the regularization
// form) and under Vitest without any Supabase/React setup. The seed
// generator (supabase/seed/seed.sql) implements the same rules in PL/pgSQL
// for bulk demo-data generation — these are the reusable, testable source
// of truth for anything computed client-side.

export interface ShiftWindow {
  /** Minutes since midnight, e.g. 09:30 -> 570 */
  startMinutes: number;
  /** Minutes since midnight. May be <= startMinutes for an overnight shift. */
  endMinutes: number;
  graceMinutes?: number;
}

/**
 * Minutes since midnight for a shift end, normalized so overnight shifts
 * (e.g. 22:00 -> 06:00) always read as a later instant than the start
 * instead of wrapping to a negative/tiny duration.
 */
export function normalizedShiftEndMinutes(shift: ShiftWindow): number {
  return shift.endMinutes <= shift.startMinutes ? shift.endMinutes + 24 * 60 : shift.endMinutes;
}

export function isOvernightShift(shift: ShiftWindow): boolean {
  return shift.endMinutes <= shift.startMinutes;
}

/**
 * Minutes-since-midnight for a check-in/check-out instant, relative to the
 * shift's start day. For an overnight shift, a check-out that falls after
 * midnight (a smaller clock time than check-in) is rolled forward by 24h so
 * arithmetic against the normalized shift window stays positive — this is
 * the "10 PM -> 6 AM must be 8 hours, not negative" rule.
 */
export function normalizedPunchMinutes(punchMinutes: number, referenceMinutes: number): number {
  return punchMinutes < referenceMinutes ? punchMinutes + 24 * 60 : punchMinutes;
}

export interface AttendanceMetrics {
  effectiveMinutes: number;
  lateMinutes: number;
  earlyGoingMinutes: number;
  excessStayMinutes: number;
  shortfallMinutes: number;
}

/**
 * Effective Hours = Checkout - Checkin.
 * Excess Stay = Effective Hours - Required Shift Hours (floored at 0).
 * Shortfall = Required Shift Hours - Effective Hours (floored at 0).
 * Late = Actual Check-in - Shift Start (floored at 0, after grace).
 * Early Going = Shift End - Actual Checkout (floored at 0).
 */
export function computeAttendanceMetrics(params: {
  shift: ShiftWindow;
  checkInMinutes: number;
  checkOutMinutes: number;
  requiredShiftMinutes: number;
}): AttendanceMetrics {
  const { shift, requiredShiftMinutes } = params;
  const grace = shift.graceMinutes ?? 0;
  const shiftStart = shift.startMinutes;
  const shiftEnd = normalizedShiftEndMinutes(shift);

  const checkIn = normalizedPunchMinutes(params.checkInMinutes, shiftStart);
  const checkOut = normalizedPunchMinutes(params.checkOutMinutes, checkIn);

  const effectiveMinutes = Math.max(0, checkOut - checkIn);
  const lateMinutes = Math.max(0, checkIn - (shiftStart + grace));
  const earlyGoingMinutes = Math.max(0, shiftEnd - checkOut);
  const excessStayMinutes = Math.max(0, checkOut - shiftEnd);
  const shortfallMinutes = Math.max(0, requiredShiftMinutes - effectiveMinutes);

  return { effectiveMinutes, lateMinutes, earlyGoingMinutes, excessStayMinutes, shortfallMinutes };
}

export function parseClockToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export type DayStatus =
  | 'present'
  | 'half_day'
  | 'absent'
  | 'weekoff'
  | 'holiday'
  | 'leave'
  | 'on_duty'
  | 'permission';

/**
 * Mirrors the priority order the seed generator uses to decide a day's
 * status: weekoff/holiday/leave/on_duty/permission override any punches,
 * a day with no punches at all is absent, and a day with punches is
 * present or half_day depending on effective hours vs. a half-day cutoff.
 */
export function determineDayStatus(input: {
  isWeekoff: boolean;
  isHoliday: boolean;
  isOnLeave?: boolean;
  isOnDuty?: boolean;
  isPermissionOnly?: boolean;
  hasCheckIn: boolean;
  hasCheckOut: boolean;
  effectiveMinutes: number;
  halfDayCutoffMinutes?: number;
}): DayStatus {
  if (input.isWeekoff) return 'weekoff';
  if (input.isHoliday) return 'holiday';
  if (input.isOnLeave) return 'leave';
  if (input.isOnDuty) return 'on_duty';
  if (input.isPermissionOnly) return 'permission';
  if (!input.hasCheckIn || !input.hasCheckOut) return 'absent';
  const cutoff = input.halfDayCutoffMinutes ?? 300;
  return input.effectiveMinutes < cutoff ? 'half_day' : 'present';
}
