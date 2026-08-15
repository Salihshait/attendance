import { describe, expect, it } from 'vitest';
import { formatMaskedAadhaar, maskTail } from './mask';

describe('maskTail', () => {
  it('masks all but the last 4 characters by default', () => {
    // 10-char PAN-like value: 6 X's followed by the last 4 characters.
    expect(maskTail('ABCDE1234F')).toBe('XXXXXX234F');
  });

  it('masks a bank account number to last 4 digits', () => {
    expect(maskTail('1234567890123456')).toBe('XXXXXXXXXXXX3456');
  });

  it('returns the value unchanged when it is shorter than the visible window', () => {
    expect(maskTail('123', 4)).toBe('123');
  });

  it('returns a placeholder for empty input', () => {
    expect(maskTail(null)).toBe('-');
    expect(maskTail(undefined)).toBe('-');
    expect(maskTail('')).toBe('-');
  });

  it('supports a custom visible-character count', () => {
    expect(maskTail('9876543210', 2)).toBe('XXXXXXXX10');
  });
});

describe('formatMaskedAadhaar', () => {
  it('groups a 12-character value into 4-4-4', () => {
    expect(formatMaskedAadhaar('XXXXXXXX1234')).toBe('XXXX XXXX 1234');
  });

  it('returns a placeholder for empty input', () => {
    expect(formatMaskedAadhaar(null)).toBe('-');
  });
});
