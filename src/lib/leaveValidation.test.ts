import { describe, expect, it } from 'vitest';
import { validateLeaveRequest, findApplicableLeaveBalance, totalLeaveBalance } from './leaveValidation';

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

describe('findApplicableLeaveBalance', () => {
  const monthlyRows = [
    { leaveTypeId: 'CL', periodStart: '2026-07-01', periodEnd: '2026-07-31', label: 'July' },
    { leaveTypeId: 'CL', periodStart: '2026-08-01', periodEnd: '2026-08-31', label: 'August' },
    { leaveTypeId: 'CL', periodStart: '2026-09-01', periodEnd: '2026-09-30', label: 'September' },
    { leaveTypeId: 'PL', periodStart: '2026-01-01', periodEnd: '2026-12-31', label: 'annual PL' },
  ];

  it('finds the monthly period row containing the given date', () => {
    const result = findApplicableLeaveBalance(monthlyRows, 'CL', '2026-08-17');
    expect(result?.label).toBe('August');
  });

  it('finds the single annual row for a yearly-accrual type regardless of date', () => {
    const result = findApplicableLeaveBalance(monthlyRows, 'PL', '2026-03-01');
    expect(result?.label).toBe('annual PL');
  });

  it('returns undefined when no period covers the date', () => {
    const result = findApplicableLeaveBalance(monthlyRows, 'CL', '2027-01-01');
    expect(result).toBeUndefined();
  });

  it('returns undefined for a leave type with no rows at all', () => {
    const result = findApplicableLeaveBalance(monthlyRows, 'SL', '2026-08-17');
    expect(result).toBeUndefined();
  });
});

describe('totalLeaveBalance', () => {
  const rows = [
    { leaveTypeId: 'CL', periodStart: '2026-07-01', periodEnd: '2026-07-31', balance: 1 },
    { leaveTypeId: 'CL', periodStart: '2026-08-01', periodEnd: '2026-08-31', balance: 0 },
    { leaveTypeId: 'CL', periodStart: '2026-09-01', periodEnd: '2026-09-30', balance: 1 },
    { leaveTypeId: 'PL', periodStart: '2026-01-01', periodEnd: '2026-12-31', balance: 18 },
  ];

  it('sums every period row for a monthly-accrual type, not just the current month', () => {
    // August alone is exhausted (0), but July + September still have 1 each
    // — a request shouldn't be blocked just because August's own slice is spent.
    expect(totalLeaveBalance(rows, 'CL')).toBe(2);
  });

  it('matches the single row for a yearly-accrual type', () => {
    expect(totalLeaveBalance(rows, 'PL')).toBe(18);
  });

  it('returns 0 for a leave type with no rows at all', () => {
    expect(totalLeaveBalance(rows, 'LOP')).toBe(0);
  });
});
