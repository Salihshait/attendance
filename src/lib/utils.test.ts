import { describe, expect, it } from 'vitest';
import { formatDateISO } from './utils';

describe('formatDateISO', () => {
  it('formats a local date without shifting through UTC', () => {
    // Regression guard: date.toISOString().slice(0, 10) would shift this by
    // a day in any positive-offset timezone (e.g. the org's Asia/Kolkata).
    expect(formatDateISO(new Date(2026, 7, 17))).toBe('2026-08-17');
  });

  it('pads single-digit months and days', () => {
    expect(formatDateISO(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('is stable at local midnight', () => {
    const midnight = new Date(2026, 7, 17, 0, 0, 0);
    expect(formatDateISO(midnight)).toBe('2026-08-17');
  });
});
