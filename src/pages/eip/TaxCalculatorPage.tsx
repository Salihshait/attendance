import { useMemo, useState } from 'react';
import { Calculator } from 'lucide-react';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { PageHeader } from '@/components/layout/PageHeader';
import { calculateNewRegimeTax, calculateOldRegimeTax, type TaxRegimeResult } from '@/lib/taxCalc';
import { cn, formatCurrency } from '@/lib/utils';

export default function TaxCalculatorPage() {
  const [grossIncome, setGrossIncome] = useState('1200000');
  const [deductions, setDeductions] = useState('150000');

  const gross = Number(grossIncome) || 0;
  const ded = Number(deductions) || 0;

  const oldRegime = useMemo(() => calculateOldRegimeTax(gross, ded), [gross, ded]);
  const newRegime = useMemo(() => calculateNewRegimeTax(gross), [gross]);
  const better = oldRegime.totalTax <= newRegime.totalTax ? 'old' : 'new';

  return (
    <div>
      <Breadcrumb items={[{ label: 'EIP' }, { label: 'TDS' }, { label: 'Tax Calculator' }]} />

      <div className="overflow-hidden rounded border border-slate-200 bg-white">
        <PageHeader title="Tax Calculator" />

        <div className="flex items-center gap-1.5 border-b border-table-border bg-slate-50 px-4 py-2 text-[11px] text-slate-500">
          <Calculator className="h-3.5 w-3.5 shrink-0" />
          Illustrative estimate using simplified FY 2024-25 slabs — not tax advice.
        </div>

        <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-slate-500">Annual Gross Income</span>
            <input
              type="number"
              value={grossIncome}
              onChange={(e) => setGrossIncome(e.target.value)}
              className="w-full rounded border border-slate-300 px-2.5 py-1.5 outline-none focus:border-primary-500"
            />
          </label>
          <label className="block text-xs">
            <span className="mb-1 block font-medium text-slate-500">Declared Deductions (80C, 80D, etc. — old regime only)</span>
            <input
              type="number"
              value={deductions}
              onChange={(e) => setDeductions(e.target.value)}
              className="w-full rounded border border-slate-300 px-2.5 py-1.5 outline-none focus:border-primary-500"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 p-4 pt-0 md:grid-cols-2">
          <RegimeCard title="Old Regime" result={oldRegime} recommended={better === 'old'} />
          <RegimeCard title="New Regime" result={newRegime} recommended={better === 'new'} />
        </div>
      </div>
    </div>
  );
}

function RegimeCard({ title, result, recommended }: { title: string; result: TaxRegimeResult; recommended: boolean }) {
  return (
    <div className={cn('rounded border p-4', recommended ? 'border-status-approved bg-status-approved/5' : 'border-slate-200')}>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">{title}</p>
        {recommended && (
          <span className="rounded bg-status-approved px-2 py-0.5 text-[10px] font-semibold text-white">Recommended</span>
        )}
      </div>
      <dl className="space-y-1.5 text-xs text-slate-600">
        <Row label="Taxable Income" value={formatCurrency(result.taxableIncome)} />
        <Row label="Tax (before rebate)" value={formatCurrency(result.taxBeforeRebate)} />
        <Row label="87A Rebate Applied" value={result.rebateApplied ? 'Yes' : 'No'} />
        <Row label="Health & Education Cess (4%)" value={formatCurrency(result.cess)} />
        <Row label="Total Tax Payable" value={formatCurrency(result.totalTax)} bold />
        <Row label="Estimated Net Income" value={formatCurrency(result.netIncome)} bold />
      </dl>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={cn('flex justify-between border-b border-slate-100 pb-1', bold && 'font-semibold text-slate-800')}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
