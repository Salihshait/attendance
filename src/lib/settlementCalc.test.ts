import { describe, expect, it } from 'vitest';
import { calculateFinalSettlement } from './settlementCalc';

describe('calculateFinalSettlement', () => {
  it('adds earnings and subtracts notice pay and deductions', () => {
    const total = calculateFinalSettlement({
      pendingSalary: 50_000,
      leaveEncashment: 12_000,
      bonus: 5_000,
      otherAdjustments: 1_000,
      noticePay: 8_000,
      deductions: 2_000,
    });
    expect(total).toBe(58_000);
  });

  it('can go negative when notice pay recovery exceeds earnings', () => {
    const total = calculateFinalSettlement({
      pendingSalary: 0,
      leaveEncashment: 0,
      bonus: 0,
      otherAdjustments: 0,
      noticePay: 20_000,
      deductions: 0,
    });
    expect(total).toBe(-20_000);
  });

  it('is zero when every input is zero', () => {
    expect(
      calculateFinalSettlement({ pendingSalary: 0, leaveEncashment: 0, bonus: 0, otherAdjustments: 0, noticePay: 0, deductions: 0 }),
    ).toBe(0);
  });
});
