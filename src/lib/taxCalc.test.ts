import { describe, expect, it } from 'vitest';
import { calculateNewRegimeTax, calculateOldRegimeTax, computeSlabTax, NEW_REGIME_SLABS, OLD_REGIME_SLABS } from './taxCalc';

describe('computeSlabTax', () => {
  it('returns zero tax for income within the first (0%) slab', () => {
    expect(computeSlabTax(200_000, OLD_REGIME_SLABS)).toBe(0);
  });

  it('taxes only the portion of income within each slab', () => {
    // 250k @ 0% + 250k @ 5% + 300k @ 20% = 0 + 12,500 + 60,000
    expect(computeSlabTax(800_000, OLD_REGIME_SLABS)).toBeCloseTo(72_500);
  });

  it('applies the top-bracket rate to income above the last bound', () => {
    // Old regime: 250k@0 + 250k@5% + 500k@20% + 500k@30% = 0 + 12,500 + 100,000 + 150,000
    expect(computeSlabTax(1_500_000, OLD_REGIME_SLABS)).toBeCloseTo(262_500);
  });

  it('clamps negative income to zero tax', () => {
    expect(computeSlabTax(-1000, OLD_REGIME_SLABS)).toBe(0);
  });
});

describe('calculateOldRegimeTax', () => {
  it('applies the standard deduction and declared deductions before slabbing', () => {
    const result = calculateOldRegimeTax(700_000, 100_000);
    // 700,000 - 50,000 standard - 100,000 declared = 550,000 taxable
    expect(result.taxableIncome).toBe(550_000);
  });

  it('zeroes out tax via 87A rebate at/under the threshold', () => {
    const result = calculateOldRegimeTax(500_000, 0);
    expect(result.taxableIncome).toBe(450_000);
    expect(result.rebateApplied).toBe(true);
    expect(result.totalTax).toBe(0);
  });

  it('charges tax plus 4% cess above the rebate threshold', () => {
    const result = calculateOldRegimeTax(1_000_000, 0);
    expect(result.rebateApplied).toBe(false);
    expect(result.cess).toBeCloseTo(result.taxAfterRebate * 0.04);
    expect(result.totalTax).toBeCloseTo(result.taxAfterRebate + result.cess);
  });

  it('never reports a negative taxable income for large deductions', () => {
    const result = calculateOldRegimeTax(300_000, 500_000);
    expect(result.taxableIncome).toBe(0);
    expect(result.totalTax).toBe(0);
  });
});

describe('calculateNewRegimeTax', () => {
  it('applies only the flat standard deduction (no other declared deductions)', () => {
    const result = calculateNewRegimeTax(800_000);
    expect(result.taxableIncome).toBe(725_000);
  });

  it('zeroes out tax via 87A rebate at/under the new-regime threshold', () => {
    const result = calculateNewRegimeTax(700_000);
    expect(result.taxableIncome).toBe(625_000);
    expect(result.rebateApplied).toBe(true);
    expect(result.totalTax).toBe(0);
  });

  it('matches the raw slab computation above the rebate threshold', () => {
    const result = calculateNewRegimeTax(2_000_000);
    const expectedBase = computeSlabTax(2_000_000 - 75_000, NEW_REGIME_SLABS);
    expect(result.taxBeforeRebate).toBeCloseTo(expectedBase);
    expect(result.rebateApplied).toBe(false);
  });
});
