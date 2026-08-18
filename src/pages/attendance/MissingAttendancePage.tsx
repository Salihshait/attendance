import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { AlertTriangle, Printer, Save } from 'lucide-react';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { FilterBar, FilterField, FilterSelect, FilterDate, FilterButton } from '@/components/ui/FilterBar';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/auth/useAuth';
import { useMissingAttendance } from '@/hooks/useAttendanceQueries';
import { RegularizationForm } from '@/components/attendance/RegularizationForm';
import { formatDDMMYYYY, formatClockTime } from '@/lib/dateFormat';
import { formatDateISO } from '@/lib/utils';
import { exportToCsv } from '@/lib/exportTable';
import type { MissingAttendanceRow } from '@/types/attendance';

type MissingKind = 'all' | 'missing_in' | 'missing_out' | 'both';

const missingOptions = [
  { value: 'all', label: 'All' },
  { value: 'missing_in', label: 'Missing In Only' },
  { value: 'missing_out', label: 'Missing Out Only' },
  { value: 'both', label: 'Both Missing' },
];

function defaultMonthRange() {
  const now = new Date();
  return {
    from: formatDateISO(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: formatDateISO(now),
  };
}

export default function MissingAttendancePage() {
  const { authSession } = useAuth();
  const selfEmployeeId = authSession?.employee.id;
  const initial = defaultMonthRange();
  const [fromDate, setFromDate] = useState(initial.from);
  const [toDate, setToDate] = useState(initial.to);
  const [appliedRange, setAppliedRange] = useState(initial);
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [missingKind, setMissingKind] = useState<MissingKind>('all');
  const [correctingDate, setCorrectingDate] = useState<string | null>(null);

  const { data, isLoading } = useMissingAttendance(appliedRange.from, appliedRange.to);
  const rows = useMemo(() => data ?? [], [data]);

  const employeeOptions = useMemo(
    () => [
      { value: 'all', label: 'All' },
      ...Array.from(new Map(rows.map((r) => [r.employeeId, r.employeeName])).entries()).map(([id, name]) => ({ value: id, label: name })),
    ],
    [rows],
  );
  const departmentOptions = useMemo(
    () => [
      { value: 'all', label: 'All' },
      ...Array.from(new Set(rows.map((r) => r.departmentName).filter((d): d is string => Boolean(d)))).map((d) => ({ value: d, label: d })),
    ],
    [rows],
  );

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (employeeFilter !== 'all' && r.employeeId !== employeeFilter) return false;
        if (departmentFilter !== 'all' && r.departmentName !== departmentFilter) return false;
        if (missingKind === 'missing_in' && !(r.missingIn && !r.missingOut)) return false;
        if (missingKind === 'missing_out' && !(r.missingOut && !r.missingIn)) return false;
        if (missingKind === 'both' && !(r.missingIn && r.missingOut)) return false;
        return true;
      }),
    [rows, employeeFilter, departmentFilter, missingKind],
  );

  function missingLabel(r: MissingAttendanceRow): string {
    if (r.missingIn && r.missingOut) return 'Both Missing';
    if (r.missingIn) return 'Missing In';
    if (r.missingOut) return 'Missing Out';
    return '-';
  }

  const columns: ColumnDef<MissingAttendanceRow>[] = [
    { header: 'Date', accessorFn: (r) => formatDDMMYYYY(r.attendanceDate), id: 'date' },
    { header: 'Employee', accessorKey: 'employeeName' },
    { header: 'Employee Code', accessorKey: 'employeeCode' },
    { header: 'Department', accessorFn: (r) => r.departmentName ?? '-', id: 'department' },
    { header: 'Shift', accessorFn: (r) => r.shiftName ?? '-', id: 'shift' },
    {
      header: 'Expected Timing',
      accessorFn: (r) => (r.shiftStartTime && r.shiftEndTime ? `${formatClockTime(`2000-01-01T${r.shiftStartTime}`)} - ${formatClockTime(`2000-01-01T${r.shiftEndTime}`)}` : '-'),
      id: 'expectedTiming',
    },
    { header: 'Status', accessorFn: (r) => r.dayStatus === 'no_record' ? 'No Record' : r.dayStatus, id: 'dayStatus' },
    {
      header: 'Missing',
      id: 'missing',
      cell: ({ row }) => (
        <span className="rounded bg-status-rejected/15 px-1.5 py-0.5 text-[11px] font-semibold text-status-rejected">
          {missingLabel(row.original)}
        </span>
      ),
    },
    {
      header: 'Regularization',
      accessorFn: (r) => (r.regularizationStatus ? `Pending (${r.regularizationStatus})` : '-'),
      id: 'regularization',
    },
    {
      header: 'Action',
      id: 'action',
      cell: ({ row }) => {
        if (row.original.regularizationStatus) {
          return <span className="text-[11px] text-slate-400">Already requested</span>;
        }
        // RegularizationForm always submits under the logged-in user's own
        // identity — there's no "submit as another employee" flow anywhere
        // in the app, so a manager/HR viewer can see a team member's
        // missing record here but can't file a correction on their behalf.
        if (row.original.employeeId !== selfEmployeeId) {
          return <span className="text-[11px] text-slate-400">-</span>;
        }
        return (
          <button
            type="button"
            onClick={() => setCorrectingDate(row.original.attendanceDate)}
            className="rounded bg-primary-500 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-primary-600"
          >
            Apply Correction
          </button>
        );
      },
    },
  ];

  function handleExport() {
    exportToCsv(
      [
        { header: 'Date', accessor: (r: MissingAttendanceRow) => formatDDMMYYYY(r.attendanceDate) },
        { header: 'Employee', accessor: (r: MissingAttendanceRow) => r.employeeName },
        { header: 'Employee Code', accessor: (r: MissingAttendanceRow) => r.employeeCode },
        { header: 'Department', accessor: (r: MissingAttendanceRow) => r.departmentName ?? '-' },
        { header: 'Missing', accessor: (r: MissingAttendanceRow) => missingLabel(r) },
        { header: 'Status', accessor: (r: MissingAttendanceRow) => r.dayStatus },
      ],
      filtered,
      'missing-attendance',
    );
  }

  return (
    <div>
      <Breadcrumb items={[{ label: 'Attendance' }, { label: 'My Report' }, { label: 'Missing Attendance' }]} />

      <div className="overflow-hidden rounded border border-slate-200 bg-white">
        <PageHeader
          title="Missing Attendance"
          actions={
            <div className="flex items-center gap-1.5 text-[11px] text-white/80">
              <AlertTriangle className="h-3.5 w-3.5" /> {filtered.length} record(s) need attention
            </div>
          }
        />

        <FilterBar
          actions={
            <>
              <FilterButton variant="primary" onClick={() => setAppliedRange({ from: fromDate, to: toDate })}>
                Apply
              </FilterButton>
              <FilterButton onClick={() => window.print()}>
                <span className="flex items-center gap-1">
                  <Printer className="h-3.5 w-3.5" /> Print
                </span>
              </FilterButton>
              <FilterButton onClick={handleExport}>
                <span className="flex items-center gap-1">
                  <Save className="h-3.5 w-3.5" /> Export
                </span>
              </FilterButton>
            </>
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
          <FilterField label="Missing">
            <FilterSelect value={missingKind} onChange={(v) => setMissingKind(v as MissingKind)} options={missingOptions} />
          </FilterField>
        </FilterBar>

        <DataTable
          columns={columns}
          data={filtered}
          searchPlaceholder="Search by employee"
          emptyMessage={isLoading ? 'Loading…' : 'No missing attendance found for this range.'}
        />
      </div>

      {correctingDate && (
        <Modal title="Attendance Regularization" onClose={() => setCorrectingDate(null)}>
          <RegularizationForm defaultDate={correctingDate} onDone={() => setCorrectingDate(null)} />
        </Modal>
      )}
    </div>
  );
}
