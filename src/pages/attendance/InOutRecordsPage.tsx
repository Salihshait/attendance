import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { FilterBar, FilterField, FilterDate, FilterButton } from '@/components/ui/FilterBar';
import { StatusBadge, type StatusKind } from '@/components/ui/StatusBadge';
import { useAuth } from '@/auth/useAuth';
import { useAttendanceRange } from '@/hooks/useAttendanceQueries';
import { formatDateISO } from '@/lib/utils';
import { formatClockTime, formatDDMMYYYY, formatHoursMinutes } from '@/lib/dateFormat';
import type { AttendanceDay, DayStatus } from '@/types/attendance';

function defaultMonthRange() {
  const now = new Date();
  return {
    from: formatDateISO(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: formatDateISO(now),
  };
}

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

export default function InOutRecordsPage() {
  const { authSession } = useAuth();
  const employeeId = authSession?.employee.id;
  const initial = defaultMonthRange();
  const [fromDate, setFromDate] = useState(initial.from);
  const [toDate, setToDate] = useState(initial.to);
  const [appliedRange, setAppliedRange] = useState(initial);

  const { data, isLoading } = useAttendanceRange(
    employeeId,
    new Date(`${appliedRange.from}T00:00:00`),
    new Date(`${appliedRange.to}T00:00:00`),
  );

  const rows = useMemo(() => [...(data ?? [])].sort((a, b) => (a.attendanceDate < b.attendanceDate ? 1 : -1)), [data]);

  const columns: ColumnDef<AttendanceDay>[] = [
    { header: 'Date', accessorFn: (r) => formatDDMMYYYY(r.attendanceDate), id: 'date' },
    { header: 'Shift', accessorFn: (r) => r.shiftName ?? '-', id: 'shift' },
    { header: 'In Time', accessorFn: (r) => formatClockTime(r.checkIn), id: 'inTime' },
    { header: 'Out Time', accessorFn: (r) => formatClockTime(r.checkOut), id: 'outTime' },
    { header: 'Gross Duration', accessorFn: (r) => formatHoursMinutes(r.grossMinutes), id: 'gross' },
    {
      header: 'Break',
      accessorFn: (r) => `${formatHoursMinutes(r.breakMinutes)}${r.hasExcessBreak ? ' ⚠' : ''}`,
      id: 'break',
    },
    { header: 'Effective Hours', accessorFn: (r) => formatHoursMinutes(r.effectiveMinutes), id: 'effective' },
    { header: 'Late', accessorFn: (r) => (r.lateMinutes > 0 ? formatHoursMinutes(r.lateMinutes) : '-'), id: 'late' },
    {
      header: 'Early Going',
      accessorFn: (r) => (r.earlyGoingMinutes > 0 ? formatHoursMinutes(r.earlyGoingMinutes) : '-'),
      id: 'earlyGoing',
    },
    {
      header: 'Excess Stay',
      accessorFn: (r) => (r.excessStayMinutes > 0 ? formatHoursMinutes(r.excessStayMinutes) : '-'),
      id: 'excessStay',
    },
    {
      header: 'Shortfall',
      accessorFn: (r) => (r.shortfallMinutes > 0 ? formatHoursMinutes(r.shortfallMinutes) : '-'),
      id: 'shortfall',
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
      <Breadcrumb items={[{ label: 'Attendance' }, { label: 'My Report' }, { label: 'In / Out Records' }]} />

      <div className="overflow-hidden rounded border border-slate-200 bg-white">
        <PageHeader title="In / Out Records" />

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
        </FilterBar>

        <DataTable
          columns={columns}
          data={rows}
          searchPlaceholder="Search by shift"
          emptyMessage={isLoading ? 'Loading…' : 'No attendance records found for this range.'}
        />
      </div>
    </div>
  );
}
