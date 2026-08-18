// Pure Work From Home / On Duty request validation, mirroring
// leaveValidation.ts's overlap semantics exactly (same employee, overlapping
// [from_date, to_date], status still draft/pending/approved).

export interface ExistingOndutyRequest {
  fromDate: string;
  toDate: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'cancelled';
}

export interface OndutyValidationInput {
  fromDate: string;
  toDate: string;
  existingRequests: ExistingOndutyRequest[];
}

export interface OndutyValidationResult {
  valid: boolean;
  errors: string[];
}

const ACTIVE_STATUSES = new Set(['draft', 'pending', 'approved']);

function rangesOverlap(aFrom: string, aTo: string, bFrom: string, bTo: string): boolean {
  return aFrom <= bTo && bFrom <= aTo;
}

export function validateOndutyRequest(input: OndutyValidationInput): OndutyValidationResult {
  const errors: string[] = [];

  if (input.toDate < input.fromDate) {
    errors.push('To Date must be on or after From Date.');
  }

  const hasOverlap = input.existingRequests.some(
    (r) => ACTIVE_STATUSES.has(r.status) && rangesOverlap(input.fromDate, input.toDate, r.fromDate, r.toDate),
  );
  if (hasOverlap) {
    errors.push('An existing Work From Home / On Duty request already covers one or more of these dates.');
  }

  return { valid: errors.length === 0, errors };
}
