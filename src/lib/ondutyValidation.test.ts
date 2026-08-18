import { describe, expect, it } from 'vitest';
import { validateOndutyRequest } from './ondutyValidation';

function baseInput(overrides: Partial<Parameters<typeof validateOndutyRequest>[0]> = {}) {
  return {
    fromDate: '2026-08-17',
    toDate: '2026-08-17',
    existingRequests: [],
    ...overrides,
  };
}

describe('validateOndutyRequest', () => {
  it('accepts a valid request with no conflicts', () => {
    const result = validateOndutyRequest(baseInput());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects toDate before fromDate', () => {
    const result = validateOndutyRequest(baseInput({ fromDate: '2026-08-20', toDate: '2026-08-18' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.toLowerCase().includes('to date'))).toBe(true);
  });

  it('flags an overlap with an existing active request', () => {
    const result = validateOndutyRequest(
      baseInput({
        fromDate: '2026-08-17',
        toDate: '2026-08-19',
        existingRequests: [{ fromDate: '2026-08-18', toDate: '2026-08-18', status: 'pending' }],
      }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.toLowerCase().includes('overlap') || e.toLowerCase().includes('already covers'))).toBe(true);
  });

  it('ignores overlap with a rejected or cancelled request', () => {
    const result = validateOndutyRequest(
      baseInput({
        existingRequests: [
          { fromDate: '2026-08-17', toDate: '2026-08-17', status: 'rejected' },
          { fromDate: '2026-08-17', toDate: '2026-08-17', status: 'cancelled' },
        ],
      }),
    );
    expect(result.valid).toBe(true);
  });

  it('ignores a non-overlapping request', () => {
    const result = validateOndutyRequest(
      baseInput({ existingRequests: [{ fromDate: '2026-09-01', toDate: '2026-09-02', status: 'approved' }] }),
    );
    expect(result.valid).toBe(true);
  });
});
