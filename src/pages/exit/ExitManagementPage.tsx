import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Info } from 'lucide-react';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { FilterBar, FilterField, FilterSelect } from '@/components/ui/FilterBar';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge, type StatusKind } from '@/components/ui/StatusBadge';
import { ClearanceTimeline } from '@/components/exit/ClearanceTimeline';
import { SettlementEditor } from '@/components/exit/SettlementEditor';
import { useAuth } from '@/auth/useAuth';
import { useActOnExitRequest, useExitClearances, useManageableExitRequests } from '@/hooks/useExitQueries';
import { useMyExitInterview } from '@/hooks/useExitInterviewQueries';
import { formatDDMMYYYY } from '@/lib/dateFormat';
import type { ExitRequestRow, ExitRequestStatus } from '@/types/exit';

const statusLabels: Record<ExitRequestStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  manager_approved: 'Manager Approved',
  hr_approved: 'HR Approved',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
  completed: 'Completed',
};
const statusTone: Record<ExitRequestStatus, StatusKind> = {
  draft: 'draft',
  submitted: 'pending',
  manager_approved: 'pending',
  hr_approved: 'approved',
  rejected: 'rejected',
  withdrawn: 'cancelled',
  completed: 'approved',
};
const statusOptions = [{ value: 'all', label: 'All' }, ...Object.entries(statusLabels).map(([value, label]) => ({ value, label }))];

export default function ExitManagementPage() {
  const { authSession } = useAuth();
  const isHr = authSession?.employee.roles.some((r) => r === 'hr_admin' || r === 'super_admin') ?? false;
  const myEmployeeId = authSession?.employee.id;

  const { data, isLoading } = useManageableExitRequests();
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState<ExitRequestRow | null>(null);

  const rows = useMemo(() => (data ?? []).filter((r) => statusFilter === 'all' || r.status === statusFilter), [data, statusFilter]);

  const columns: ColumnDef<ExitRequestRow>[] = [
    { header: 'Employee', accessorKey: 'employeeName' },
    { header: 'Employee Code', accessorKey: 'employeeCode' },
    { header: 'Request Date', accessorFn: (r) => new Date(r.createdAt).toLocaleDateString(), id: 'requestDate' },
    { header: 'Resignation Date', accessorFn: (r) => formatDDMMYYYY(r.resignationDate), id: 'resignationDate' },
    { header: 'Last Working Date', accessorFn: (r) => formatDDMMYYYY(r.expectedLastWorkingDate), id: 'lwd' },
    { header: 'Reason', accessorKey: 'reason' },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ getValue }) => {
        const status = getValue<ExitRequestStatus>();
        return <StatusBadge status={statusTone[status]} label={statusLabels[status]} />;
      },
    },
    {
      header: 'Action',
      id: 'action',
      cell: ({ row }) => (
        <button
          type="button"
          aria-label="View"
          onClick={() => setSelected(row.original)}
          className="rounded bg-card-info p-1 text-white hover:bg-card-info-dark"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      ),
    },
  ];

  return (
    <div>
      <Breadcrumb items={[{ label: 'Exit' }, { label: 'Manage Resignations' }]} />

      <div className="overflow-hidden rounded border border-slate-200 bg-white">
        <PageHeader title={isHr ? 'Manage Resignations (Organization)' : 'Manage Resignations (My Team)'} />

        <FilterBar>
          <FilterField label="Status">
            <FilterSelect value={statusFilter} onChange={setStatusFilter} options={statusOptions} />
          </FilterField>
        </FilterBar>

        <DataTable columns={columns} data={rows} searchPlaceholder="Search by employee or reason" emptyMessage={isLoading ? 'Loading…' : 'No resignations found.'} />
      </div>

      {selected && (
        <ExitRequestDetailModal request={selected} isHr={isHr} myEmployeeId={myEmployeeId} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function ExitRequestDetailModal({
  request,
  isHr,
  myEmployeeId,
  onClose,
}: {
  request: ExitRequestRow;
  isHr: boolean;
  myEmployeeId: string | undefined;
  onClose: () => void;
}) {
  const actOnRequest = useActOnExitRequest();
  const showClearance = request.status === 'hr_approved' || request.status === 'completed';
  const { data: clearances, isLoading: clearancesLoading } = useExitClearances(showClearance ? request.id : undefined);
  const { data: interview } = useMyExitInterview(showClearance ? request.employeeId : undefined);
  const [remarks, setRemarks] = useState('');

  const canActAsManager = request.status === 'submitted';
  const canActAsHr = isHr && request.status === 'manager_approved';

  async function act(action: 'manager_approve' | 'manager_reject' | 'hr_approve' | 'hr_reject') {
    await actOnRequest.mutateAsync({ exitRequestId: request.id, action, remarks: remarks || undefined });
    setRemarks('');
    onClose();
  }

  return (
    <Modal title={`${request.employeeName} — Resignation`} onClose={onClose} widthClass="max-w-2xl">
      <div className="space-y-4 text-xs">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
          {[
            ['Resignation Date', formatDDMMYYYY(request.resignationDate)],
            ['Notice Period', `${request.noticePeriodDays} days`],
            ['Expected Last Working Date', formatDDMMYYYY(request.expectedLastWorkingDate)],
            ['Status', statusLabels[request.status]],
            ['Reason', request.reason],
            ['Manager', request.managerName ?? '-'],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 border-b border-slate-100 pb-1">
              <dt className="text-slate-500">{k}</dt>
              <dd className="text-right font-medium text-slate-700">{v}</dd>
            </div>
          ))}
        </dl>
        {request.detailedComments && <p className="rounded bg-slate-50 p-2 text-slate-600">{request.detailedComments}</p>}

        {(canActAsManager || canActAsHr) && (
          <div className="rounded border border-primary-200 bg-primary-50/40 p-3">
            <p className="mb-2 font-semibold text-primary-600">{canActAsHr ? 'HR Review' : 'Manager Review'}</p>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Remarks (optional)"
              rows={2}
              className="mb-2 w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs outline-none focus:border-primary-500"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => act(canActAsHr ? 'hr_approve' : 'manager_approve')}
                disabled={actOnRequest.isPending}
                className="rounded bg-status-approved px-3 py-1.5 font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                Approve
              </button>
              <button
                type="button"
                onClick={() => act(canActAsHr ? 'hr_reject' : 'manager_reject')}
                disabled={actOnRequest.isPending}
                className="rounded border border-status-rejected px-3 py-1.5 font-semibold text-status-rejected hover:bg-status-rejected/10 disabled:opacity-60"
              >
                Reject
              </button>
            </div>
          </div>
        )}

        {showClearance && (
          <div>
            <p className="mb-2 font-semibold text-slate-600">Exit Clearance</p>
            <ClearanceTimeline
              clearances={clearances ?? []}
              isLoading={clearancesLoading}
              canActOn={(dept) => isHr || (dept === 'manager' && Boolean(myEmployeeId) && request.managerId === myEmployeeId)}
            />
          </div>
        )}

        {showClearance && interview && (
          <div>
            <p className="mb-2 font-semibold text-slate-600">
              Exit Interview — {interview.status === 'completed' ? `submitted ${interview.conductedAt ? new Date(interview.conductedAt).toLocaleDateString() : ''}` : 'not yet submitted'}
            </p>
          </div>
        )}

        {isHr && showClearance && (
          <div>
            <p className="mb-2 font-semibold text-slate-600">Final Settlement</p>
            <SettlementEditor exitRequestId={request.id} defaultLastWorkingDate={request.expectedLastWorkingDate} />
          </div>
        )}
      </div>
    </Modal>
  );
}
