import type { RequestStatus } from '@/types/attendance';

/** Shared status-transition rules for leave/permission/regularization requests. */
export function canCancel(status: RequestStatus): boolean {
  return status === 'pending' || status === 'draft';
}

export function canApprove(status: RequestStatus): boolean {
  return status === 'pending';
}

export function canReject(status: RequestStatus): boolean {
  return status === 'pending';
}
