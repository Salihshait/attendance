import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatDateISO(date: Date): string {
  // Local-calendar-date formatting — date.toISOString() converts through
  // UTC first, which silently shifts the date by a day in any
  // positive-offset timezone (e.g. the org's own Asia/Kolkata) whenever the
  // local time is close to midnight. That would misalign the calendar grid,
  // the "Today" button, and every date-range filter against attendance_date.
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '-';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount);
}

export function initialsFromName(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}
