import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Link } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { FormActions } from '@/components/admin/FormField';
import { useShifts, useUpdateShiftRules } from '@/hooks/useAdminShifts';
import type { AdminShiftRow } from '@/types/admin';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function weekoffSummary(days: number[]): string {
  if (days.length === 0) return 'None';
  return days
    .slice()
    .sort()
    .map((d) => DAY_LABELS[d])
    .join(', ');
}

export default function AttendanceRulesPage() {
  const { data, isLoading } = useShifts();
  const [editing, setEditing] = useState<AdminShiftRow | null>(null);

  const columns: ColumnDef<AdminShiftRow, any>[] = [
    { header: 'Shift Name', accessorKey: 'name' },
    { header: 'Weekoffs', accessorFn: (r) => weekoffSummary(r.weekoffDays), id: 'weekoffs' },
    {
      header: 'Overtime',
      id: 'overtime',
      accessorFn: (r) => (r.overtimeEnabled ? `Enabled (${r.overtimeRateMultiplier}x)` : 'Disabled'),
    },
    { header: 'Late Rule', accessorFn: (r) => (r.lateRuleEnabled ? 'Enabled' : 'Disabled'), id: 'lateRule' },
    { header: 'Early-Going Rule', accessorFn: (r) => (r.earlyGoingRuleEnabled ? 'Enabled' : 'Disabled'), id: 'earlyRule' },
    { header: 'Shortfall Rule', accessorFn: (r) => (r.shortfallRuleEnabled ? 'Enabled' : 'Disabled'), id: 'shortfallRule' },
    {
      header: 'Break Policy',
      id: 'breakPolicy',
      accessorFn: (r) =>
        `${r.minBreakMinutes}-${r.maxBreakMinutes}min, ${r.breakPaid ? 'paid' : 'unpaid'}, ${r.breakDeductionMode}`,
    },
    {
      header: 'Actions',
      id: 'actions',
      cell: ({ row }) => (
        <button type="button" onClick={() => setEditing(row.original)} className="rounded bg-primary-500 p-1 text-white hover:bg-primary-600">
          <Pencil className="h-3.5 w-3.5" />
        </button>
      ),
    },
  ];

  return (
    <div>
      <Breadcrumb items={[{ label: 'Administration' }, { label: 'Attendance Rules' }]} />

      <div className="overflow-hidden rounded border border-slate-200 bg-white">
        <PageHeader title="Attendance Rules" />

        <div className="flex items-center justify-between gap-3 border-b border-amber-100 bg-amber-50 px-4 py-2 text-[11px] text-amber-800">
          <span>
            Break Policy is read by attendance computation. Weekoff/Overtime/Late/Early-Going/Shortfall toggles are configuration
            only for now — attendance computation does not read them yet.
          </span>
          <Link to="/admin/holidays" className="whitespace-nowrap font-semibold text-primary-600 hover:underline">
            Manage Holidays →
          </Link>
        </div>

        <DataTable columns={columns} data={data ?? []} searchPlaceholder="Search shifts" emptyMessage={isLoading ? 'Loading…' : 'No shifts found.'} />
      </div>

      {editing && <AttendanceRulesModal shift={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function AttendanceRulesModal({ shift, onClose }: { shift: AdminShiftRow; onClose: () => void }) {
  const updateRules = useUpdateShiftRules();
  const [weekoffDays, setWeekoffDays] = useState<number[]>(shift.weekoffDays);
  const [overtimeEnabled, setOvertimeEnabled] = useState(shift.overtimeEnabled);
  const [overtimeRateMultiplier, setOvertimeRateMultiplier] = useState(String(shift.overtimeRateMultiplier));
  const [lateRuleEnabled, setLateRuleEnabled] = useState(shift.lateRuleEnabled);
  const [earlyGoingRuleEnabled, setEarlyGoingRuleEnabled] = useState(shift.earlyGoingRuleEnabled);
  const [shortfallRuleEnabled, setShortfallRuleEnabled] = useState(shift.shortfallRuleEnabled);
  const [minBreakMinutes, setMinBreakMinutes] = useState(String(shift.minBreakMinutes));
  const [standardBreakMinutes, setStandardBreakMinutes] = useState(String(shift.standardBreakMinutes));
  const [maxBreakMinutes, setMaxBreakMinutes] = useState(String(shift.maxBreakMinutes));
  const [breakPaid, setBreakPaid] = useState(shift.breakPaid);
  const [breakDeductionMode, setBreakDeductionMode] = useState(shift.breakDeductionMode);
  const [error, setError] = useState<string | null>(null);

  function toggleDay(day: number) {
    setWeekoffDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
  }

  async function submit() {
    setError(null);
    try {
      await updateRules.mutateAsync({
        id: shift.id,
        input: {
          weekoffDays,
          overtimeEnabled,
          overtimeRateMultiplier: Number(overtimeRateMultiplier),
          lateRuleEnabled,
          earlyGoingRuleEnabled,
          shortfallRuleEnabled,
          minBreakMinutes: Number(minBreakMinutes),
          standardBreakMinutes: Number(standardBreakMinutes),
          maxBreakMinutes: Number(maxBreakMinutes),
          breakPaid,
          breakDeductionMode,
        },
      });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Modal title={`Attendance Rules — ${shift.name}`} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="space-y-4 text-xs"
      >
        <div>
          <span className="mb-1.5 block text-[11px] font-medium text-slate-500">Weekoff Days</span>
          <div className="flex flex-wrap gap-1.5">
            {DAY_LABELS.map((label, idx) => (
              <button
                key={label}
                type="button"
                onClick={() => toggleDay(idx)}
                className={
                  weekoffDays.includes(idx)
                    ? 'rounded border border-status-weekoff bg-status-weekoff/15 px-2.5 py-1 font-semibold text-status-weekoff'
                    : 'rounded border border-slate-300 px-2.5 py-1 text-slate-500 hover:bg-slate-50'
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 text-slate-600">
          <input type="checkbox" checked={overtimeEnabled} onChange={(e) => setOvertimeEnabled(e.target.checked)} />
          Overtime Rule Enabled
        </label>
        {overtimeEnabled && (
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-slate-500">Overtime Rate Multiplier</span>
            <input
              type="number"
              step="0.1"
              value={overtimeRateMultiplier}
              onChange={(e) => setOvertimeRateMultiplier(e.target.value)}
              className="w-32 rounded border border-slate-300 px-2.5 py-1.5 text-xs outline-none focus:border-primary-500"
            />
          </label>
        )}

        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-1.5 text-slate-600">
            <input type="checkbox" checked={lateRuleEnabled} onChange={(e) => setLateRuleEnabled(e.target.checked)} /> Late Rule
          </label>
          <label className="flex items-center gap-1.5 text-slate-600">
            <input type="checkbox" checked={earlyGoingRuleEnabled} onChange={(e) => setEarlyGoingRuleEnabled(e.target.checked)} /> Early-Going Rule
          </label>
          <label className="flex items-center gap-1.5 text-slate-600">
            <input type="checkbox" checked={shortfallRuleEnabled} onChange={(e) => setShortfallRuleEnabled(e.target.checked)} /> Shortfall Rule
          </label>
        </div>

        <div className="space-y-2 border-t border-slate-100 pt-3">
          <p className="text-[11px] font-semibold text-slate-500">Break Policy</p>
          <p className="text-[11px] text-slate-400">
            A gap shorter than the minimum isn't treated as a formal break (folded back into effective time). A gap longer than
            the maximum is still fully excluded, but flagged for review.
          </p>
          <div className="grid grid-cols-3 gap-3">
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-slate-500">Minimum Break (min)</span>
              <input
                type="number"
                value={minBreakMinutes}
                onChange={(e) => setMinBreakMinutes(e.target.value)}
                className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs outline-none focus:border-primary-500"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-slate-500">Standard Break (min)</span>
              <input
                type="number"
                value={standardBreakMinutes}
                onChange={(e) => setStandardBreakMinutes(e.target.value)}
                className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs outline-none focus:border-primary-500"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-slate-500">Maximum Break (min)</span>
              <input
                type="number"
                value={maxBreakMinutes}
                onChange={(e) => setMaxBreakMinutes(e.target.value)}
                className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs outline-none focus:border-primary-500"
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-1.5 text-slate-600">
              <input type="checkbox" checked={breakPaid} onChange={(e) => setBreakPaid(e.target.checked)} /> Paid Break
              <span className="text-slate-400">(counts toward required hours)</span>
            </label>
            <label className="flex items-center gap-1.5 text-slate-600">
              Deduction:
              <select
                value={breakDeductionMode}
                onChange={(e) => setBreakDeductionMode(e.target.value as 'actual' | 'standard')}
                className="rounded border border-slate-300 px-2 py-1 text-xs outline-none focus:border-primary-500"
              >
                <option value="actual">Actual measured gap</option>
                <option value="standard">Flat standard duration</option>
              </select>
            </label>
          </div>
        </div>

        <FormActions onCancel={onClose} isSubmitting={updateRules.isPending} error={error} submitLabel="Save Rules" submittingLabel="Saving…" />
      </form>
    </Modal>
  );
}
