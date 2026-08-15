// Pure payslip total computation, shared by the Payroll admin form's live
// preview and (implicitly) whatever eventually validates a submitted row.

export interface PayslipInputFigures {
  basicPay: number;
  hra: number;
  otherAllowances: number;
  pfEmployeeContribution: number;
  esiEmployeeContribution: number;
  professionalTax: number;
  tds: number;
}

export interface PayslipTotals {
  grossEarnings: number;
  totalDeductions: number;
  netPay: number;
}

/**
 * netPay is intentionally not floored at 0 — a negative result usually
 * means a data-entry mistake (deductions exceeding earnings), and silently
 * flooring it would hide that rather than surface it for correction.
 */
export function computePayslipTotals(input: PayslipInputFigures): PayslipTotals {
  const grossEarnings = input.basicPay + input.hra + input.otherAllowances;
  const totalDeductions = input.pfEmployeeContribution + input.esiEmployeeContribution + input.professionalTax + input.tds;
  const netPay = grossEarnings - totalDeductions;
  return { grossEarnings, totalDeductions, netPay };
}
