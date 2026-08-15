import { describe, expect, it } from 'vitest';
import { computePayslipTotals } from './payslipCalc';

describe('computePayslipTotals', () => {
  it('computes gross, deductions, and net for a standard case', () => {
    const totals = computePayslipTotals({
      basicPay: 50000,
      hra: 20000,
      otherAllowances: 5000,
      pfEmployeeContribution: 6000,
      esiEmployeeContribution: 500,
      professionalTax: 200,
      tds: 3000,
    });
    expect(totals).toEqual({ grossEarnings: 75000, totalDeductions: 9700, netPay: 65300 });
  });

  it('returns all zeros for all-zero input', () => {
    const totals = computePayslipTotals({
      basicPay: 0,
      hra: 0,
      otherAllowances: 0,
      pfEmployeeContribution: 0,
      esiEmployeeContribution: 0,
      professionalTax: 0,
      tds: 0,
    });
    expect(totals).toEqual({ grossEarnings: 0, totalDeductions: 0, netPay: 0 });
  });

  it('allows a negative net pay rather than flooring it, so bad data entry stays visible', () => {
    const totals = computePayslipTotals({
      basicPay: 1000,
      hra: 0,
      otherAllowances: 0,
      pfEmployeeContribution: 0,
      esiEmployeeContribution: 0,
      professionalTax: 0,
      tds: 5000,
    });
    expect(totals.netPay).toBe(-4000);
  });
});
