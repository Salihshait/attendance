// Pure overlap check for Leave Policies — leave_policies has no DB
// constraint preventing overlapping rows for the same leave type + grade
// (or org-wide), so the Admin UI enforces it client-side before submit.

export interface ExistingLeavePolicy {
  id: string;
  leaveTypeId: string;
  /** null = org-wide (applies to every grade). */
  gradeId: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
}

export interface CandidateLeavePolicy {
  id?: string;
  leaveTypeId: string;
  gradeId: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
}

function rangesOverlap(aFrom: string, aTo: string | null, bFrom: string, bTo: string | null): boolean {
  const aEnd = aTo ?? '9999-12-31';
  const bEnd = bTo ?? '9999-12-31';
  return aFrom <= bEnd && bFrom <= aEnd;
}

/**
 * A candidate policy conflicts with an existing one if they're for the same
 * leave type AND either share the same grade, or either is org-wide
 * (null grade org-wide policies apply to every grade, so they overlap any
 * grade-specific policy for that leave type too) AND their date ranges
 * overlap.
 */
export function findOverlappingLeavePolicy(
  existing: ExistingLeavePolicy[],
  candidate: CandidateLeavePolicy,
): ExistingLeavePolicy | null {
  for (const policy of existing) {
    if (policy.id === candidate.id) continue;
    if (policy.leaveTypeId !== candidate.leaveTypeId) continue;
    const sameOrOverlappingGrade = policy.gradeId === candidate.gradeId || policy.gradeId === null || candidate.gradeId === null;
    if (!sameOrOverlappingGrade) continue;
    if (rangesOverlap(policy.effectiveFrom, policy.effectiveTo, candidate.effectiveFrom, candidate.effectiveTo)) {
      return policy;
    }
  }
  return null;
}
