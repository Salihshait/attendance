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
