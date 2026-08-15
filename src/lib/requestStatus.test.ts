import { describe, expect, it } from 'vitest';
import { canApprove, canCancel, canReject } from './requestStatus';
import type { RequestStatus } from '@/types/attendance';

const ALL_STATUSES: RequestStatus[] = ['draft', 'pending', 'approved', 'rejected', 'cancelled'];

describe('canApprove / approval', () => {
  it('only allows approving a pending request', () => {
    expect(canApprove('pending')).toBe(true);
    for (const status of ALL_STATUSES.filter((s) => s !== 'pending')) {
      expect(canApprove(status)).toBe(false);
    }
  });
});

describe('canReject / rejection', () => {
  it('only allows rejecting a pending request', () => {
    expect(canReject('pending')).toBe(true);
    for (const status of ALL_STATUSES.filter((s) => s !== 'pending')) {
      expect(canReject(status)).toBe(false);
    }
  });

  it('cannot reject an already-approved or already-rejected request', () => {
    expect(canReject('approved')).toBe(false);
    expect(canReject('rejected')).toBe(false);
  });
});

describe('canCancel', () => {
  it('allows cancelling draft or pending requests only', () => {
    expect(canCancel('draft')).toBe(true);
    expect(canCancel('pending')).toBe(true);
    expect(canCancel('approved')).toBe(false);
    expect(canCancel('rejected')).toBe(false);
    expect(canCancel('cancelled')).toBe(false);
  });
});
