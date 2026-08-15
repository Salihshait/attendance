import { useMemo } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { useAuth } from '@/auth/useAuth';
import { usePayslips } from '@/hooks/useEipQueries';
import { useStatutoryDetails } from '@/hooks/useProfileQueries';
import { formatCurrency } from '@/lib/utils';
import type { PayslipRow } from '@/types/eip';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function PfDetailsPage() {
  const { authSession } = useAuth();
  const employeeId = authSession?.employee.id;
  const { data: statutory } = useStatutoryDetails(employeeId);
  const { data, isLoading } = usePayslips(employeeId);
  const rows = useMemo(() => data ?? [], [data]);
  const totalPf = useMemo(() => rows.reduce((sum, r) => sum + r.pfEmployeeContribution, 0), [rows]);

  const columns: ColumnDef<PayslipRow>[] = [
    { header: 'Month', accessorFn: (r) => MONTH_NAMES[r.payPeriodMonth - 1], id: 'month' },
    { header: 'Year', accessorKey: 'payPeriodYear' },
    { header: 'Basic Pay', accessorFn: (r) => formatCurrency(r.basicPay), id: 'basic' },
    { header: 'PF Contribution', accessorFn: (r) => formatCurrency(r.pfEmployeeContribution), id: 'pf' },
  ];

  return (
    <div>
      <Breadcrumb items={[{ label: 'EIP' }, { label: 'Pay Details' }, { label: 'PF Details' }]} />

      <div className="overflow-hidden rounded border border-slate-200 bg-white">
        <PageHeader title="PF Details" />

        <div className="grid grid-cols-1 gap-3 border-b border-slate-100 p-4 text-xs sm:grid-cols-3">
          <SummaryCard label="UAN Number" value={statutory?.uanNumber ?? '-'} />
          <SummaryCard label="PF Number" value={statutory?.pfNumber ?? '-'} />
          <SummaryCard label="Total Contribution (all time)" value={formatCurrency(totalPf)} highlight />
        </div>

        <DataTable
          columns={columns}
          data={rows}
          searchPlaceholder="Search"
          emptyMessage={isLoading ? 'Loading…' : 'No PF contribution history found.'}
        />
      </div>
    </div>
  );
}

function SummaryCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={highlight ? 'rounded border border-primary-200 bg-primary-50 p-3' : 'rounded border border-slate-200 bg-slate-50 p-3'}>
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className={highlight ? 'text-sm font-bold text-primary-600' : 'text-sm font-semibold text-slate-700'}>{value}</p>
    </div>
  );
}
