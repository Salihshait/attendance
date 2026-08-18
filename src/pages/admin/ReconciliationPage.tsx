import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { RefreshCw } from 'lucide-react';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { FilterBar, FilterField, FilterDate, FilterSelect, FilterButton } from '@/components/ui/FilterBar';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Field, FormActions, inputClass } from '@/components/admin/FormField';
import { useAuth } from '@/auth/useAuth';
import { useReconciliationFindings, useRunReconciliation, useResolveReconciliationFinding } from '@/hooks/useAdminReconciliation';
import { formatDateISO } from '@/lib/utils';
import { formatDDMMYYYY } from '@/lib/dateFormat';
import type { AdminReconciliationFindingRow, ReconciliationMismatchType, ReconciliationResolutionStatus } from '@/types/admin';

const mismatchLabels: Record<ReconciliationMismatchType, string> = {
  biometric_present_but_leave: 'Biometric Present + Leave Approved',
  wfh_with_biometric_present: 'WFH + Biometric Present',
  unexplained_absence: 'Unexplained Absence',
  onduty_marked_absent: 'On-Duty Marked Absent',
  missing_in: 'Missing IN',
  missing_out: 'Missing OUT',
  duplicate_punch: 'Duplicate Punch',
  invalid_punch_sequence: 'Invalid Punch Sequence',
};

const resolutionLabels: Record<ReconciliationResolutionStatus, string> = {
  open: 'Open',
  resolved: 'Resolved',
  accepted: 'Accepted',
  overridden: 'Overridden',
};

function defaultMonthRange() {
  const now = new Date();
  return { from: formatDateISO(new Date(now.getFullYear(), now.getMonth(), 1)), to: formatDateISO(now) };
}

export default function ReconciliationPage() {
  const { authSession } = useAuth();
  const initial = defaultMonthRange();
  const [fromDate, setFromDate] = useState(initial.from);
  const [toDate, setToDate] = useState(initial.to);
  const [statusFilter, setStatusFilter] = useState('all');
  const [mismatchFilter, setMismatchFilter] = useState('all');
  const [appliedFilters, setAppliedFilters] = useState({ fromDate: initial.from, toDate: initial.to });
  const [resolving, setResolving] = useState<AdminReconciliationFindingRow | null>(null);
  const [runMessage, setRunMessage] = useState<string | null>(null);

  const { data, isLoading } = useReconciliationFindings({
    fromDate: appliedFilters.fromDate,
    toDate: appliedFilters.toDate,
    resolutionStatus: statusFilter === 'all' ? undefined : (statusFilter as ReconciliationResolutionStatus),
    mismatchType: mismatchFilter === 'all' ? undefined : mismatchFilter,
  });
  const runReconciliation = useRunReconciliation();

  function applyFilters() {
    setAppliedFilters({ fromDate, toDate });
  }

  async function runScan() {
    setRunMessage(null);
    try {
      const count = await runReconciliation.mutateAsync({ fromDate, toDate });
      setRunMessage(`Scan complete — ${count} finding(s) recorded (existing resolutions were preserved).`);
      setAppliedFilters({ fromDate, toDate });
    } catch (e) {
      setRunMessage(`Scan failed — ${(e as Error).message}`);
    }
  }

  const columns: ColumnDef<AdminReconciliationFindingRow>[] = [
    { header: 'Date', accessorFn: (r) => formatDDMMYYYY(r.findingDate), id: 'date' },
    { header: 'Employee', accessorFn: (r) => `${r.employeeName} [${r.employeeCode}]`, id: 'employee' },
    { header: 'Mismatch Type', accessorFn: (r) => mismatchLabels[r.mismatchType] ?? r.mismatchType, id: 'mismatchType' },
    { header: 'Biometric Status', accessorFn: (r) => r.biometricStatus ?? '-', id: 'biometricStatus' },
    { header: 'HR Status', accessorFn: (r) => r.hrStatus ?? '-', id: 'hrStatus' },
    { header: 'Expected Status', accessorFn: (r) => r.expectedStatus ?? '-', id: 'expectedStatus' },
    {
      header: 'Resolution',
      accessorKey: 'resolutionStatus',
      cell: ({ getValue }) => {
        const status = getValue<ReconciliationResolutionStatus>();
        const kind = status === 'open' ? 'pending' : status === 'accepted' || status === 'resolved' ? 'approved' : 'active';
        return <StatusBadge status={kind} label={resolutionLabels[status]} />;
      },
    },
    {
      header: 'Actions',
      id: 'actions',
      cell: ({ row }) => (
        <button
          type="button"
          onClick={() => setResolving(row.original)}
          className="rounded bg-primary-500 px-2 py-1 text-[11px] font-semibold text-white hover:bg-primary-600"
        >
          {row.original.resolutionStatus === 'open' ? 'Resolve' : 'View / Update'}
        </button>
      ),
    },
  ];

  return (
    <div>
      <Breadcrumb items={[{ label: 'Administration' }, { label: 'Attendance Reconciliation' }]} />

      <div className="overflow-hidden rounded border border-slate-200 bg-white">
        <PageHeader
          title="Attendance Reconciliation"
          actions={
            <button
              type="button"
              onClick={runScan}
              disabled={runReconciliation.isPending}
              className="flex items-center gap-1.5 rounded bg-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/25 disabled:opacity-60"
            >
              <RefreshCw className={runReconciliation.isPending ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} /> Run Reconciliation
            </button>
          }
        />

        {runMessage && <p className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-[11px] text-slate-600">{runMessage}</p>}

        <FilterBar
          actions={
            <FilterButton onClick={applyFilters} variant="primary">
              Apply
            </FilterButton>
          }
        >
          <FilterField label="From Date">
            <FilterDate value={fromDate} onChange={setFromDate} />
          </FilterField>
          <FilterField label="To Date">
            <FilterDate value={toDate} onChange={setToDate} />
          </FilterField>
          <FilterField label="Resolution">
            <FilterSelect
              value={statusFilter}
              onChange={setStatusFilter}
              options={[{ value: 'all', label: 'All' }, ...Object.entries(resolutionLabels).map(([value, label]) => ({ value, label }))]}
            />
          </FilterField>
          <FilterField label="Mismatch Type">
            <FilterSelect
              value={mismatchFilter}
              onChange={setMismatchFilter}
              options={[{ value: 'all', label: 'All' }, ...Object.entries(mismatchLabels).map(([value, label]) => ({ value, label }))]}
            />
          </FilterField>
        </FilterBar>

        <p className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-[11px] text-slate-500">
          Compares biometric punches, attendance, and approved Leave/WFH/On-Duty for each day in range. Run Reconciliation to scan;
          re-running is safe and never resets an already-resolved finding.
        </p>

        <DataTable
          columns={columns}
          data={data ?? []}
          searchPlaceholder="Search by employee"
          emptyMessage={isLoading ? 'Loading…' : 'No reconciliation findings for this range.'}
        />
      </div>

      {resolving && authSession && (
        <ResolveModal
          finding={resolving}
          resolvedByEmployeeId={authSession.employee.id}
          onClose={() => setResolving(null)}
        />
      )}
    </div>
  );
}

function ResolveModal({
  finding,
  resolvedByEmployeeId,
  onClose,
}: {
  finding: AdminReconciliationFindingRow;
  resolvedByEmployeeId: string;
  onClose: () => void;
}) {
  const resolve = useResolveReconciliationFinding();
  const [action, setAction] = useState<'resolved' | 'accepted' | 'overridden'>('resolved');
  const [remarks, setRemarks] = useState(finding.remarks ?? '');
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    try {
      await resolve.mutateAsync({ id: finding.id, resolutionStatus: action, remarks, resolvedByEmployeeId });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Modal title={`${mismatchLabels[finding.mismatchType] ?? finding.mismatchType} — ${finding.employeeName}`} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="space-y-3 text-xs"
      >
        <div className="grid grid-cols-3 gap-2 rounded border border-slate-200 bg-slate-50 p-2.5">
          <div>
            <p className="text-[11px] text-slate-400">Biometric Status</p>
            <p className="font-medium text-slate-700">{finding.biometricStatus ?? '-'}</p>
          </div>
          <div>
            <p className="text-[11px] text-slate-400">HR Status</p>
            <p className="font-medium text-slate-700">{finding.hrStatus ?? '-'}</p>
          </div>
          <div>
            <p className="text-[11px] text-slate-400">Expected Status</p>
            <p className="font-medium text-slate-700">{finding.expectedStatus ?? '-'}</p>
          </div>
        </div>

        <Field label="Resolution Action">
          <select value={action} onChange={(e) => setAction(e.target.value as typeof action)} className={inputClass}>
            <option value="resolved">Resolved (corrected in the source records)</option>
            <option value="accepted">Accepted (mismatch acknowledged, no change needed)</option>
            <option value="overridden">Overridden (HR judgment call, exception noted)</option>
          </select>
        </Field>
        <Field label="Remarks">
          <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3} className={inputClass} />
        </Field>
        <p className="text-[11px] text-slate-400">This action is recorded in Audit Logs automatically.</p>

        {finding.resolvedByName && (
          <p className="text-[11px] text-slate-400">
            Previously actioned by {finding.resolvedByName} {finding.resolvedAt ? `on ${new Date(finding.resolvedAt).toLocaleString()}` : ''}
          </p>
        )}

        <FormActions onCancel={onClose} isSubmitting={resolve.isPending} error={error} submitLabel="Save Resolution" submittingLabel="Saving…" />
      </form>
    </Modal>
  );
}
