import { describe, expect, it } from 'vitest';
import { validateLeaveRequest } from './leaveValidation';

const WEEKOFF = [0, 6]; // Sun, Sat

function baseInput(overrides: Partial<Parameters<typeof validateLeaveRequest>[0]> = {}) {
  return {
    fromDate: '2026-08-17', // Monday
    toDate: '2026-08-17',
    requestedDays: 1,
    availableBalance: 5,
    existingRequests: [],
    holidayDates: new Set<string>(),
    weekoffDayIndexes: WEEKOFF,
    ...overrides,
  };
}

describe('validateLeaveRequest', () => {
  it('accepts a valid request with sufficient balance and no conflicts', () => {
    const result = validateLeaveRequest(baseInput());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('flags insufficient balance', () => {
    const result = validateLeaveRequest(baseInput({ requestedDays: 3, availableBalance: 1 }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.toLowerCase().includes('insufficient'))).toBe(true);
  });

  it('flags an overlapping existing request', () => {
    const result = validateLeaveRequest(
      baseInput({
        existingRequests: [{ fromDate: '2026-08-16', toDate: '2026-08-18', status: 'approved' }],
      }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.toLowerCase().includes('existing leave request'))).toBe(true);
  });

  it('ignores cancelled/rejected requests when checking for overlap', () => {
    const result = validateLeaveRequest(
      baseInput({
        existingRequests: [
          { fromDate: '2026-08-17', toDate: '2026-08-17', status: 'cancelled' },
          { fromDate: '2026-08-17', toDate: '2026-08-17', status: 'rejected' },
        ],
      }),
    );
    expect(result.valid).toBe(true);
  });

  it('flags a range that falls entirely on a holiday', () => {
    const result = validateLeaveRequest(baseInput({ holidayDates: new Set(['2026-08-17']) }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.toLowerCase().includes('holiday'))).toBe(true);
  });

  it('flags a range that falls entirely on a weekoff', () => {
    // 2026-08-15 is a Saturday
    const result = validateLeaveRequest(baseInput({ fromDate: '2026-08-15', toDate: '2026-08-15' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.toLowerCase().includes('weekoff'))).toBe(true);
  });

  it('allows a multi-day range that includes at least one working day', () => {
    // Sat 15 -> Mon 17: includes a working Monday, so it's fine on that rule.
    const result = validateLeaveRequest(baseInput({ fromDate: '2026-08-15', toDate: '2026-08-17', requestedDays: 3 }));
    expect(result.errors.some((e) => e.toLowerCase().includes('weekoff'))).toBe(false);
  });

  it('can report multiple violations at once', () => {
    const result = validateLeaveRequest(
      baseInput({
        requestedDays: 1,
        availableBalance: 0,
        holidayDates: new Set(['2026-08-17']),
      }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });
});
