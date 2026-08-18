// Pure leave-request validation rules (spec section 5): insufficient
// balance, overlapping leave, holiday/weekoff-only ranges, and a duplicate
// existing request. Kept dependency-free so it can be unit tested and
// reused from the leave form without re-deriving the logic there.

export interface ExistingLeaveRequest {
  fromDate: string;
  toDate: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'cancelled';
}

export interface LeaveValidationInput {
  fromDate: string;
  toDate: string;
  requestedDays: number;
  availableBalance: number;
  existingRequests: ExistingLeaveRequest[];
  holidayDates: Set<string>;
  /** JS Date#getDay() indexes treated as weekly off, e.g. [0, 6] for Sun/Sat. */
  weekoffDayIndexes: number[];
}

export interface LeaveValidationResult {
  valid: boolean;
  errors: string[];
}

function toDateKey(d: Date): string {
  // Local-calendar-date formatting — d.toISOString() would convert through
  // UTC first, silently shifting the date by a day in any positive-offset
  // timezone (e.g. IST) and breaking the holiday/weekoff lookups below.
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function enumerateDates(fromDate: string, toDate: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${fromDate}T00:00:00`);
  const end = new Date(`${toDate}T00:00:00`);
  while (cursor <= end) {
    dates.push(toDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function rangesOverlap(aFrom: string, aTo: string, bFrom: string, bTo: string): boolean {
  return aFrom <= bTo && bFrom <= aTo;
}

export interface LeaveBalancePeriod {
  leaveTypeId: string;
  periodStart: string;
  periodEnd: string;
}

/**
 * Some leave types now have multiple leave_balances rows per year (monthly
 * accrual — see 0042_monthly_leave_balance_periods.sql), not just one. Finds
 * the row whose period actually contains `date`, instead of assuming
 * "one row per type" like a flat .find(leaveTypeId) would.
 */
export function findApplicableLeaveBalance<T extends LeaveBalancePeriod>(
  balances: T[],
  leaveTypeId: string,
  date: string,
): T | undefined {
  return balances.find((b) => b.leaveTypeId === leaveTypeId && date >= b.periodStart && date <= b.periodEnd);
}

/**
 * The balance actually available to spend on a new request. Monthly-accrual
 * types (CL/SL) carry 12 separate leave_balances rows, one per month — but a
 * leave request shouldn't be capped at whatever a single month's slice
 * happens to be (e.g. rejecting a 2-day request because August's row alone
 * only holds 1 day, while July's unused day sits right there unused). This
 * sums every period row for the type instead, matching how BalancePage.tsx
 * already presents the type's balance (a single year total, expandable into
 * its monthly breakdown) — mirrors act_on_approval()'s deduction, which
 * draws from the same pool of periods rather than one row.
 */
export function totalLeaveBalance<T extends LeaveBalancePeriod & { balance: number }>(
  balances: T[],
  leaveTypeId: string,
): number {
  return balances.filter((b) => b.leaveTypeId === leaveTypeId).reduce((sum, b) => sum + b.balance, 0);
}

const ACTIVE_STATUSES = new Set(['draft', 'pending', 'approved']);

export function validateLeaveRequest(input: LeaveValidationInput): LeaveValidationResult {
  const errors: string[] = [];

  if (input.requestedDays > input.availableBalance) {
    errors.push(`Insufficient leave balance: requested ${input.requestedDays} day(s), only ${input.availableBalance} available.`);
  }

  const hasOverlap = input.existingRequests.some(
    (r) => ACTIVE_STATUSES.has(r.status) && rangesOverlap(input.fromDate, input.toDate, r.fromDate, r.toDate),
  );
  if (hasOverlap) {
    errors.push('An existing leave request already covers one or more of these dates.');
  }

  const days = enumerateDates(input.fromDate, input.toDate);
  const allNonWorking = days.every(
    (d) => input.holidayDates.has(d) || input.weekoffDayIndexes.includes(new Date(`${d}T00:00:00`).getDay()),
  );
  if (allNonWorking) {
    errors.push('Selected dates fall entirely on holidays or weekoffs — no leave is needed.');
  }

  return { valid: errors.length === 0, errors };
}
