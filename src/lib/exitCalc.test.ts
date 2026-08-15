import { describe, expect, it } from 'vitest';
import { calculateExpectedLastWorkingDate, clearanceProgress, exitStatusBucket, isFullyCleared } from './exitCalc';

describe('calculateExpectedLastWorkingDate', () => {
  it('adds the notice period in days to the resignation date', () => {
    expect(calculateExpectedLastWorkingDate('2026-08-01', 30)).toBe('2026-08-31');
  });

  it('rolls over the month/year boundary correctly', () => {
    expect(calculateExpectedLastWorkingDate('2026-12-20', 30)).toBe('2027-01-19');
  });

  it('treats a zero notice period as same-day', () => {
    expect(calculateExpectedLastWorkingDate('2026-08-01', 0)).toBe('2026-08-01');
  });

  it('clamps a negative notice period to zero days', () => {
    expect(calculateExpectedLastWorkingDate('2026-08-01', -10)).toBe('2026-08-01');
  });

  it('handles a leap-year February correctly', () => {
    // 2028 is a leap year — Feb 1 + 29 days = Mar 1.
    expect(calculateExpectedLastWorkingDate('2028-02-01', 29)).toBe('2028-03-01');
  });
});

describe('isFullyCleared', () => {
  it('is false for an empty clearance list', () => {
    expect(isFullyCleared([])).toBe(false);
  });

  it('is false while any department is still pending or rejected', () => {
    expect(isFullyCleared(['cleared', 'cleared', 'pending', 'cleared', 'cleared'])).toBe(false);
    expect(isFullyCleared(['cleared', 'rejected', 'cleared', 'cleared', 'cleared'])).toBe(false);
  });

  it('is true once every department is cleared', () => {
    expect(isFullyCleared(['cleared', 'cleared', 'cleared', 'cleared', 'cleared'])).toBe(true);
  });
});

describe('clearanceProgress', () => {
  it('counts cleared departments out of the total', () => {
    expect(clearanceProgress(['cleared', 'pending', 'cleared', 'rejected', 'cleared'])).toEqual({ cleared: 3, total: 5 });
  });

  it('reports 0/0 for an empty list', () => {
    expect(clearanceProgress([])).toEqual({ cleared: 0, total: 0 });
  });
});

describe('exitStatusBucket', () => {
  it('is "Not Started" when there is no resignation', () => {
    expect(exitStatusBucket(null)).toBe('Not Started');
  });

  it('buckets every in-flight workflow stage as "In Progress"', () => {
    expect(exitStatusBucket('submitted')).toBe('In Progress');
    expect(exitStatusBucket('manager_approved')).toBe('In Progress');
    expect(exitStatusBucket('hr_approved')).toBe('In Progress');
  });

  it('maps terminal states to their own bucket', () => {
    expect(exitStatusBucket('completed')).toBe('Completed');
    expect(exitStatusBucket('rejected')).toBe('Rejected');
    expect(exitStatusBucket('withdrawn')).toBe('Withdrawn');
  });
});
