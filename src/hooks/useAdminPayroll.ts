import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { ORG_ID } from '@/lib/orgContext';
import { computePayslipTotals, type PayslipInputFigures } from '@/lib/payslipCalc';
import type { AdminPayslipRow } from '@/types/admin';

type EmployeeJoin = { first_name: string; last_name: string | null; employee_code: string; organization_id: string } | null;

export interface PayslipFilters {
  year?: number;
  month?: number;
  employeeId?: string;
}

// payslips has no organization_id column and its RLS is is_hr_or_admin()-
// only with no org check (pre-existing, not introduced here) — so rows
// whose employee isn't in this org are dropped after fetching, rather than
// a `!inner` PostgREST join filter (postgrest-js's select-string type
// inference can't parse `!inner` hints without a generated Database type,
// which this project doesn't have).
export function usePayslipsAdmin(filters: PayslipFilters) {
  return useQuery({
    queryKey: ['admin-payslips', filters],
    queryFn: async (): Promise<AdminPayslipRow[]> => {
      let query = supabase
        .from('payslips')
        .select(
          'id, employee_id, pay_period_month, pay_period_year, basic_pay, hra, other_allowances, pf_employee_contribution, ' +
            'esi_employee_contribution, professional_tax, tds, gross_earnings, total_deductions, net_pay, generated_at, ' +
            'employee:employees(organization_id, first_name, last_name, employee_code)',
        )
        .order('generated_at', { ascending: false });
      if (filters.year) query = query.eq('pay_period_year', filters.year);
      if (filters.month) query = query.eq('pay_period_month', filters.month);
      if (filters.employeeId) query = query.eq('employee_id', filters.employeeId);
      const { data, error } = await query;
      if (error) throw error;
      // supabase-js falls back to a GenericStringError placeholder for a
      // select this long/embedded without a generated Database type (this
      // project has none) — cast to the known raw shape rather than fight it.
      return ((data ?? []) as any[])
        .filter((r) => (r.employee as unknown as EmployeeJoin)?.organization_id === ORG_ID)
        .map((r) => {
        const employee = r.employee as unknown as EmployeeJoin;
        return {
          id: r.id,
          employeeId: r.employee_id,
          employeeName: employee ? [employee.first_name, employee.last_name].filter(Boolean).join(' ') : '-',
          employeeCode: employee?.employee_code ?? '-',
          payPeriodMonth: r.pay_period_month,
          payPeriodYear: r.pay_period_year,
          basicPay: Number(r.basic_pay),
          hra: Number(r.hra),
          otherAllowances: Number(r.other_allowances),
          pfEmployeeContribution: Number(r.pf_employee_contribution),
          esiEmployeeContribution: Number(r.esi_employee_contribution),
          professionalTax: Number(r.professional_tax),
          tds: Number(r.tds),
          grossEarnings: Number(r.gross_earnings),
          totalDeductions: Number(r.total_deductions),
          netPay: Number(r.net_pay),
          generatedAt: r.generated_at,
        };
      });
    },
  });
}

export interface NewPayslipInput extends PayslipInputFigures {
  employeeId: string;
  payPeriodMonth: number;
  payPeriodYear: number;
}

export function useCreatePayslip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewPayslipInput) => {
      const totals = computePayslipTotals(input);
      const { error } = await supabase.from('payslips').insert({
        employee_id: input.employeeId,
        pay_period_month: input.payPeriodMonth,
        pay_period_year: input.payPeriodYear,
        basic_pay: input.basicPay,
        hra: input.hra,
        other_allowances: input.otherAllowances,
        pf_employee_contribution: input.pfEmployeeContribution,
        esi_employee_contribution: input.esiEmployeeContribution,
        professional_tax: input.professionalTax,
        tds: input.tds,
        gross_earnings: totals.grossEarnings,
        total_deductions: totals.totalDeductions,
        net_pay: totals.netPay,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-payslips'] }),
  });
}
