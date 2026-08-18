import { describe, expect, it } from 'vitest';
import { validatePermissionRequest } from './permissionValidation';

function baseInput(overrides: Partial<Parameters<typeof validatePermissionRequest>[0]> = {}) {
  return {
    permissionDate: '2026-08-17',
    fromTime: '10:00',
    toTime: '11:00',
    requestedMinutes: 60,
    availableBalanceMinutes: 180,
    existingRequests: [],
    ...overrides,
  };
}

describe('validatePermissionRequest', () => {
  it('accepts a request with no conflicts and sufficient balance', () => {
    const result = validatePermissionRequest(baseInput());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('flags an overlapping active request on the same date', () => {
    const result = validatePermissionRequest(
      baseInput({
        existingRequests: [{ permissionDate: '2026-08-17', fromTime: '10:30', toTime: '11:30', status: 'pending' }],
      }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.toLowerCase().includes('overlap') || e.toLowerCase().includes('window'))).toBe(true);
  });

  it('allows back-to-back (touching, not overlapping) requests', () => {
    const result = validatePermissionRequest(
      baseInput({
        existingRequests: [{ permissionDate: '2026-08-17', fromTime: '09:00', toTime: '10:00', status: 'approved' }],
      }),
    );
    expect(result.valid).toBe(true);
  });

  it('ignores an overlapping request on a different date', () => {
    const result = validatePermissionRequest(
      baseInput({
        existingRequests: [{ permissionDate: '2026-08-18', fromTime: '10:00', toTime: '11:00', status: 'pending' }],
      }),
    );
    expect(result.valid).toBe(true);
  });

  it('ignores an overlapping request that was rejected or cancelled', () => {
    const result = validatePermissionRequest(
      baseInput({
        existingRequests: [
          { permissionDate: '2026-08-17', fromTime: '10:00', toTime: '11:00', status: 'rejected' },
          { permissionDate: '2026-08-17', fromTime: '10:00', toTime: '11:00', status: 'cancelled' },
        ],
      }),
    );
    expect(result.valid).toBe(true);
  });

  // PERM-BAL-008: insufficient balance
  it('flags a request that exceeds the available monthly balance', () => {
    const result = validatePermissionRequest(baseInput({ requestedMinutes: 200, availableBalanceMinutes: 180 }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.toLowerCase().includes('insufficient'))).toBe(true);
  });

  // PERM-BAL-009: exact balance is allowed (not "more than")
  it('allows a request that exactly matches the available balance', () => {
    const result = validatePermissionRequest(baseInput({ requestedMinutes: 180, availableBalanceMinutes: 180 }));
    expect(result.valid).toBe(true);
  });

  it('formats the insufficient-balance error as HH:MM, not decimal hours', () => {
    const result = validatePermissionRequest(baseInput({ requestedMinutes: 90, availableBalanceMinutes: 30 }));
    expect(result.errors.some((e) => e.includes('01:30') && e.includes('00:30'))).toBe(true);
    expect(result.errors.some((e) => e.includes('1.5') || e.includes('0.5'))).toBe(false);
  });

  // No balance row yet (e.g. new employee) — callers pass 0, which blocks
  // any non-zero request, matching leaveValidation's `balance?.balance ?? 0`.
  it('treats a missing balance (0) as blocking, not unlimited', () => {
    const result = validatePermissionRequest(baseInput({ requestedMinutes: 30, availableBalanceMinutes: 0 }));
    expect(result.valid).toBe(false);
  });
});
