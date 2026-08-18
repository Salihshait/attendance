import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { FilterBar, FilterField, FilterDate, FilterSelect, FilterButton } from '@/components/ui/FilterBar';
import { StatusBadge, type StatusKind } from '@/components/ui/StatusBadge';
import { useAuth } from '@/auth/useAuth';
import { useTeamMembers, useTeamAttendance } from '@/hooks/useTeamQueries';
import { formatDateISO } from '@/lib/utils';
import { formatClockTime, formatDDMMYYYY, formatHoursMinutes } from '@/lib/dateFormat';
import type { DayStatus } from '@/types/attendance';
import type { TeamAttendanceRow } from '@/types/manager';

const statusLabels: Record<DayStatus, string> = {
  present: 'Present',
  half_day: 'Half Day',
  absent: 'Absent',
  weekoff: 'Weekoff',
  holiday: 'Holiday',
  leave: 'Leave',
  on_duty: 'On Duty',
  permission: 'Permission',
};

function defaultMonthRange() {
  const now = new Date();
  return {
    from: formatDateISO(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: formatDateISO(now),
  };
}

export default function TeamAttendancePage() {
  const { authSession } = useAuth();
  const managerId = authSession?.employee.id;
  const { data: team } = useTeamMembers(managerId);
  const teamIds = useMemo(() => (team ?? []).map((m) => m.id), [team]);

  const initial = defaultMonthRange();
  const [fromDate, setFromDate] = useState(initial.from);
  const [toDate, setToDate] = useState(initial.to);
  const [appliedRange, setAppliedRange] = useState(initial);
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data, isLoading } = useTeamAttendance(
    teamIds,
    new Date(`${appliedRange.from}T00:00:00`),
    new Date(`${appliedRange.to}T00:00:00`),
  );

  const departmentByEmployee = useMemo(
    () => new Map((team ?? []).map((m) => [m.id, m.departmentName ?? '-'])),
    [team],
  );
  const departmentOptions = useMemo(() => {
    const names = new Set((team ?? []).map((m) => m.departmentName ?? '-'));
    return [{ value: 'all', label: 'All' }, ...Array.from(names).map((n) => ({ value: n, label: n }))];
  }, [team]);
  const employeeOptions = useMemo(
    () => [{ value: 'all', label: 'All' }, ...(team ?? []).map((m) => ({ value: m.id, label: m.employeeName }))],
    [team],
  );
  const statusOptions = [{ value: 'all', label: 'All' }, ...Object.entries(statusLabels).map(([value, label]) => ({ value, label }))];

  const rows = useMemo(
    () =>
      (data ?? []).filter((r) => {
        if (employeeFilter !== 'all' && r.employeeId !== employeeFilter) return false;
        if (departmentFilter !== 'all' && (departmentByEmployee.get(r.employeeId) ?? '-') !== departmentFilter) return false;
        if (statusFilter !== 'all' && r.dayStatus !== statusFilter) return false;
        return true;
      }),
    [data, employeeFilter, departmentFilter, statusFilter, departmentByEmployee],
  );

  const excessStaySummary = useMemo(() => {
    const daysWithExcess = rows.filter((r) => r.excessStayMinutes > 0);
    return {
      totalMinutes: daysWithExcess.reduce((sum, r) => sum + r.excessStayMinutes, 0),
      dayCount: daysWithExcess.length,
    };
  }, [rows]);

  const columns: ColumnDef<TeamAttendanceRow>[] = [
    { header: 'Employee', accessorKey: 'employeeName' },
    { header: 'Employee Code', accessorKey: 'employeeCode' },
    { header: 'Date', accessorFn: (r) => formatDDMMYYYY(r.attendanceDate), id: 'date' },
    { header: 'Shift', accessorFn: (r) => r.shiftName ?? '-', id: 'shift' },
    { header: 'Check-in', accessorFn: (r) => formatClockTime(r.checkIn), id: 'checkIn' },
    { header: 'Check-out', accessorFn: (r) => formatClockTime(r.checkOut), id: 'checkOut' },
    { header: 'Effective Hours', accessorFn: (r) => formatHoursMinutes(r.effectiveMinutes), id: 'effective' },
    { header: 'Late', accessorFn: (r) => (r.lateMinutes > 0 ? formatHoursMinutes(r.lateMinutes) : '-'), id: 'late' },
    {
      header: 'Early Going',
      accessorFn: (r) => (r.earlyGoingMinutes > 0 ? formatHoursMinutes(r.earlyGoingMinutes) : '-'),
      id: 'earlyGoing',
    },
    {
      header: 'Shortfall',
      accessorFn: (r) => (r.shortfallMinutes > 0 ? formatHoursMinutes(r.shortfallMinutes) : '-'),
      id: 'shortfall',
    },
    {
      header: 'Excess Stay',
      accessorFn: (r) => (r.excessStayMinutes > 0 ? formatHoursMinutes(r.excessStayMinutes) : '-'),
      id: 'excessStay',
    },
    {
      header: 'Status',
      accessorKey: 'dayStatus',
      cell: ({ getValue }) => {
        const status = getValue<DayStatus>();
        return <StatusBadge status={status as StatusKind} label={statusLabels[status]} />;
      },
    },
  ];

  return (
    <div>
      <Breadcrumb items={[{ label: 'Manager Self Service' }, { label: 'Team Attendance' }]} />

      <div className="overflow-hidden rounded border border-slate-200 bg-white">
        <PageHeader title="Team Attendance" />

        <FilterBar
          actions={
            <FilterButton variant="primary" onClick={() => setAppliedRange({ from: fromDate, to: toDate })}>
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
          <FilterField label="Employee">
            <FilterSelect value={employeeFilter} onChange={setEmployeeFilter} options={employeeOptions} />
          </FilterField>
          <FilterField label="Department">
            <FilterSelect value={departmentFilter} onChange={setDepartmentFilter} options={departmentOptions} />
          </FilterField>
          <FilterField label="Status">
            <FilterSelect value={statusFilter} onChange={setStatusFilter} options={statusOptions} />
          </FilterField>
        </FilterBar>

        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2 text-xs text-slate-600">
          <span className="font-semibold text-status-approved">Excess Stay (this range):</span>
          <span>{formatHoursMinutes(excessStaySummary.totalMinutes)}</span>
          <span className="text-slate-400">·</span>
          <span>{excessStaySummary.dayCount} {excessStaySummary.dayCount === 1 ? 'day' : 'days'}</span>
        </div>

        <DataTable
          columns={columns}
          data={rows}
          searchPlaceholder="Search by employee"
          emptyMessage={isLoading ? 'Loading…' : 'No attendance records found for this range.'}
        />
      </div>
    </div>
  );
}
