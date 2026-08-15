// Illustrative Indian income-tax calculator (old vs. new regime), FY 2024-25
// simplified slabs. This is a demo/estimation tool, not tax advice — slabs,
// cess, and surcharge change every Union Budget, and this intentionally
// omits surcharge (income > 50L) and regime-specific exemptions beyond the
// standard deduction for clarity.

export interface TaxSlab {
  upTo: number | null; // null = no upper bound
  rate: number; // fraction, e.g. 0.05 for 5%
}

export const OLD_REGIME_SLABS: TaxSlab[] = [
  { upTo: 250_000, rate: 0 },
  { upTo: 500_000, rate: 0.05 },
  { upTo: 1_000_000, rate: 0.2 },
  { upTo: null, rate: 0.3 },
];

export const NEW_REGIME_SLABS: TaxSlab[] = [
  { upTo: 300_000, rate: 0 },
  { upTo: 600_000, rate: 0.05 },
  { upTo: 900_000, rate: 0.1 },
  { upTo: 1_200_000, rate: 0.15 },
  { upTo: 1_500_000, rate: 0.2 },
  { upTo: null, rate: 0.3 },
];

const OLD_REGIME_STANDARD_DEDUCTION = 50_000;
const NEW_REGIME_STANDARD_DEDUCTION = 75_000;
const OLD_REGIME_REBATE_THRESHOLD = 500_000;
const NEW_REGIME_REBATE_THRESHOLD = 700_000;
const CESS_RATE = 0.04;

/** Progressive slab tax on a non-negative taxable income. */
export function computeSlabTax(taxableIncome: number, slabs: TaxSlab[]): number {
  const income = Math.max(0, taxableIncome);
  let tax = 0;
  let lowerBound = 0;
  for (const slab of slabs) {
    const upperBound = slab.upTo ?? Infinity;
    if (income <= lowerBound) break;
    const slabIncome = Math.min(income, upperBound) - lowerBound;
    tax += slabIncome * slab.rate;
    lowerBound = upperBound;
  }
  return tax;
}

export interface TaxRegimeResult {
  taxableIncome: number;
  taxBeforeRebate: number;
  rebateApplied: boolean;
  taxAfterRebate: number;
  cess: number;
  totalTax: number;
  netIncome: number;
}

function buildResult(grossIncome: number, taxableIncome: number, baseTax: number, rebateThreshold: number): TaxRegimeResult {
  const rebateApplied = taxableIncome <= rebateThreshold;
  const taxAfterRebate = rebateApplied ? 0 : baseTax;
  const cess = taxAfterRebate * CESS_RATE;
  const totalTax = taxAfterRebate + cess;
  return {
    taxableIncome,
    taxBeforeRebate: baseTax,
    rebateApplied,
    taxAfterRebate,
    cess,
    totalTax,
    netIncome: grossIncome - totalTax,
  };
}

export function calculateOldRegimeTax(grossIncome: number, deductions: number): TaxRegimeResult {
  const taxableIncome = Math.max(0, grossIncome - OLD_REGIME_STANDARD_DEDUCTION - Math.max(0, deductions));
  const baseTax = computeSlabTax(taxableIncome, OLD_REGIME_SLABS);
  return buildResult(grossIncome, taxableIncome, baseTax, OLD_REGIME_REBATE_THRESHOLD);
}

export function calculateNewRegimeTax(grossIncome: number): TaxRegimeResult {
  const taxableIncome = Math.max(0, grossIncome - NEW_REGIME_STANDARD_DEDUCTION);
  const baseTax = computeSlabTax(taxableIncome, NEW_REGIME_SLABS);
  return buildResult(grossIncome, taxableIncome, baseTax, NEW_REGIME_REBATE_THRESHOLD);
}
