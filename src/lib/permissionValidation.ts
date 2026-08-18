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
  requestedMinutes: number;
  /** Current month's balance in minutes. Callers pass 0 when no balance row exists yet — matches leaveValidation's `balance?.balance ?? 0` convention, not "unlimited". */
  availableBalanceMinutes: number;
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

  if (input.requestedMinutes > input.availableBalanceMinutes) {
    errors.push(
      `Insufficient permission balance: requested ${formatMinutes(input.requestedMinutes)}, only ${formatMinutes(input.availableBalanceMinutes)} available this month.`,
    );
  }

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

function formatMinutes(totalMinutes: number): string {
  const sign = totalMinutes < 0 ? '-' : '';
  const abs = Math.abs(totalMinutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
