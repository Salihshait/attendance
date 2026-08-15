import { describe, expect, it } from 'vitest';
import { findOverlappingLeavePolicy, type ExistingLeavePolicy } from './leavePolicyValidation';

const GRADE_A_POLICY: ExistingLeavePolicy = {
  id: 'p1',
  leaveTypeId: 'lt-casual',
  gradeId: 'grade-a',
  effectiveFrom: '2026-01-01',
  effectiveTo: '2026-12-31',
};

describe('findOverlappingLeavePolicy', () => {
  it('detects an exact date-range overlap for the same leave type + grade', () => {
    const result = findOverlappingLeavePolicy([GRADE_A_POLICY], {
      leaveTypeId: 'lt-casual',
      gradeId: 'grade-a',
      effectiveFrom: '2026-06-01',
      effectiveTo: '2026-12-31',
    });
    expect(result).toBe(GRADE_A_POLICY);
  });

  it('allows adjacent, non-overlapping ranges', () => {
    const result = findOverlappingLeavePolicy([GRADE_A_POLICY], {
      leaveTypeId: 'lt-casual',
      gradeId: 'grade-a',
      effectiveFrom: '2027-01-01',
      effectiveTo: null,
    });
    expect(result).toBeNull();
  });

  it('treats a null effective_to as open-ended and detects overlap against it', () => {
    const openEnded: ExistingLeavePolicy = { ...GRADE_A_POLICY, effectiveTo: null };
    const result = findOverlappingLeavePolicy([openEnded], {
      leaveTypeId: 'lt-casual',
      gradeId: 'grade-a',
      effectiveFrom: '2030-01-01',
      effectiveTo: '2030-12-31',
    });
    expect(result).toBe(openEnded);
  });

  it('treats an org-wide (null grade) policy as overlapping every grade for the same leave type', () => {
    const orgWide: ExistingLeavePolicy = { ...GRADE_A_POLICY, id: 'p2', gradeId: null };
    const result = findOverlappingLeavePolicy([orgWide], {
      leaveTypeId: 'lt-casual',
      gradeId: 'grade-b',
      effectiveFrom: '2026-06-01',
      effectiveTo: '2026-06-30',
    });
    expect(result).toBe(orgWide);
  });

  it('does not conflict across different leave types even with identical dates/grade', () => {
    const result = findOverlappingLeavePolicy([GRADE_A_POLICY], {
      leaveTypeId: 'lt-sick',
      gradeId: 'grade-a',
      effectiveFrom: '2026-01-01',
      effectiveTo: '2026-12-31',
    });
    expect(result).toBeNull();
  });

  it('excludes the policy being edited from the overlap check by id', () => {
    const result = findOverlappingLeavePolicy([GRADE_A_POLICY], {
      id: 'p1',
      leaveTypeId: 'lt-casual',
      gradeId: 'grade-a',
      effectiveFrom: '2026-01-01',
      effectiveTo: '2026-12-31',
    });
    expect(result).toBeNull();
  });
});
