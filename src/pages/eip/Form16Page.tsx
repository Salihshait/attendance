import { useMemo, useState } from 'react';
import { Printer } from 'lucide-react';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { PageHeader } from '@/components/layout/PageHeader';
import { FilterBar, FilterField, FilterSelect } from '@/components/ui/FilterBar';
import { useAuth } from '@/auth/useAuth';
import { usePayslips } from '@/hooks/useEipQueries';
import { useStatutoryDetails } from '@/hooks/useProfileQueries';
import { formatCurrency } from '@/lib/utils';
import type { PayslipRow } from '@/types/eip';

/** Indian financial year: April(Y) -> March(Y+1). Never hardcoded — derived from the current date. */
function currentFinancialYear(): string {
  const now = new Date();
  const startYear = now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1;
  return `${startYear}-${String(startYear + 1).slice(-2)}`;
}

function financialYearOptions(): { value: string; label: string }[] {
  const current = currentFinancialYear();
  const currentStart = Number(current.split('-')[0]);
  return [0, 1, 2].map((offset) => {
    const startYear = currentStart - offset;
    const label = `${startYear}-${String(startYear + 1).slice(-2)}`;
    return { value: label, label };
  });
}

function isInFinancialYear(row: PayslipRow, financialYear: string): boolean {
  const startYear = Number(financialYear.split('-')[0]);
  if (row.payPeriodMonth >= 4) return row.payPeriodYear === startYear;
  return row.payPeriodYear === startYear + 1;
}

export default function Form16Page() {
  const { authSession } = useAuth();
  const employeeId = authSession?.employee.id;
  const [financialYear, setFinancialYear] = useState(currentFinancialYear());

  const { data: statutory } = useStatutoryDetails(employeeId);
  const { data, isLoading } = usePayslips(employeeId);

  const fyPayslips = useMemo(() => (data ?? []).filter((r) => isInFinancialYear(r, financialYear)), [data, financialYear]);
  const totals = useMemo(
    () =>
      fyPayslips.reduce(
        (acc, r) => ({
          gross: acc.gross + r.grossEarnings,
          tds: acc.tds + r.tds,
          pf: acc.pf + r.pfEmployeeContribution,
          net: acc.net + r.netPay,
        }),
        { gross: 0, tds: 0, pf: 0, net: 0 },
      ),
    [fyPayslips],
  );

  return (
    <div>
      <Breadcrumb items={[{ label: 'EIP' }, { label: 'Pay Details' }, { label: 'Form 16' }]} />

      <div className="overflow-hidden rounded border border-slate-200 bg-white">
        <PageHeader
          title="Form 16"
          actions={
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 rounded bg-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/25"
            >
              <Printer className="h-3.5 w-3.5" /> Download PDF
            </button>
          }
        />

        <FilterBar>
          <FilterField label="Financial Year">
            <FilterSelect value={financialYear} onChange={setFinancialYear} options={financialYearOptions()} />
          </FilterField>
        </FilterBar>

        {isLoading ? (
          <p className="px-3 py-8 text-center text-xs text-slate-400">Loading…</p>
        ) : fyPayslips.length === 0 ? (
          <p className="px-3 py-8 text-center text-xs text-slate-400">No payslip data found for FY {financialYear}.</p>
        ) : (
          <div className="space-y-4 p-4 text-xs">
            <div className="grid grid-cols-2 gap-2 text-slate-600 sm:grid-cols-4">
              <div className="rounded border border-slate-200 p-2">
                <p className="text-[11px] text-slate-500">Employee</p>
                <p className="font-semibold">{authSession?.employee.displayName}</p>
              </div>
              <div className="rounded border border-slate-200 p-2">
                <p className="text-[11px] text-slate-500">PAN</p>
                <p className="font-semibold">{statutory?.panNumber ?? '-'}</p>
              </div>
              <div className="rounded border border-slate-200 p-2">
                <p className="text-[11px] text-slate-500">Financial Year</p>
                <p className="font-semibold">{financialYear}</p>
              </div>
              <div className="rounded border border-slate-200 p-2">
                <p className="text-[11px] text-slate-500">Months Included</p>
                <p className="font-semibold">{fyPayslips.length}</p>
              </div>
            </div>

            <table className="w-full border-collapse">
              <tbody>
                <tr>
                  <td className="border border-table-border bg-table-header px-3 py-1.5 font-medium">Gross Salary Paid</td>
                  <td className="border border-table-border px-3 py-1.5 text-right">{formatCurrency(totals.gross)}</td>
                </tr>
                <tr>
                  <td className="border border-table-border bg-table-header px-3 py-1.5 font-medium">Employee PF Contribution</td>
                  <td className="border border-table-border px-3 py-1.5 text-right">{formatCurrency(totals.pf)}</td>
                </tr>
                <tr>
                  <td className="border border-table-border bg-table-header px-3 py-1.5 font-medium">Total Tax Deducted at Source (TDS)</td>
                  <td className="border border-table-border px-3 py-1.5 text-right">{formatCurrency(totals.tds)}</td>
                </tr>
                <tr>
                  <td className="border border-table-border bg-primary-50 px-3 py-2 font-bold text-primary-600">Net Salary Paid</td>
                  <td className="border border-table-border bg-primary-50 px-3 py-2 text-right font-bold text-primary-600">{formatCurrency(totals.net)}</td>
                </tr>
              </tbody>
            </table>
            <p className="text-[11px] text-slate-400">
              Summary generated from payroll records for FY {financialYear}. This is not a substitute for the statutory Form 16 issued by
              Finance/HR.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
