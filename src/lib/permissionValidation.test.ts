import { describe, expect, it } from 'vitest';
import { validatePermissionRequest } from './permissionValidation';

function baseInput(overrides: Partial<Parameters<typeof validatePermissionRequest>[0]> = {}) {
  return {
    permissionDate: '2026-08-17',
    fromTime: '10:00',
    toTime: '11:00',
    existingRequests: [],
    ...overrides,
  };
}

describe('validatePermissionRequest', () => {
  it('accepts a request with no conflicts', () => {
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
});
