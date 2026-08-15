import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Eye, Printer } from 'lucide-react';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { FilterBar, FilterField, FilterSelect } from '@/components/ui/FilterBar';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/auth/useAuth';
import { usePayslips } from '@/hooks/useEipQueries';
import { formatCurrency } from '@/lib/utils';
import type { PayslipRow } from '@/types/eip';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function yearOptions(): { value: string; label: string }[] {
  const current = new Date().getFullYear();
  return [current, current - 1, current - 2].map((y) => ({ value: String(y), label: String(y) }));
}

export default function PayslipsPage() {
  const { authSession } = useAuth();
  const employeeId = authSession?.employee.id;
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [viewing, setViewing] = useState<PayslipRow | null>(null);

  const { data, isLoading } = usePayslips(employeeId, Number(year));
  const rows = useMemo(() => data ?? [], [data]);

  const columns: ColumnDef<PayslipRow>[] = [
    { header: 'Month', accessorFn: (r) => MONTH_NAMES[r.payPeriodMonth - 1], id: 'month' },
    { header: 'Year', accessorKey: 'payPeriodYear' },
    { header: 'Basic', accessorFn: (r) => formatCurrency(r.basicPay), id: 'basic' },
    { header: 'HRA', accessorFn: (r) => formatCurrency(r.hra), id: 'hra' },
    { header: 'Allowances', accessorFn: (r) => formatCurrency(r.otherAllowances), id: 'allowances' },
    { header: 'Deductions', accessorFn: (r) => formatCurrency(r.totalDeductions), id: 'deductions' },
    { header: 'PF', accessorFn: (r) => formatCurrency(r.pfEmployeeContribution), id: 'pf' },
    { header: 'ESI', accessorFn: (r) => formatCurrency(r.esiEmployeeContribution), id: 'esi' },
    { header: 'Professional Tax', accessorFn: (r) => formatCurrency(r.professionalTax), id: 'pt' },
    { header: 'TDS', accessorFn: (r) => formatCurrency(r.tds), id: 'tds' },
    { header: 'Net Salary', accessorFn: (r) => formatCurrency(r.netPay), id: 'net' },
    {
      header: 'Action',
      id: 'action',
      cell: ({ row }) => (
        <button
          type="button"
          onClick={() => setViewing(row.original)}
          aria-label="View"
          className="rounded bg-card-info p-1 text-white hover:bg-card-info-dark"
        >
          <Eye className="h-3.5 w-3.5" />
        </button>
      ),
    },
  ];

  return (
    <div>
      <Breadcrumb items={[{ label: 'EIP' }, { label: 'Pay Details' }, { label: 'Payslip & Taxsheet' }]} />

      <div className="overflow-hidden rounded border border-slate-200 bg-white">
        <PageHeader title="Payslip & Taxsheet" />

        <FilterBar>
          <FilterField label="Year">
            <FilterSelect value={year} onChange={setYear} options={yearOptions()} />
          </FilterField>
        </FilterBar>

        <DataTable
          columns={columns}
          data={rows}
          searchPlaceholder="Search"
          emptyMessage={isLoading ? 'Loading…' : 'No payslips found for this year.'}
        />
      </div>

      {viewing && (
        <Modal title={`Payslip — ${MONTH_NAMES[viewing.payPeriodMonth - 1]} ${viewing.payPeriodYear}`} onClose={() => setViewing(null)} widthClass="max-w-lg">
          <div id="payslip-print-area" className="space-y-4 text-xs">
            <div className="text-center">
              <p className="text-sm font-semibold text-primary-600">{authSession?.employee.displayName}</p>
              <p className="text-slate-500">{authSession?.employee.employeeCode} · {authSession?.employee.designationName}</p>
            </div>

            <table className="w-full border-collapse">
              <tbody>
                <PayslipLine label="Basic" value={viewing.basicPay} />
                <PayslipLine label="HRA" value={viewing.hra} />
                <PayslipLine label="Allowances" value={viewing.otherAllowances} />
                <tr>
                  <td className="border border-table-border bg-table-header px-3 py-1.5 font-semibold">Gross Earnings</td>
                  <td className="border border-table-border px-3 py-1.5 text-right font-semibold">{formatCurrency(viewing.grossEarnings)}</td>
                </tr>
                <PayslipLine label="PF" value={viewing.pfEmployeeContribution} />
                <PayslipLine label="ESI" value={viewing.esiEmployeeContribution} />
                <PayslipLine label="Professional Tax" value={viewing.professionalTax} />
                <PayslipLine label="TDS" value={viewing.tds} />
                <tr>
                  <td className="border border-table-border bg-table-header px-3 py-1.5 font-semibold">Total Deductions</td>
                  <td className="border border-table-border px-3 py-1.5 text-right font-semibold">{formatCurrency(viewing.totalDeductions)}</td>
                </tr>
                <tr>
                  <td className="border border-table-border bg-primary-50 px-3 py-2 font-bold text-primary-600">Net Salary</td>
                  <td className="border border-table-border bg-primary-50 px-3 py-2 text-right font-bold text-primary-600">{formatCurrency(viewing.netPay)}</td>
                </tr>
              </tbody>
            </table>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 rounded bg-primary-500 px-3.5 py-1.5 font-semibold text-white hover:bg-primary-600"
              >
                <Printer className="h-3.5 w-3.5" /> Download PDF
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function PayslipLine({ label, value }: { label: string; value: number }) {
  return (
    <tr>
      <td className="border border-table-border px-3 py-1.5 text-slate-600">{label}</td>
      <td className="border border-table-border px-3 py-1.5 text-right text-slate-700">{formatCurrency(value)}</td>
    </tr>
  );
}
