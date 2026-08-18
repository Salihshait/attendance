// Pure attendance-rule calculations (spec section 2). Kept framework-free so
// they can run both in the browser (live previews in the regularization
// form) and under Vitest without any Supabase/React setup. The seed
// generator (supabase/seed/seed.sql) implements the same rules in PL/pgSQL
// for bulk demo-data generation — these are the reusable, testable source
// of truth for anything computed client-side.
//
// evaluateAttendanceDay() at the bottom of this file is the single
// centralized entry point (spec: "one reusable attendance service") that
// composes everything above with the leave/WFH/on-duty/holiday/weekly-off
// priority order and regularization merging — pages/hooks should call it or
// read the equivalent server-computed columns, not reimplement any of this.

import { formatHoursMinutes } from './dateFormat';

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
 * Excess Stay = Effective Hours - Required Working Hours (floored at 0).
 * Shortfall = Required Working Hours - Effective Hours (floored at 0).
 * The single shared formula for both -- used whether effective minutes came
 * from a single check-in/check-out pair (computeAttendanceMetrics) or from
 * summing multiple sessions (computeSessionsFromPunches), so there's one
 * place this arithmetic lives instead of it drifting between the two.
 */
export function deriveShortfallAndExcess(
  effectiveMinutes: number,
  requiredMinutes: number,
): { shortfallMinutes: number; excessStayMinutes: number } {
  return {
    shortfallMinutes: Math.max(0, requiredMinutes - effectiveMinutes),
    excessStayMinutes: Math.max(0, effectiveMinutes - requiredMinutes),
  };
}

/**
 * Effective Hours = Checkout - Checkin.
 * Late = Actual Check-in - Shift Start (floored at 0, after grace).
 * Early Going = Shift End - Actual Checkout (floored at 0).
 * Excess Stay / Shortfall: see deriveShortfallAndExcess.
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
  const { shortfallMinutes, excessStayMinutes } = deriveShortfallAndExcess(effectiveMinutes, requiredShiftMinutes);

  return { effectiveMinutes, lateMinutes, earlyGoingMinutes, excessStayMinutes, shortfallMinutes };
}

export interface Punch {
  type: 'in' | 'out';
  /** Minutes since midnight of the attendance day; may exceed 1440 for a punch that rolls into the next calendar day (already normalized by the caller). */
  minutes: number;
}

export interface BreakPolicy {
  /** A gap between two sessions shorter than this is not a formal break -- it's bridged into effective time instead (e.g. a 5-minute gap isn't a lunch break). */
  minBreakMinutes: number;
  /** A gap longer than this doesn't change the arithmetic -- it's still fully excluded from effective time either way -- but sets hasExcessBreak so it can be flagged for review. */
  maxBreakMinutes: number;
  /** Only used when deductionMode = 'standard'. */
  standardBreakMinutes: number;
  /** 'actual': deduct the real measured gap(s). 'standard': once any qualifying break occurs, deduct exactly standardBreakMinutes regardless of how long the gap(s) actually were. */
  deductionMode: 'actual' | 'standard';
}

/** No minimum/maximum, deduct the exact measured gap -- i.e. "every gap is a break," the old default before break policy became configurable. Callers should normally pass a real shift-derived policy instead. */
export const DEFAULT_BREAK_POLICY: BreakPolicy = {
  minBreakMinutes: 0,
  maxBreakMinutes: Infinity,
  standardBreakMinutes: 0,
  deductionMode: 'actual',
};

export interface SessionSummary {
  /** grossMinutes - breakMinutes. Sub-minimum gaps are folded in here (bridged), not treated as break. */
  effectiveMinutes: number;
  /** Last OUT seen minus first IN seen (0 if either is missing). */
  grossMinutes: number;
  /** The break actually deducted, per breakPolicy -- not simply "every gap." */
  breakMinutes: number;
  /** At least one qualifying gap exceeded breakPolicy.maxBreakMinutes. */
  hasExcessBreak: boolean;
  firstInMinutes: number | null;
  lastOutMinutes: number | null;
  /** An OUT punch exists but no IN punch was ever seen. */
  missingIn: boolean;
  /** The last IN punch was never closed by a matching OUT. */
  missingOut: boolean;
}

/**
 * Mirrors recompute_attendance_day()'s punch-pairing logic (supabase
 * migrations 0044+): walks punches in time order pairing sequential
 * in->out. A second consecutive 'in' before a matching 'out' is a duplicate
 * (ignored -- the earlier 'in' stays open); an 'out' with no open 'in' is an
 * orphan/invalid-sequence punch (ignored for pairing, but still recorded as
 * the latest "last out seen" for missing-IN detection and display).
 *
 * The gap between two consecutive *closed* sessions is not blindly treated
 * as break: it's classified against breakPolicy first (0045+) -- too short
 * to be a formal break gets folded back into effective time; a qualifying
 * gap is deducted either as measured or as a flat standard duration,
 * depending on deductionMode; an unusually long gap is flagged rather than
 * silently absorbed. gross = effective + break always holds by construction
 * (grossMinutes - breakMinutes defines effectiveMinutes), so a short bridged
 * gap simply never becomes part of breakMinutes in the first place.
 */
export function computeSessionsFromPunches(punches: Punch[], breakPolicy: BreakPolicy = DEFAULT_BREAK_POLICY): SessionSummary {
  const sorted = [...punches].sort((a, b) => a.minutes - b.minutes);

  let openInMinutes: number | null = null;
  let firstInMinutes: number | null = null;
  let lastOutMinutes: number | null = null;
  let prevSessionCloseMinutes: number | null = null;
  let measuredBreakMinutes = 0;
  let hasExcessBreak = false;

  for (const punch of sorted) {
    if (punch.type === 'in') {
      if (firstInMinutes === null) firstInMinutes = punch.minutes;
      if (openInMinutes === null) openInMinutes = punch.minutes;
      // else: duplicate 'in' while one is already open -- ignored.
    } else {
      lastOutMinutes = punch.minutes;
      if (openInMinutes !== null) {
        if (prevSessionCloseMinutes !== null) {
          const gap = openInMinutes - prevSessionCloseMinutes;
          if (gap < breakPolicy.minBreakMinutes) {
            // Too short to be a formal break -- bridged, not deducted.
          } else {
            measuredBreakMinutes += gap;
            if (gap > breakPolicy.maxBreakMinutes) hasExcessBreak = true;
          }
        }
        prevSessionCloseMinutes = punch.minutes;
        openInMinutes = null;
      }
      // else: orphan 'out' with no open 'in' -- ignored for pairing.
    }
  }

  const missingOut = openInMinutes !== null;
  const missingIn = firstInMinutes === null && lastOutMinutes !== null;
  // Gross duration spans to the last punch that actually closed a session,
  // not the raw last OUT seen -- a spurious duplicate OUT after a session
  // is already closed (no open 'in' to close) must not inflate gross/
  // effective time just because it updated the "last out seen" display
  // value. lastOutMinutes itself is left as the raw last punch for display
  // and missing-IN detection.
  const grossMinutes =
    firstInMinutes !== null && prevSessionCloseMinutes !== null ? Math.max(0, prevSessionCloseMinutes - firstInMinutes) : 0;

  const breakMinutes =
    breakPolicy.deductionMode === 'standard'
      ? measuredBreakMinutes > 0
        ? breakPolicy.standardBreakMinutes
        : 0
      : measuredBreakMinutes;

  const effectiveMinutes = Math.max(0, grossMinutes - breakMinutes);

  return { effectiveMinutes, grossMinutes, breakMinutes, hasExcessBreak, firstInMinutes, lastOutMinutes, missingIn, missingOut };
}

/**
 * A paid break doesn't cost the employee credit toward required hours even
 * though it isn't work time -- an unpaid break does. Used instead of raw
 * effectiveMinutes when feeding deriveShortfallAndExcess, so a paid-break
 * policy doesn't manufacture a false shortfall.
 */
export function derivePayableMinutes(effectiveMinutes: number, breakMinutes: number, breakPaid: boolean): number {
  return breakPaid ? effectiveMinutes + breakMinutes : effectiveMinutes;
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

// ============================================================
// Centralized Attendance Calculation Engine
// ============================================================

export type AttendanceStatus = DayStatus;

export interface AttendanceEngineShift {
  /** Minutes since midnight, e.g. 09:30 -> 570. */
  startMinutes: number;
  /** Minutes since midnight. May be <= startMinutes for an overnight shift. */
  endMinutes: number;
  graceMinutes: number;
  /** "Full day" required working minutes. */
  requiredMinutes: number;
  /** Effective-minutes cutoff below which a day with punches is half_day rather than present. */
  halfDayMinutes: number;
}

export interface AttendanceEngineRegularization {
  /** Minutes since midnight of the attendance day; same overnight-rollover convention as Punch.minutes. */
  checkInMinutes?: number | null;
  checkOutMinutes?: number | null;
}

export interface AttendanceEngineInput {
  employeeId: string;
  /** ISO date (YYYY-MM-DD) -- identifies the record; not used in the arithmetic itself. */
  date: string;
  /** null when the employee has no shift assigned. */
  shift: AttendanceEngineShift | null;
  /** Raw IN/OUT punches for the day -- biometric, mobile, web, or manual, indistinguishable to the engine. */
  punches: Punch[];
  approvedLeave: boolean;
  approvedWfh: boolean;
  approvedOnDuty: boolean;
  approvedPermission: boolean;
  isHoliday: boolean;
  isWeeklyOff: boolean;
  /** An approved regularization's corrected punch time(s), merged into `punches` before pairing -- same synthetic-punch approach act_on_approval() uses server-side, so it composes through the identical pairing/break logic as any other punch. */
  approvedRegularization?: AttendanceEngineRegularization | null;
  breakPolicy?: BreakPolicy;
  /** Whether the shift's break is paid -- see derivePayableMinutes. Defaults to unpaid. */
  breakPaid?: boolean;
}

export interface AttendanceEngineResult {
  attendanceStatus: AttendanceStatus;
  /** "HH:MM", or null if no IN punch was ever recorded. */
  firstIn: string | null;
  /** "HH:MM", or null if no OUT punch was ever recorded. */
  lastOut: string | null;
  grossHours: string;
  breakHours: string;
  effectiveHours: string;
  requiredHours: string;
  shortfallHours: string;
  excessStayHours: string;
  lateComing: string;
  earlyGoing: string;
  missingIn: boolean;
  missingOut: boolean;
  /** 'not_applicable' on a full-day override (holiday/weekoff/leave/WFH/on-duty); 'applied' when an approved regularization's punch(es) were merged in; 'none' otherwise. */
  regularizationStatus: 'not_applicable' | 'none' | 'applied';
}

const ENGINE_DEFAULT_REQUIRED_MINUTES = 8 * 60;
const ENGINE_DEFAULT_HALF_DAY_MINUTES = 4.5 * 60;

function overrideResult(status: AttendanceStatus, requiredHours: string): AttendanceEngineResult {
  return {
    attendanceStatus: status,
    firstIn: null,
    lastOut: null,
    grossHours: '00:00',
    breakHours: '00:00',
    effectiveHours: '00:00',
    requiredHours,
    shortfallHours: '00:00',
    excessStayHours: '00:00',
    lateComing: '00:00',
    earlyGoing: '00:00',
    missingIn: false,
    missingOut: false,
    regularizationStatus: 'not_applicable',
  };
}

/**
 * The single centralized attendance calculation service. Composes
 * computeSessionsFromPunches / deriveShortfallAndExcess / derivePayableMinutes
 * above with the leave/WFH/on-duty/holiday/weekly-off priority order and
 * regularization merging, matching supabase/migrations/0044+0045's
 * recompute_attendance_day() (the live server-side source of truth -- this
 * is its tested TS mirror).
 *
 * Priority order -- a full-day override always wins over punches, mirroring
 * recompute_attendance_day()'s guard against ever recomputing an
 * already-overridden day:
 *
 *   Holiday > Weekly Off > Approved Leave > Approved WFH > Approved On-Duty
 *   > punches
 *
 * Approved Permission does NOT suppress punch-based hours -- a permission is
 * a partial-day absence layered on top of an otherwise normal working day,
 * not a full-day override like leave -- so it only relabels the resulting
 * status once hours are already computed from real punches.
 *
 * WFH has no distinct status value in the live schema today (0037 stores it
 * as day_status='present' with a remark) -- matched here rather than
 * inventing one, so this stays a faithful mirror of what's actually live.
 * Approved On-Duty uses the 'on_duty' status value the schema has carried
 * since its first migration.
 */
export function evaluateAttendanceDay(input: AttendanceEngineInput): AttendanceEngineResult {
  const requiredMinutes = input.shift?.requiredMinutes ?? ENGINE_DEFAULT_REQUIRED_MINUTES;
  const requiredHours = formatHoursMinutes(requiredMinutes);

  if (input.isHoliday) return overrideResult('holiday', requiredHours);
  if (input.isWeeklyOff) return overrideResult('weekoff', requiredHours);
  if (input.approvedLeave) return overrideResult('leave', requiredHours);
  if (input.approvedWfh) return overrideResult('present', requiredHours);
  if (input.approvedOnDuty) return overrideResult('on_duty', requiredHours);

  const allPunches = [...input.punches];
  let regularizationApplied = false;
  if (input.approvedRegularization?.checkInMinutes != null) {
    allPunches.push({ type: 'in', minutes: input.approvedRegularization.checkInMinutes });
    regularizationApplied = true;
  }
  if (input.approvedRegularization?.checkOutMinutes != null) {
    allPunches.push({ type: 'out', minutes: input.approvedRegularization.checkOutMinutes });
    regularizationApplied = true;
  }

  const breakPolicy = input.breakPolicy ?? DEFAULT_BREAK_POLICY;
  const session = computeSessionsFromPunches(allPunches, breakPolicy);
  const payableMinutes = derivePayableMinutes(session.effectiveMinutes, session.breakMinutes, input.breakPaid ?? false);
  const { shortfallMinutes, excessStayMinutes } = deriveShortfallAndExcess(payableMinutes, requiredMinutes);

  const halfDayMinutes = input.shift?.halfDayMinutes ?? ENGINE_DEFAULT_HALF_DAY_MINUTES;
  let attendanceStatus: AttendanceStatus;
  if (allPunches.length === 0) {
    attendanceStatus = 'absent';
  } else if (session.effectiveMinutes >= halfDayMinutes) {
    attendanceStatus = 'present';
  } else {
    attendanceStatus = 'half_day';
  }
  if (input.approvedPermission) {
    attendanceStatus = 'permission';
  }

  let lateComingMinutes = 0;
  let earlyGoingMinutes = 0;
  if (input.shift) {
    const shiftEnd = normalizedShiftEndMinutes(input.shift);
    if (session.firstInMinutes !== null) {
      lateComingMinutes = Math.max(0, session.firstInMinutes - (input.shift.startMinutes + input.shift.graceMinutes));
    }
    if (session.lastOutMinutes !== null) {
      earlyGoingMinutes = Math.max(0, shiftEnd - session.lastOutMinutes);
    }
  }

  return {
    attendanceStatus,
    firstIn: session.firstInMinutes !== null ? formatHoursMinutes(session.firstInMinutes) : null,
    lastOut: session.lastOutMinutes !== null ? formatHoursMinutes(session.lastOutMinutes) : null,
    grossHours: formatHoursMinutes(session.grossMinutes),
    breakHours: formatHoursMinutes(session.breakMinutes),
    effectiveHours: formatHoursMinutes(session.effectiveMinutes),
    requiredHours,
    shortfallHours: formatHoursMinutes(shortfallMinutes),
    excessStayHours: formatHoursMinutes(excessStayMinutes),
    lateComing: formatHoursMinutes(lateComingMinutes),
    earlyGoing: formatHoursMinutes(earlyGoingMinutes),
    missingIn: session.missingIn,
    missingOut: session.missingOut,
    regularizationStatus: regularizationApplied ? 'applied' : 'none',
  };
}
