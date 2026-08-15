import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Check, X } from 'lucide-react';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { FilterBar, FilterField, FilterSelect } from '@/components/ui/FilterBar';
import { Modal } from '@/components/ui/Modal';
import { usePendingApprovals, useActOnApproval } from '@/hooks/useApprovalQueries';
import type { ApprovalRequestType, PendingApprovalRow } from '@/types/attendance';

const requestTypeLabels: Record<ApprovalRequestType, string> = {
  leave_request: 'Leave',
  permission_request: 'Permission',
  attendance_regularization: 'Attendance Regularization',
  onduty_request: 'Work From Home',
  other_request: 'Other Requests',
};

const requestTypeOptions = [
  { value: 'all', label: 'All' },
  { value: 'leave_request', label: 'Leave' },
  { value: 'permission_request', label: 'Permission' },
  { value: 'attendance_regularization', label: 'Attendance Regularization' },
  { value: 'onduty_request', label: 'Work From Home' },
  { value: 'other_request', label: 'Other Requests' },
];

export default function PendingApprovalsPage() {
  const { data, isLoading } = usePendingApprovals();
  const actOnApproval = useActOnApproval();
  const [typeFilter, setTypeFilter] = useState('all');
  const [pendingAction, setPendingAction] = useState<{ row: PendingApprovalRow; action: 'approved' | 'rejected' } | null>(null);
  const [remarks, setRemarks] = useState('');

  const rows = useMemo(
    () => (data ?? []).filter((r) => typeFilter === 'all' || r.requestType === typeFilter),
    [data, typeFilter],
  );

  function openAction(row: PendingApprovalRow, action: 'approved' | 'rejected') {
    setRemarks('');
    setPendingAction({ row, action });
  }

  const rejectRemarkMissing = pendingAction?.action === 'rejected' && remarks.trim() === '';

  async function confirmAction() {
    if (!pendingAction || rejectRemarkMissing) return;
    await actOnApproval.mutateAsync({
      requestType: pendingAction.row.requestType,
      requestId: pendingAction.row.id,
      action: pendingAction.action,
      remarks: remarks || undefined,
    });
    setPendingAction(null);
  }

  const columns: ColumnDef<PendingApprovalRow>[] = [
    {
      header: 'Type',
      accessorFn: (r) => requestTypeLabels[r.requestType],
      id: 'type',
    },
    { header: 'Employee', accessorKey: 'employeeName' },
    { header: 'Employee Code', accessorKey: 'employeeCode' },
    { header: 'Date', accessorKey: 'dateLabel' },
    { header: 'Details', accessorKey: 'detailLabel' },
    { header: 'Reason', accessorKey: 'reason' },
    { header: 'Applied On', accessorFn: (r) => new Date(r.appliedOn).toLocaleString(), id: 'appliedOn' },
    {
      header: 'Action',
      id: 'action',
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => openAction(row.original, 'approved')}
            aria-label="Approve"
            className="rounded bg-status-approved p-1 text-white hover:opacity-90"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => openAction(row.original, 'rejected')}
            aria-label="Reject"
            className="rounded bg-status-rejected p-1 text-white hover:opacity-90"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <Breadcrumb items={[{ label: 'Manager Self Service' }, { label: 'Pending Approvals' }]} />

      <div className="overflow-hidden rounded border border-slate-200 bg-white">
        <PageHeader title="Pending Approvals" />

        <FilterBar>
          <FilterField label="Type">
            <FilterSelect value={typeFilter} onChange={setTypeFilter} options={requestTypeOptions} />
          </FilterField>
        </FilterBar>

        <DataTable
          columns={columns}
          data={rows}
          searchPlaceholder="Search by employee or reason"
          emptyMessage={isLoading ? 'Loading…' : 'No pending approvals.'}
        />
      </div>

      {pendingAction && (
        <Modal title={pendingAction.action === 'approved' ? 'Approve Request' : 'Reject Request'} onClose={() => setPendingAction(null)}>
          <div className="space-y-3 text-xs">
            <p className="text-slate-600">
              {pendingAction.action === 'approved' ? 'Approve' : 'Reject'} the {requestTypeLabels[pendingAction.row.requestType].toLowerCase()}{' '}
              request from <span className="font-semibold">{pendingAction.row.employeeName}</span> ({pendingAction.row.dateLabel})?
            </p>
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-slate-500">
                Approval Remark {pendingAction.action === 'rejected' ? '(required)' : '(optional)'}
              </span>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={3}
                className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs outline-none focus:border-primary-500"
              />
              {rejectRemarkMissing && <span className="mt-1 block text-[11px] text-status-rejected">A remark is required when rejecting a request.</span>}
            </label>
            {actOnApproval.isError && (
              <p className="rounded bg-status-rejected/10 px-3 py-2 text-status-rejected">
                {(actOnApproval.error as Error).message}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setPendingAction(null)} className="rounded border border-slate-300 px-3.5 py-1.5 text-slate-600">
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmAction}
                disabled={actOnApproval.isPending || rejectRemarkMissing}
                className={
                  pendingAction.action === 'approved'
                    ? 'rounded bg-status-approved px-3.5 py-1.5 font-semibold text-white hover:opacity-90 disabled:opacity-60'
                    : 'rounded bg-status-rejected px-3.5 py-1.5 font-semibold text-white hover:opacity-90 disabled:opacity-60'
                }
              >
                {actOnApproval.isPending ? 'Submitting…' : pendingAction.action === 'approved' ? 'Approve' : 'Reject'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
