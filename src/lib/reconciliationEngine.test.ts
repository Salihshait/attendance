import { describe, expect, it } from 'vitest';
import { detectPunchAnomalies, detectReconciliationMismatches } from './reconciliationEngine';
import { parseClockToMinutes } from './attendanceCalc';

describe('detectPunchAnomalies', () => {
  it('finds no anomalies for a normal single session', () => {
    const result = detectPunchAnomalies([
      { type: 'in', minutes: parseClockToMinutes('09:30') },
      { type: 'out', minutes: parseClockToMinutes('18:30') },
    ]);
    expect(result).toEqual({ hasDuplicatePunch: false, hasInvalidSequence: false });
  });

  it('finds no anomalies for a normal multi-session day', () => {
    const result = detectPunchAnomalies([
      { type: 'in', minutes: parseClockToMinutes('10:00') },
      { type: 'out', minutes: parseClockToMinutes('11:00') },
      { type: 'in', minutes: parseClockToMinutes('11:15') },
      { type: 'out', minutes: parseClockToMinutes('18:30') },
    ]);
    expect(result).toEqual({ hasDuplicatePunch: false, hasInvalidSequence: false });
  });

  it('flags a duplicate IN', () => {
    const result = detectPunchAnomalies([
      { type: 'in', minutes: parseClockToMinutes('09:30') },
      { type: 'in', minutes: parseClockToMinutes('09:45') },
      { type: 'out', minutes: parseClockToMinutes('18:30') },
    ]);
    expect(result.hasDuplicatePunch).toBe(true);
    expect(result.hasInvalidSequence).toBe(false);
  });

  it('flags a duplicate OUT', () => {
    const result = detectPunchAnomalies([
      { type: 'in', minutes: parseClockToMinutes('09:30') },
      { type: 'out', minutes: parseClockToMinutes('18:30') },
      { type: 'out', minutes: parseClockToMinutes('18:35') },
    ]);
    expect(result.hasDuplicatePunch).toBe(true);
  });

  it('flags an invalid sequence when the day starts with an OUT', () => {
    const result = detectPunchAnomalies([
      { type: 'out', minutes: parseClockToMinutes('08:00') },
      { type: 'in', minutes: parseClockToMinutes('09:30') },
      { type: 'out', minutes: parseClockToMinutes('18:30') },
    ]);
    expect(result.hasInvalidSequence).toBe(true);
    expect(result.hasDuplicatePunch).toBe(false);
  });

  it('reports no anomalies for an empty punch list', () => {
    expect(detectPunchAnomalies([])).toEqual({ hasDuplicatePunch: false, hasInvalidSequence: false });
  });
});

function baseReconciliationInput(overrides: Partial<Parameters<typeof detectReconciliationMismatches>[0]> = {}) {
  return {
    hasBiometricPunches: false,
    dayStatus: 'present',
    missingIn: false,
    missingOut: false,
    approvedLeave: false,
    approvedWfh: false,
    approvedOnDuty: false,
    isHoliday: false,
    isWeeklyOff: false,
    ...overrides,
  };
}

describe('detectReconciliationMismatches', () => {
  it('flags Biometric Present + Leave Approved', () => {
    const mismatches = detectReconciliationMismatches(baseReconciliationInput({ hasBiometricPunches: true, approvedLeave: true, dayStatus: 'leave' }));
    expect(mismatches).toContain('biometric_present_but_leave');
  });

  it('flags WFH + Biometric Present', () => {
    const mismatches = detectReconciliationMismatches(baseReconciliationInput({ hasBiometricPunches: true, approvedWfh: true, dayStatus: 'present' }));
    expect(mismatches).toContain('wfh_with_biometric_present');
  });

  it('flags an approved On-Duty day that still ended up absent', () => {
    const mismatches = detectReconciliationMismatches(baseReconciliationInput({ approvedOnDuty: true, dayStatus: 'absent' }));
    expect(mismatches).toContain('onduty_marked_absent');
  });

  it('flags an unexplained absence with no covering approval, holiday, or weekoff', () => {
    const mismatches = detectReconciliationMismatches(baseReconciliationInput({ hasBiometricPunches: false, dayStatus: 'absent' }));
    expect(mismatches).toContain('unexplained_absence');
  });

  it('does not flag unexplained absence on a holiday', () => {
    const mismatches = detectReconciliationMismatches(baseReconciliationInput({ hasBiometricPunches: false, dayStatus: 'absent', isHoliday: true }));
    expect(mismatches).not.toContain('unexplained_absence');
  });

  it('does not flag unexplained absence on a weekly off', () => {
    const mismatches = detectReconciliationMismatches(baseReconciliationInput({ hasBiometricPunches: false, dayStatus: 'absent', isWeeklyOff: true }));
    expect(mismatches).not.toContain('unexplained_absence');
  });

  it('does not flag unexplained absence when leave/WFH/on-duty actually explains it', () => {
    expect(detectReconciliationMismatches(baseReconciliationInput({ hasBiometricPunches: false, dayStatus: 'leave', approvedLeave: true }))).not.toContain(
      'unexplained_absence',
    );
  });

  it('flags Missing OUT', () => {
    expect(detectReconciliationMismatches(baseReconciliationInput({ missingOut: true }))).toContain('missing_out');
  });

  it('flags Missing IN', () => {
    expect(detectReconciliationMismatches(baseReconciliationInput({ missingIn: true }))).toContain('missing_in');
  });

  it('flags Duplicate Punch via punchAnomalies', () => {
    const mismatches = detectReconciliationMismatches(
      baseReconciliationInput({ punchAnomalies: { hasDuplicatePunch: true, hasInvalidSequence: false } }),
    );
    expect(mismatches).toContain('duplicate_punch');
  });

  it('flags Invalid Punch sequence via punchAnomalies', () => {
    const mismatches = detectReconciliationMismatches(
      baseReconciliationInput({ punchAnomalies: { hasDuplicatePunch: false, hasInvalidSequence: true } }),
    );
    expect(mismatches).toContain('invalid_punch_sequence');
  });

  it('reports no mismatches for a clean, fully-explained present day', () => {
    const mismatches = detectReconciliationMismatches(baseReconciliationInput({ hasBiometricPunches: true, dayStatus: 'present' }));
    expect(mismatches).toEqual([]);
  });

  it('can raise multiple mismatches for the same day', () => {
    const mismatches = detectReconciliationMismatches(
      baseReconciliationInput({
        hasBiometricPunches: true,
        approvedWfh: true,
        missingOut: true,
        dayStatus: 'present',
      }),
    );
    expect(mismatches).toContain('wfh_with_biometric_present');
    expect(mismatches).toContain('missing_out');
  });
});
