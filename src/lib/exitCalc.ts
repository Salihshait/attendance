// Pure Exit-module calculations (spec section 2 & 6), kept dependency-free
// for the same reason as attendanceCalc.ts/leaveValidation.ts: a live form
// preview and a Vitest suite that doesn't need Supabase.
import type { ExitRequestStatus } from '@/types/exit';

/** Expected Last Working Date = Resignation Date + Notice Period (days). */
export function calculateExpectedLastWorkingDate(resignationDate: string, noticePeriodDays: number): string {
  const date = new Date(`${resignationDate}T00:00:00`);
  date.setDate(date.getDate() + Math.max(0, noticePeriodDays));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export type ExitDepartment = 'manager' | 'hr' | 'it' | 'finance' | 'admin';
export const EXIT_CLEARANCE_DEPARTMENTS: ExitDepartment[] = ['manager', 'hr', 'it', 'finance', 'admin'];

export type ClearanceStatus = 'pending' | 'cleared' | 'rejected';

/** A resignation is fully cleared once every department clearance row is 'cleared'. */
export function isFullyCleared(statuses: ClearanceStatus[]): boolean {
  return statuses.length > 0 && statuses.every((s) => s === 'cleared');
}

export function clearanceProgress(statuses: ClearanceStatus[]): { cleared: number; total: number } {
  return { cleared: statuses.filter((s) => s === 'cleared').length, total: statuses.length };
}

/**
 * Coarse "Exit Status" bucket for the dashboard — distinct from the precise
 * "Resignation Status" workflow stage (spec section 1 lists both), so an
 * employee mid-approval reads "In Progress" rather than a raw enum value.
 */
export function exitStatusBucket(status: ExitRequestStatus | null): 'Not Started' | 'In Progress' | 'Completed' | 'Rejected' | 'Withdrawn' {
  if (status === null) return 'Not Started';
  if (status === 'completed') return 'Completed';
  if (status === 'rejected') return 'Rejected';
  if (status === 'withdrawn') return 'Withdrawn';
  return 'In Progress';
}
