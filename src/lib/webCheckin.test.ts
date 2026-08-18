import { describe, it, expect } from 'vitest';
import { deriveWebCheckinAction } from './webCheckin';

describe('deriveWebCheckinAction', () => {
  it('blocks with a HR-contact reason when access is disabled', () => {
    const result = deriveWebCheckinAction({ enabled: false, isWfhToday: true, lastPunchType: null });
    expect(result).toEqual({ canCheckIn: false, canCheckOut: false, blockedReason: 'Web check-in is not enabled for your account. Contact HR.' });
  });

  it('blocks with a WFH-only reason when enabled but today is not an approved WFH day', () => {
    const result = deriveWebCheckinAction({ enabled: true, isWfhToday: false, lastPunchType: null });
    expect(result).toEqual({ canCheckIn: false, canCheckOut: false, blockedReason: 'Available only on an approved Work From Home day.' });
  });

  it('allows Check In when enabled, WFH today, and no punch yet', () => {
    const result = deriveWebCheckinAction({ enabled: true, isWfhToday: true, lastPunchType: null });
    expect(result).toEqual({ canCheckIn: true, canCheckOut: false, blockedReason: null });
  });

  it('allows only Check Out after the last punch was an in', () => {
    const result = deriveWebCheckinAction({ enabled: true, isWfhToday: true, lastPunchType: 'in' });
    expect(result).toEqual({ canCheckIn: false, canCheckOut: true, blockedReason: null });
  });

  it('allows Check In again after the last punch was an out', () => {
    const result = deriveWebCheckinAction({ enabled: true, isWfhToday: true, lastPunchType: 'out' });
    expect(result).toEqual({ canCheckIn: true, canCheckOut: false, blockedReason: null });
  });

  it('disabled access takes priority over the WFH check', () => {
    const result = deriveWebCheckinAction({ enabled: false, isWfhToday: false, lastPunchType: null });
    expect(result.blockedReason).toBe('Web check-in is not enabled for your account. Contact HR.');
  });
});
