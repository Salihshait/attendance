import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { FilterBar, FilterField, FilterDate, FilterButton } from '@/components/ui/FilterBar';
import { useAuth } from '@/auth/useAuth';
import { useRawPunches } from '@/hooks/useAttendanceQueries';
import { formatDateISO } from '@/lib/utils';
import { formatClockTime, formatDDMMYYYY } from '@/lib/dateFormat';
import type { RawPunchRow } from '@/types/attendance';

function defaultMonthRange() {
  const now = new Date();
  return {
    from: formatDateISO(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: formatDateISO(now),
  };
}

export default function RawInOutRecordsPage() {
  const { authSession } = useAuth();
  const employeeId = authSession?.employee.id;
  const initial = defaultMonthRange();
  const [fromDate, setFromDate] = useState(initial.from);
  const [toDate, setToDate] = useState(initial.to);
  const [appliedRange, setAppliedRange] = useState(initial);

  const { data, isLoading } = useRawPunches(
    employeeId,
    new Date(`${appliedRange.from}T00:00:00`),
    new Date(`${appliedRange.to}T00:00:00`),
  );

  const rows = useMemo(() => data ?? [], [data]);

  const columns: ColumnDef<RawPunchRow>[] = [
    { header: 'Employee', accessorKey: 'employeeName' },
    { header: 'Employee Code', accessorKey: 'employeeCode' },
    { header: 'Date', accessorFn: (r) => formatDDMMYYYY(r.punchDate), id: 'date' },
    { header: 'Punch Time', accessorFn: (r) => formatClockTime(r.punchTime), id: 'punchTime' },
    {
      header: 'Punch Type',
      accessorFn: (r) => (r.punchType === 'in' ? 'IN' : 'OUT'),
      id: 'punchType',
      cell: ({ getValue }) => (
        <span
          className={
            getValue<string>() === 'IN'
              ? 'rounded bg-status-approved/15 px-1.5 py-0.5 text-[11px] font-semibold text-status-approved'
              : 'rounded bg-status-pending/15 px-1.5 py-0.5 text-[11px] font-semibold text-status-pending'
          }
        >
          {getValue<string>()}
        </span>
      ),
    },
    { header: 'Device', accessorFn: (r) => r.device ?? '-', id: 'device' },
    { header: 'Location', accessorFn: (r) => r.location ?? '-', id: 'location' },
    { header: 'Source', accessorFn: (r) => r.source, id: 'source' },
  ];

  return (
    <div>
      <Breadcrumb items={[{ label: 'Attendance' }, { label: 'My Report' }, { label: 'Raw In / Out Records' }]} />

      <div className="overflow-hidden rounded border border-slate-200 bg-white">
        <PageHeader title="Raw In / Out Records" />

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
          searchPlaceholder="Search by device or location"
          emptyMessage={isLoading ? 'Loading…' : 'No raw punches found for this range.'}
        />
      </div>
    </div>
  );
}
