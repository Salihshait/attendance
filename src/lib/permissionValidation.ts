// Pure permission-request validation rules, mirroring leaveValidation.ts's
// overlap check: no DB or client-side guard against overlapping permission
// windows existed before this (unlike leave), even though the spec calls it
// out explicitly as a required check.

export interface ExistingPermissionRequest {
  permissionDate: string;
  fromTime: string; // "HH:MM"
  toTime: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'cancelled';
}

export interface PermissionValidationInput {
  permissionDate: string;
  fromTime: string;
  toTime: string;
  existingRequests: ExistingPermissionRequest[];
}

export interface PermissionValidationResult {
  valid: boolean;
  errors: string[];
}

const ACTIVE_STATUSES = new Set(['draft', 'pending', 'approved']);

function timesOverlap(aFrom: string, aTo: string, bFrom: string, bTo: string): boolean {
  return aFrom < bTo && bFrom < aTo;
}

export function validatePermissionRequest(input: PermissionValidationInput): PermissionValidationResult {
  const errors: string[] = [];

  const hasOverlap = input.existingRequests.some(
    (r) =>
      ACTIVE_STATUSES.has(r.status) &&
      r.permissionDate === input.permissionDate &&
      timesOverlap(input.fromTime, input.toTime, r.fromTime, r.toTime),
  );
  if (hasOverlap) {
    errors.push('An existing permission request already covers part of this time window.');
  }

  return { valid: errors.length === 0, errors };
}
