import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FileDown, FileSpreadsheet, FileText } from 'lucide-react';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { FilterBar, FilterField, FilterSelect, FilterButton } from '@/components/ui/FilterBar';
import { Modal } from '@/components/ui/Modal';
import { Field, FormActions, inputClass } from '@/components/admin/FormField';
import { usePayslipsAdmin, useCreatePayslip } from '@/hooks/useAdminPayroll';
import { useEmployeesForSelect } from '@/hooks/useAdminEmployees';
import { computePayslipTotals } from '@/lib/payslipCalc';
import { exportToCsv, exportToExcel, exportToPdf, type ExportColumn } from '@/lib/exportTable';
import { formatCurrency } from '@/lib/utils';
import type { AdminPayslipRow } from '@/types/admin';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [{ value: 'all', label: 'All' }, ...Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i).map((y) => ({ value: String(y), label: String(y) }))];
const MONTH_OPTIONS = [{ value: 'all', label: 'All' }, ...MONTH_LABELS.map((label, i) => ({ value: String(i + 1), label }))];

const schema = z.object({
  employeeId: z.string().min(1, 'Select an employee'),
  payPeriodMonth: z.string(),
  payPeriodYear: z.string(),
  basicPay: z.string(),
  hra: z.string(),
  otherAllowances: z.string(),
  pfEmployeeContribution: z.string(),
  esiEmployeeContribution: z.string(),
  professionalTax: z.string(),
  tds: z.string(),
});
type FormValues = z.infer<typeof schema>;

const exportColumns: ExportColumn<AdminPayslipRow>[] = [
  { header: 'Employee', accessor: (r) => r.employeeName },
  { header: 'Code', accessor: (r) => r.employeeCode },
  { header: 'Period', accessor: (r) => `${MONTH_LABELS[r.payPeriodMonth - 1]} ${r.payPeriodYear}` },
  { header: 'Gross Earnings', accessor: (r) => r.grossEarnings },
  { header: 'Total Deductions', accessor: (r) => r.totalDeductions },
  { header: 'Net Pay', accessor: (r) => r.netPay },
];

export default function PayrollPage() {
  const [yearFilter, setYearFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [addOpen, setAddOpen] = useState(false);

  const { data: employees } = useEmployeesForSelect();
  const { data, isLoading } = usePayslipsAdmin({
    year: yearFilter === 'all' ? undefined : Number(yearFilter),
    month: monthFilter === 'all' ? undefined : Number(monthFilter),
    employeeId: employeeFilter === 'all' ? undefined : employeeFilter,
  });

  const employeeOptions = useMemo(
    () => [{ value: 'all', label: 'All' }, ...(employees ?? []).map((e) => ({ value: e.id, label: `${e.name} (${e.employeeCode})` }))],
    [employees],
  );

  const columns: ColumnDef<AdminPayslipRow, any>[] = [
    { header: 'Employee', accessorKey: 'employeeName' },
    { header: 'Employee Code', accessorKey: 'employeeCode' },
    { header: 'Period', accessorFn: (r) => `${MONTH_LABELS[r.payPeriodMonth - 1]} ${r.payPeriodYear}`, id: 'period' },
    { header: 'Gross Earnings', accessorFn: (r) => formatCurrency(r.grossEarnings), id: 'gross' },
    { header: 'Total Deductions', accessorFn: (r) => formatCurrency(r.totalDeductions), id: 'deductions' },
    { header: 'Net Pay', accessorFn: (r) => formatCurrency(r.netPay), id: 'net' },
    { header: 'Generated At', accessorFn: (r) => new Date(r.generatedAt).toLocaleDateString(), id: 'generatedAt' },
  ];

  const filenameBase = `payroll-${yearFilter}-${monthFilter}`;

  return (
    <div>
      <Breadcrumb items={[{ label: 'Administration' }, { label: 'Payroll' }]} />

      <div className="overflow-hidden rounded border border-slate-200 bg-white">
        <PageHeader
          title="Payroll"
          actions={
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="rounded bg-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/25"
            >
              + Add Payslip
            </button>
          }
        />

        <FilterBar
          actions={
            <>
              <FilterButton onClick={() => exportToCsv(exportColumns, data ?? [], `${filenameBase}.csv`)}>
                <span className="flex items-center gap-1.5">
                  <FileDown className="h-3.5 w-3.5" /> CSV
                </span>
              </FilterButton>
              <FilterButton onClick={() => exportToExcel(exportColumns, data ?? [], `${filenameBase}.xlsx`)}>
                <span className="flex items-center gap-1.5">
                  <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
                </span>
              </FilterButton>
              <FilterButton onClick={() => exportToPdf(exportColumns, data ?? [], `${filenameBase}.pdf`, 'Payroll')}>
                <span className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" /> PDF
                </span>
              </FilterButton>
            </>
          }
        >
          <FilterField label="Year">
            <FilterSelect value={yearFilter} onChange={setYearFilter} options={YEAR_OPTIONS} />
          </FilterField>
          <FilterField label="Month">
            <FilterSelect value={monthFilter} onChange={setMonthFilter} options={MONTH_OPTIONS} />
          </FilterField>
          <FilterField label="Employee">
            <FilterSelect value={employeeFilter} onChange={setEmployeeFilter} options={employeeOptions} />
          </FilterField>
        </FilterBar>

        <DataTable columns={columns} data={data ?? []} searchPlaceholder="Search by employee" emptyMessage={isLoading ? 'Loading…' : 'No payslips found.'} />
      </div>

      {addOpen && (
        <Modal title="Add Payslip" onClose={() => setAddOpen(false)} widthClass="max-w-lg">
          <AddPayslipForm onDone={() => setAddOpen(false)} />
        </Modal>
      )}
    </div>
  );
}

function AddPayslipForm({ onDone }: { onDone: () => void }) {
  const { data: employees } = useEmployeesForSelect();
  const createPayslip = useCreatePayslip();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      employeeId: '',
      payPeriodMonth: String(new Date().getMonth() + 1),
      payPeriodYear: String(CURRENT_YEAR),
      basicPay: '0',
      hra: '0',
      otherAllowances: '0',
      pfEmployeeContribution: '0',
      esiEmployeeContribution: '0',
      professionalTax: '0',
      tds: '0',
    },
  });

  const figures = {
    basicPay: Number(watch('basicPay') || 0),
    hra: Number(watch('hra') || 0),
    otherAllowances: Number(watch('otherAllowances') || 0),
    pfEmployeeContribution: Number(watch('pfEmployeeContribution') || 0),
    esiEmployeeContribution: Number(watch('esiEmployeeContribution') || 0),
    professionalTax: Number(watch('professionalTax') || 0),
    tds: Number(watch('tds') || 0),
  };
  const totals = computePayslipTotals(figures);

  async function submit(values: FormValues) {
    setError(null);
    try {
      await createPayslip.mutateAsync({
        employeeId: values.employeeId,
        payPeriodMonth: Number(values.payPeriodMonth),
        payPeriodYear: Number(values.payPeriodYear),
        ...figures,
      });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-3 text-xs">
      <Field label="Employee" error={errors.employeeId?.message}>
        <select {...register('employeeId')} className={inputClass}>
          <option value="">Select</option>
          {(employees ?? []).map((e) => (
            <option key={e.id} value={e.id}>
              {e.name} ({e.employeeCode})
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Month">
          <select {...register('payPeriodMonth')} className={inputClass}>
            {MONTH_LABELS.map((label, i) => (
              <option key={label} value={i + 1}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Year">
          <input type="number" {...register('payPeriodYear')} className={inputClass} />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Basic Pay">
          <input type="number" {...register('basicPay')} className={inputClass} />
        </Field>
        <Field label="HRA">
          <input type="number" {...register('hra')} className={inputClass} />
        </Field>
        <Field label="Other Allowances">
          <input type="number" {...register('otherAllowances')} className={inputClass} />
        </Field>
      </div>
      <div className="grid grid-cols-4 gap-3">
        <Field label="PF">
          <input type="number" {...register('pfEmployeeContribution')} className={inputClass} />
        </Field>
        <Field label="ESI">
          <input type="number" {...register('esiEmployeeContribution')} className={inputClass} />
        </Field>
        <Field label="Prof. Tax">
          <input type="number" {...register('professionalTax')} className={inputClass} />
        </Field>
        <Field label="TDS">
          <input type="number" {...register('tds')} className={inputClass} />
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-3 rounded bg-slate-50 px-3 py-2 text-slate-600">
        <span>Gross: {formatCurrency(totals.grossEarnings)}</span>
        <span>Deductions: {formatCurrency(totals.totalDeductions)}</span>
        <span className={totals.netPay < 0 ? 'font-semibold text-status-rejected' : 'font-semibold'}>Net: {formatCurrency(totals.netPay)}</span>
      </div>

      <FormActions onCancel={onDone} isSubmitting={createPayslip.isPending} error={error} submitLabel="Add Payslip" />
    </form>
  );
}
