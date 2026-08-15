import { useCallback, useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Info, X, Printer, Save } from 'lucide-react';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { FilterBar, FilterField, FilterSelect, FilterDate, FilterButton } from '@/components/ui/FilterBar';
import { StatusBadge, type StatusKind } from '@/components/ui/StatusBadge';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/auth/useAuth';
import {
  useLeaveRequests,
  usePermissionRequests,
  useRegularizations,
  useCancelLeaveRequest,
  useCancelPermissionRequest,
  useCancelRegularization,
} from '@/hooks/useRequestQueries';
import { formatDDMMYYYY, formatTime12h, formatHoursMinutes } from '@/lib/dateFormat';
import { canCancel } from '@/lib/requestStatus';
import type { LeaveRequestRow, PermissionRequestRow, RegularizationRow, RequestStatus } from '@/types/attendance';
import { regularizationTypes } from '@/components/attendance/RegularizationForm';

type EventKind = 'leave' | 'present' | 'permission';

const statusOptions = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
];

function toCsv(rows: Record<string, string>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  return [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h] ?? '')).join(','))].join('\n');
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function EventRequestPage() {
  const { authSession } = useAuth();
  const employeeId = authSession?.employee.id;
  const selfName = authSession?.employee.displayName ?? '';

  const [event, setEvent] = useState<EventKind>('leave');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [status, setStatus] = useState('all');
  const [detail, setDetail] = useState<Record<string, string> | null>(null);

  const { data: leaveRequests } = useLeaveRequests(employeeId, selfName);
  const { data: permissionRequests } = usePermissionRequests(employeeId, selfName);
  const { data: regularizations } = useRegularizations(employeeId);

  const cancelLeave = useCancelLeaveRequest();
  const cancelPermission = useCancelPermissionRequest();
  const cancelRegularization = useCancelRegularization();

  const matchesDateAndStatus = useCallback(
    (dateStr: string, rowStatus: RequestStatus) => {
      if (fromDate && dateStr < fromDate) return false;
      if (toDate && dateStr > toDate) return false;
      if (status !== 'all' && rowStatus !== status) return false;
      return true;
    },
    [fromDate, toDate, status],
  );

  const filteredLeave = useMemo(
    () => (leaveRequests ?? []).filter((r) => matchesDateAndStatus(r.fromDate, r.status)),
    [leaveRequests, matchesDateAndStatus],
  );
  const filteredPermission = useMemo(
    () => (permissionRequests ?? []).filter((r) => matchesDateAndStatus(r.permissionDate, r.status)),
    [permissionRequests, matchesDateAndStatus],
  );
  const filteredRegularization = useMemo(
    () => (regularizations ?? []).filter((r) => matchesDateAndStatus(r.attendanceDate, r.status)),
    [regularizations, matchesDateAndStatus],
  );

  const leaveColumns: ColumnDef<LeaveRequestRow>[] = [
    { header: 'Type', accessorKey: 'leaveTypeName' },
    {
      header: 'Date',
      accessorFn: (r) => `${r.fromDate} ${r.toDate}`,
      cell: ({ row }) => (
        <span>
          {formatDDMMYYYY(row.original.fromDate)}
          {row.original.toDate !== row.original.fromDate ? ` - ${formatDDMMYYYY(row.original.toDate)}` : ''}
        </span>
      ),
    },
    { header: 'Days', accessorKey: 'durationDays' },
    { header: 'Entry By', accessorKey: 'entryByName' },
    { header: 'Applied On', accessorFn: (r) => new Date(r.appliedOn).toLocaleString(), id: 'appliedOn' },
    { header: 'Reason', accessorKey: 'reason' },
    { header: 'Approval Remarks', accessorFn: (r) => r.approvalRemarks ?? '-', id: 'approvalRemarks' },
    { header: 'Status', accessorKey: 'status', cell: ({ getValue }) => <StatusPill status={getValue<RequestStatus>()} /> },
    {
      header: 'Action',
      id: 'action',
      cell: ({ row }) => (
        <ActionButtons
          onView={() =>
            setDetail({
              Type: row.original.leaveTypeName,
              Date: `${formatDDMMYYYY(row.original.fromDate)} - ${formatDDMMYYYY(row.original.toDate)}`,
              Days: String(row.original.durationDays),
              Reason: row.original.reason,
              'Approval Remarks': row.original.approvalRemarks ?? '-',
              Status: row.original.status,
            })
          }
          cancellable={canCancel(row.original.status)}
          onCancel={() => cancelLeave.mutate({ id: row.original.id, employeeId: employeeId! })}
        />
      ),
    },
  ];

  const permissionColumns: ColumnDef<PermissionRequestRow>[] = [
    { header: 'Date', accessorFn: (r) => formatDDMMYYYY(r.permissionDate), id: 'date' },
    { header: 'Start Time', accessorFn: (r) => formatTime12h(r.fromTime), id: 'startTime' },
    { header: 'End Time', accessorFn: (r) => formatTime12h(r.toTime), id: 'endTime' },
    { header: 'Hours', accessorFn: (r) => formatHoursMinutes(r.durationMinutes), id: 'hours' },
    { header: 'Days', accessorFn: (r) => (r.durationMinutes / 480).toFixed(2), id: 'days' },
    { header: 'Entry By', accessorKey: 'entryByName' },
    { header: 'Applied On', accessorFn: (r) => new Date(r.appliedOn).toLocaleString(), id: 'appliedOn' },
    { header: 'Reason', accessorKey: 'reason' },
    { header: 'Approval Remarks', accessorFn: (r) => r.approvalRemarks ?? '-', id: 'approvalRemarks' },
    { header: 'Status', accessorKey: 'status', cell: ({ getValue }) => <StatusPill status={getValue<RequestStatus>()} /> },
    {
      header: 'Action',
      id: 'action',
      cell: ({ row }) => (
        <ActionButtons
          onView={() =>
            setDetail({
              Date: formatDDMMYYYY(row.original.permissionDate),
              'Start Time': formatTime12h(row.original.fromTime),
              'End Time': formatTime12h(row.original.toTime),
              Duration: formatHoursMinutes(row.original.durationMinutes),
              Reason: row.original.reason,
              'Approval Remarks': row.original.approvalRemarks ?? '-',
              Status: row.original.status,
            })
          }
          cancellable={canCancel(row.original.status)}
          onCancel={() => cancelPermission.mutate({ id: row.original.id, employeeId: employeeId! })}
        />
      ),
    },
  ];

  const presentColumns: ColumnDef<RegularizationRow>[] = [
    {
      header: 'Type',
      accessorFn: (r) => regularizationTypes.find((t) => t.value === r.regularizationType)?.label ?? r.regularizationType,
      id: 'type',
    },
    { header: 'Date', accessorFn: (r) => formatDDMMYYYY(r.attendanceDate), id: 'date' },
    { header: 'Entry By', accessorFn: () => selfName, id: 'entryBy' },
    { header: 'Applied On', accessorFn: (r) => new Date(r.appliedOn).toLocaleString(), id: 'appliedOn' },
    { header: 'Reason', accessorKey: 'reason' },
    { header: 'Approval Remarks', accessorFn: (r) => r.approvalRemarks ?? '-', id: 'approvalRemarks' },
    { header: 'Status', accessorKey: 'status', cell: ({ getValue }) => <StatusPill status={getValue<RequestStatus>()} /> },
    {
      header: 'Action',
      id: 'action',
      cell: ({ row }) => (
        <ActionButtons
          onView={() =>
            setDetail({
              Type: regularizationTypes.find((t) => t.value === row.original.regularizationType)?.label ?? row.original.regularizationType,
              Date: formatDDMMYYYY(row.original.attendanceDate),
              Reason: row.original.reason,
              'Approval Remarks': row.original.approvalRemarks ?? '-',
              Status: row.original.status,
            })
          }
          cancellable={canCancel(row.original.status)}
          onCancel={() => cancelRegularization.mutate({ id: row.original.id, employeeId: employeeId! })}
        />
      ),
    },
  ];

  function handleSave() {
    const source = event === 'leave' ? filteredLeave : event === 'permission' ? filteredPermission : filteredRegularization;
    const rows = source.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, String(v ?? '')])));
    downloadCsv(`${event}-requests.csv`, toCsv(rows));
  }

  return (
    <div>
      <Breadcrumb items={[{ label: 'Attendance' }, { label: 'My Request' }, { label: 'Event Request' }]} />

      <div className="overflow-hidden rounded border border-slate-200 bg-white">
        <PageHeader title="Event Request" />

        <FilterBar
          actions={
            <>
              <FilterButton variant="primary">Apply</FilterButton>
              <FilterButton onClick={() => window.print()}>
                <span className="flex items-center gap-1">
                  <Printer className="h-3.5 w-3.5" /> Print
                </span>
              </FilterButton>
              <FilterButton onClick={handleSave}>
                <span className="flex items-center gap-1">
                  <Save className="h-3.5 w-3.5" /> Save
                </span>
              </FilterButton>
            </>
          }
        >
          <FilterField label="Event">
            <FilterSelect
              value={event}
              onChange={(v) => setEvent(v as EventKind)}
              options={[
                { value: 'leave', label: 'Leave' },
                { value: 'present', label: 'Present' },
                { value: 'permission', label: 'Permission' },
              ]}
            />
          </FilterField>
          <FilterField label="From Date">
            <FilterDate value={fromDate} onChange={setFromDate} />
          </FilterField>
          <FilterField label="To Date">
            <FilterDate value={toDate} onChange={setToDate} />
          </FilterField>
          <FilterField label="Status">
            <FilterSelect value={status} onChange={setStatus} options={statusOptions} />
          </FilterField>
        </FilterBar>

        {event === 'leave' && (
          <DataTable columns={leaveColumns} data={filteredLeave} searchPlaceholder="Search by Reason" emptyMessage="No leave requests found." />
        )}
        {event === 'permission' && (
          <DataTable
            columns={permissionColumns}
            data={filteredPermission}
            searchPlaceholder="Search by Reason"
            emptyMessage="No permission requests found."
          />
        )}
        {event === 'present' && (
          <DataTable
            columns={presentColumns}
            data={filteredRegularization}
            searchPlaceholder="Search by Reason"
            emptyMessage="No present requests found."
          />
        )}
      </div>

      {detail && (
        <Modal title="Request Details" onClose={() => setDetail(null)}>
          <dl className="space-y-2 text-xs">
            {Object.entries(detail).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-slate-100 pb-1.5">
                <dt className="font-medium text-slate-500">{k}</dt>
                <dd className="text-right text-slate-700">{v}</dd>
              </div>
            ))}
          </dl>
        </Modal>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: RequestStatus }) {
  const map: Record<RequestStatus, StatusKind> = {
    draft: 'draft',
    pending: 'pending',
    approved: 'approved',
    rejected: 'rejected',
    cancelled: 'cancelled',
  };
  return <StatusBadge status={map[status]} label={status.charAt(0).toUpperCase() + status.slice(1)} variant="solid" />;
}

function ActionButtons({
  onView,
  cancellable,
  onCancel,
}: {
  onView: () => void;
  cancellable: boolean;
  onCancel: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={onView}
        aria-label="View"
        className="rounded bg-slate-400 p-1 text-white hover:bg-slate-500"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      {cancellable && (
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel"
          className="rounded bg-status-pending p-1 text-white hover:opacity-90"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
