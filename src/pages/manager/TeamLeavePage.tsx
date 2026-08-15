import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Info } from 'lucide-react';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { FilterBar, FilterField, FilterSelect } from '@/components/ui/FilterBar';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge, type StatusKind } from '@/components/ui/StatusBadge';
import { useAuth } from '@/auth/useAuth';
import { useTeamMembers, useTeamLeaveRequests } from '@/hooks/useTeamQueries';
import { formatDDMMYYYY } from '@/lib/dateFormat';
import type { RequestStatus } from '@/types/attendance';
import type { TeamLeaveRequestRow } from '@/types/manager';

const statusLabels: Record<RequestStatus, string> = {
  draft: 'Draft',
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

export default function TeamLeavePage() {
  const { authSession } = useAuth();
  const managerId = authSession?.employee.id;
  const { data: team } = useTeamMembers(managerId);
  const teamIds = useMemo(() => (team ?? []).map((m) => m.id), [team]);

  const { data, isLoading } = useTeamLeaveRequests(teamIds);
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [leaveTypeFilter, setLeaveTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState<TeamLeaveRequestRow | null>(null);

  const employeeOptions = useMemo(
    () => [{ value: 'all', label: 'All' }, ...(team ?? []).map((m) => ({ value: m.id, label: m.employeeName }))],
    [team],
  );
  const leaveTypeOptions = useMemo(() => {
    const names = new Set((data ?? []).map((r) => r.leaveTypeName));
    return [{ value: 'all', label: 'All' }, ...Array.from(names).map((n) => ({ value: n, label: n }))];
  }, [data]);
  const statusOptions = [{ value: 'all', label: 'All' }, ...Object.entries(statusLabels).map(([value, label]) => ({ value, label }))];

  const rows = useMemo(
    () =>
      (data ?? []).filter((r) => {
        if (employeeFilter !== 'all' && r.employeeId !== employeeFilter) return false;
        if (leaveTypeFilter !== 'all' && r.leaveTypeName !== leaveTypeFilter) return false;
        if (statusFilter !== 'all' && r.status !== statusFilter) return false;
        return true;
      }),
    [data, employeeFilter, leaveTypeFilter, statusFilter],
  );

  const columns: ColumnDef<TeamLeaveRequestRow>[] = [
    { header: 'Employee', accessorKey: 'employeeName' },
    { header: 'Employee Code', accessorKey: 'employeeCode' },
    { header: 'Leave Type', accessorKey: 'leaveTypeName' },
    { header: 'From', accessorFn: (r) => formatDDMMYYYY(r.fromDate), id: 'from' },
    { header: 'To', accessorFn: (r) => formatDDMMYYYY(r.toDate), id: 'to' },
    { header: 'Days', accessorKey: 'durationDays' },
    { header: 'Reason', accessorKey: 'reason' },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ getValue }) => {
        const status = getValue<RequestStatus>();
        return <StatusBadge status={status as StatusKind} label={statusLabels[status]} />;
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
      <Breadcrumb items={[{ label: 'Manager Self Service' }, { label: 'Team Leave' }]} />

      <div className="overflow-hidden rounded border border-slate-200 bg-white">
        <PageHeader title="Team Leave" />

        <FilterBar>
          <FilterField label="Employee">
            <FilterSelect value={employeeFilter} onChange={setEmployeeFilter} options={employeeOptions} />
          </FilterField>
          <FilterField label="Leave Type">
            <FilterSelect value={leaveTypeFilter} onChange={setLeaveTypeFilter} options={leaveTypeOptions} />
          </FilterField>
          <FilterField label="Status">
            <FilterSelect value={statusFilter} onChange={setStatusFilter} options={statusOptions} />
          </FilterField>
        </FilterBar>

        <DataTable
          columns={columns}
          data={rows}
          searchPlaceholder="Search by employee or reason"
          emptyMessage={isLoading ? 'Loading…' : 'No leave requests found.'}
        />
      </div>

      {selected && (
        <Modal title={`${selected.employeeName} — ${selected.leaveTypeName}`} onClose={() => setSelected(null)}>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            {[
              ['Employee Code', selected.employeeCode],
              ['From', formatDDMMYYYY(selected.fromDate)],
              ['To', formatDDMMYYYY(selected.toDate)],
              ['Days', String(selected.durationDays)],
              ['Applied On', new Date(selected.appliedOn).toLocaleString()],
              ['Status', statusLabels[selected.status]],
              ['Reason', selected.reason],
              ['Approval Remark', selected.approvalRemarks ?? '-'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 border-b border-slate-100 pb-1">
                <dt className="text-slate-500">{k}</dt>
                <dd className="text-right font-medium text-slate-700">{v}</dd>
              </div>
            ))}
          </dl>
        </Modal>
      )}
    </div>
  );
}
