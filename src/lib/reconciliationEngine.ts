// Pure attendance-reconciliation logic (spec section 18/compliance).
// Framework-free, same TS-mirrors-SQL convention as attendanceCalc.ts and
// emailEngine.ts: run_attendance_reconciliation() (supabase/migrations/0048)
// is the live server-side scan; this file is the tested mirror of the
// classification rules it applies, plus punch-anomaly detection that isn't
// re-derived in SQL a third time (the UI already fetches the same punches
// for Raw In/Out Records -- see useRawPunches()).

import type { Punch } from './attendanceCalc';

export interface PunchAnomalies {
  /** Two IN punches in a row, or two OUT punches in a row, with nothing closing/opening between them. */
  hasDuplicatePunch: boolean;
  /** The day's punch sequence doesn't start with an IN (e.g. an OUT with no preceding IN at all). */
  hasInvalidSequence: boolean;
}

export function detectPunchAnomalies(punches: Punch[]): PunchAnomalies {
  const sorted = [...punches].sort((a, b) => a.minutes - b.minutes);
  if (sorted.length === 0) {
    return { hasDuplicatePunch: false, hasInvalidSequence: false };
  }

  let hasDuplicatePunch = false;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].type === sorted[i - 1].type) hasDuplicatePunch = true;
  }

  return { hasDuplicatePunch, hasInvalidSequence: sorted[0].type === 'out' };
}

export type ReconciliationMismatchType =
  | 'biometric_present_but_leave'
  | 'wfh_with_biometric_present'
  | 'unexplained_absence'
  | 'onduty_marked_absent'
  | 'missing_in'
  | 'missing_out'
  | 'duplicate_punch'
  | 'invalid_punch_sequence';

export interface ReconciliationInput {
  hasBiometricPunches: boolean;
  dayStatus: string | null;
  missingIn: boolean;
  missingOut: boolean;
  approvedLeave: boolean;
  approvedWfh: boolean;
  approvedOnDuty: boolean;
  isHoliday: boolean;
  isWeeklyOff: boolean;
  punchAnomalies?: PunchAnomalies;
}

/**
 * Mirrors run_attendance_reconciliation()'s per-day classification exactly
 * (same conditions, same order). A day can raise more than one finding --
 * e.g. a WFH day with real punches AND a missing OUT is both
 * 'wfh_with_biometric_present' and 'missing_out'.
 */
export function detectReconciliationMismatches(input: ReconciliationInput): ReconciliationMismatchType[] {
  const mismatches: ReconciliationMismatchType[] = [];

  if (input.hasBiometricPunches && input.approvedLeave) {
    mismatches.push('biometric_present_but_leave');
  }
  if (input.hasBiometricPunches && input.approvedWfh) {
    mismatches.push('wfh_with_biometric_present');
  }
  if (input.approvedOnDuty && input.dayStatus === 'absent') {
    mismatches.push('onduty_marked_absent');
  }
  if (
    !input.hasBiometricPunches &&
    !input.approvedLeave &&
    !input.approvedWfh &&
    !input.approvedOnDuty &&
    !input.isHoliday &&
    !input.isWeeklyOff &&
    (input.dayStatus === 'absent' || input.dayStatus === null || input.dayStatus === 'no_record')
  ) {
    mismatches.push('unexplained_absence');
  }
  if (input.missingIn) mismatches.push('missing_in');
  if (input.missingOut) mismatches.push('missing_out');
  if (input.punchAnomalies?.hasDuplicatePunch) mismatches.push('duplicate_punch');
  if (input.punchAnomalies?.hasInvalidSequence) mismatches.push('invalid_punch_sequence');

  return mismatches;
}
