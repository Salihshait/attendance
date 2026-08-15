import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { FileDown, FileSpreadsheet, FileText } from 'lucide-react';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { FilterBar, FilterField, FilterDate, FilterSelect, FilterButton } from '@/components/ui/FilterBar';
import { StatusBadge, type StatusKind } from '@/components/ui/StatusBadge';
import { useAuth } from '@/auth/useAuth';
import { useTeamMembers, useTeamLeaveRequests } from '@/hooks/useTeamQueries';
import { useTeamReportData, useTeamPermissionRequests } from '@/hooks/useTeamReports';
import { exportToCsv, exportToExcel, exportToPdf, type ExportColumn } from '@/lib/exportTable';
import { formatDateISO } from '@/lib/utils';
import { formatClockTime, formatDDMMYYYY, formatHoursMinutes, formatTime12h } from '@/lib/dateFormat';
import type { RequestStatus } from '@/types/attendance';
import type { TeamAttendanceRow, TeamLeaveRequestRow, TeamPermissionRow } from '@/types/manager';

type ReportType = 'attendance' | 'leave' | 'late' | 'absent' | 'early_going' | 'overtime' | 'permission';

const reportTypeOptions: { value: ReportType; label: string }[] = [
  { value: 'attendance', label: 'Attendance' },
  { value: 'leave', label: 'Leave' },
  { value: 'late', label: 'Late' },
  { value: 'absent', label: 'Absent' },
  { value: 'early_going', label: 'Early Going' },
  { value: 'overtime', label: 'Overtime (Excess Stay)' },
  { value: 'permission', label: 'Permission' },
];

const statusLabels: Record<RequestStatus, string> = {
  draft: 'Draft',
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

function defaultMonthRange() {
  const now = new Date();
  return {
    from: formatDateISO(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: formatDateISO(now),
  };
}

function attendanceReport(rows: TeamAttendanceRow[]) {
  const columns: ColumnDef<TeamAttendanceRow>[] = [
    { header: 'Employee', accessorKey: 'employeeName' },
    { header: 'Code', accessorKey: 'employeeCode' },
    { header: 'Date', accessorFn: (r) => formatDDMMYYYY(r.attendanceDate), id: 'date' },
    { header: 'Shift', accessorFn: (r) => r.shiftName ?? '-', id: 'shift' },
    { header: 'Check In', accessorFn: (r) => formatClockTime(r.checkIn), id: 'checkIn' },
    { header: 'Check Out', accessorFn: (r) => formatClockTime(r.checkOut), id: 'checkOut' },
    { header: 'Effective Hours', accessorFn: (r) => formatHoursMinutes(r.effectiveMinutes), id: 'effective' },
    { header: 'Status', accessorKey: 'dayStatus' },
  ];
  const exportColumns: ExportColumn<TeamAttendanceRow>[] = [
    { header: 'Employee', accessor: (r) => r.employeeName },
    { header: 'Code', accessor: (r) => r.employeeCode },
    { header: 'Date', accessor: (r) => formatDDMMYYYY(r.attendanceDate) },
    { header: 'Shift', accessor: (r) => r.shiftName ?? '-' },
    { header: 'Check In', accessor: (r) => formatClockTime(r.checkIn) },
    { header: 'Check Out', accessor: (r) => formatClockTime(r.checkOut) },
    { header: 'Effective Hours', accessor: (r) => formatHoursMinutes(r.effectiveMinutes) },
    { header: 'Status', accessor: (r) => r.dayStatus },
  ];
  return { columns, exportColumns, rows };
}

function lateReport(rows: TeamAttendanceRow[]) {
  const filtered = rows.filter((r) => r.lateMinutes > 0);
  const columns: ColumnDef<TeamAttendanceRow>[] = [
    { header: 'Employee', accessorKey: 'employeeName' },
    { header: 'Code', accessorKey: 'employeeCode' },
    { header: 'Date', accessorFn: (r) => formatDDMMYYYY(r.attendanceDate), id: 'date' },
    { header: 'Check In', accessorFn: (r) => formatClockTime(r.checkIn), id: 'checkIn' },
    { header: 'Late By', accessorFn: (r) => formatHoursMinutes(r.lateMinutes), id: 'lateBy' },
  ];
  const exportColumns: ExportColumn<TeamAttendanceRow>[] = [
    { header: 'Employee', accessor: (r) => r.employeeName },
    { header: 'Code', accessor: (r) => r.employeeCode },
    { header: 'Date', accessor: (r) => formatDDMMYYYY(r.attendanceDate) },
    { header: 'Check In', accessor: (r) => formatClockTime(r.checkIn) },
    { header: 'Late By', accessor: (r) => formatHoursMinutes(r.lateMinutes) },
  ];
  return { columns, exportColumns, rows: filtered };
}

function absentReport(rows: TeamAttendanceRow[]) {
  const filtered = rows.filter((r) => r.dayStatus === 'absent');
  const columns: ColumnDef<TeamAttendanceRow>[] = [
    { header: 'Employee', accessorKey: 'employeeName' },
    { header: 'Code', accessorKey: 'employeeCode' },
    { header: 'Date', accessorFn: (r) => formatDDMMYYYY(r.attendanceDate), id: 'date' },
    { header: 'Status', accessorKey: 'dayStatus' },
  ];
  const exportColumns: ExportColumn<TeamAttendanceRow>[] = [
    { header: 'Employee', accessor: (r) => r.employeeName },
    { header: 'Code', accessor: (r) => r.employeeCode },
    { header: 'Date', accessor: (r) => formatDDMMYYYY(r.attendanceDate) },
    { header: 'Status', accessor: (r) => r.dayStatus },
  ];
  return { columns, exportColumns, rows: filtered };
}

function earlyGoingReport(rows: TeamAttendanceRow[]) {
  const filtered = rows.filter((r) => r.earlyGoingMinutes > 0);
  const columns: ColumnDef<TeamAttendanceRow>[] = [
    { header: 'Employee', accessorKey: 'employeeName' },
    { header: 'Code', accessorKey: 'employeeCode' },
    { header: 'Date', accessorFn: (r) => formatDDMMYYYY(r.attendanceDate), id: 'date' },
    { header: 'Check Out', accessorFn: (r) => formatClockTime(r.checkOut), id: 'checkOut' },
    { header: 'Early By', accessorFn: (r) => formatHoursMinutes(r.earlyGoingMinutes), id: 'earlyBy' },
  ];
  const exportColumns: ExportColumn<TeamAttendanceRow>[] = [
    { header: 'Employee', accessor: (r) => r.employeeName },
    { header: 'Code', accessor: (r) => r.employeeCode },
    { header: 'Date', accessor: (r) => formatDDMMYYYY(r.attendanceDate) },
    { header: 'Check Out', accessor: (r) => formatClockTime(r.checkOut) },
    { header: 'Early By', accessor: (r) => formatHoursMinutes(r.earlyGoingMinutes) },
  ];
  return { columns, exportColumns, rows: filtered };
}

function overtimeReport(rows: TeamAttendanceRow[]) {
  const filtered = rows.filter((r) => r.excessStayMinutes > 0);
  const columns: ColumnDef<TeamAttendanceRow>[] = [
    { header: 'Employee', accessorKey: 'employeeName' },
    { header: 'Code', accessorKey: 'employeeCode' },
    { header: 'Date', accessorFn: (r) => formatDDMMYYYY(r.attendanceDate), id: 'date' },
    { header: 'Excess Stay', accessorFn: (r) => formatHoursMinutes(r.excessStayMinutes), id: 'excessStay' },
  ];
  const exportColumns: ExportColumn<TeamAttendanceRow>[] = [
    { header: 'Employee', accessor: (r) => r.employeeName },
    { header: 'Code', accessor: (r) => r.employeeCode },
    { header: 'Date', accessor: (r) => formatDDMMYYYY(r.attendanceDate) },
    { header: 'Excess Stay', accessor: (r) => formatHoursMinutes(r.excessStayMinutes) },
  ];
  return { columns, exportColumns, rows: filtered };
}

function leaveReport(rows: TeamLeaveRequestRow[]) {
  const columns: ColumnDef<TeamLeaveRequestRow>[] = [
    { header: 'Employee', accessorKey: 'employeeName' },
    { header: 'Code', accessorKey: 'employeeCode' },
    { header: 'Leave Type', accessorKey: 'leaveTypeName' },
    { header: 'From', accessorFn: (r) => formatDDMMYYYY(r.fromDate), id: 'from' },
    { header: 'To', accessorFn: (r) => formatDDMMYYYY(r.toDate), id: 'to' },
    { header: 'Days', accessorKey: 'durationDays' },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ getValue }) => {
        const status = getValue<RequestStatus>();
        return <StatusBadge status={status as StatusKind} label={statusLabels[status]} />;
      },
    },
  ];
  const exportColumns: ExportColumn<TeamLeaveRequestRow>[] = [
    { header: 'Employee', accessor: (r) => r.employeeName },
    { header: 'Code', accessor: (r) => r.employeeCode },
    { header: 'Leave Type', accessor: (r) => r.leaveTypeName },
    { header: 'From', accessor: (r) => formatDDMMYYYY(r.fromDate) },
    { header: 'To', accessor: (r) => formatDDMMYYYY(r.toDate) },
    { header: 'Days', accessor: (r) => r.durationDays },
    { header: 'Status', accessor: (r) => statusLabels[r.status] },
  ];
  return { columns, exportColumns, rows };
}

function permissionReport(rows: TeamPermissionRow[]) {
  const columns: ColumnDef<TeamPermissionRow>[] = [
    { header: 'Employee', accessorKey: 'employeeName' },
    { header: 'Code', accessorKey: 'employeeCode' },
    { header: 'Date', accessorFn: (r) => formatDDMMYYYY(r.permissionDate), id: 'date' },
    { header: 'From Time', accessorFn: (r) => formatTime12h(r.fromTime), id: 'fromTime' },
    { header: 'To Time', accessorFn: (r) => formatTime12h(r.toTime), id: 'toTime' },
    { header: 'Duration', accessorFn: (r) => formatHoursMinutes(r.durationMinutes), id: 'duration' },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ getValue }) => {
        const status = getValue<RequestStatus>();
        return <StatusBadge status={status as StatusKind} label={statusLabels[status]} />;
      },
    },
  ];
  const exportColumns: ExportColumn<TeamPermissionRow>[] = [
    { header: 'Employee', accessor: (r) => r.employeeName },
    { header: 'Code', accessor: (r) => r.employeeCode },
    { header: 'Date', accessor: (r) => formatDDMMYYYY(r.permissionDate) },
    { header: 'From Time', accessor: (r) => formatTime12h(r.fromTime) },
    { header: 'To Time', accessor: (r) => formatTime12h(r.toTime) },
    { header: 'Duration', accessor: (r) => formatHoursMinutes(r.durationMinutes) },
    { header: 'Status', accessor: (r) => statusLabels[r.status] },
  ];
  return { columns, exportColumns, rows };
}

export default function TeamReportsPage() {
  const { authSession } = useAuth();
  const managerId = authSession?.employee.id;
  const { data: team } = useTeamMembers(managerId);
  const teamIds = useMemo(() => (team ?? []).map((m) => m.id), [team]);

  const initial = defaultMonthRange();
  const [fromDate, setFromDate] = useState(initial.from);
  const [toDate, setToDate] = useState(initial.to);
  const [appliedRange, setAppliedRange] = useState(initial);
  const [reportType, setReportType] = useState<ReportType>('attendance');
  const [employeeFilter, setEmployeeFilter] = useState('all');

  const rangeStart = new Date(`${appliedRange.from}T00:00:00`);
  const rangeEnd = new Date(`${appliedRange.to}T00:00:00`);

  const { data: attendanceRows, isLoading: attendanceLoading } = useTeamReportData(teamIds, rangeStart, rangeEnd);
  const { data: leaveRows, isLoading: leaveLoading } = useTeamLeaveRequests(teamIds);
  const { data: permissionRows, isLoading: permissionLoading } = useTeamPermissionRequests(teamIds, rangeStart, rangeEnd);

  const employeeOptions = useMemo(
    () => [{ value: 'all', label: 'All' }, ...(team ?? []).map((m) => ({ value: m.id, label: m.employeeName }))],
    [team],
  );

  const filteredAttendance = useMemo(
    () => (attendanceRows ?? []).filter((r) => employeeFilter === 'all' || r.employeeId === employeeFilter),
    [attendanceRows, employeeFilter],
  );
  const filteredLeave = useMemo(
    () =>
      (leaveRows ?? []).filter(
        (r) =>
          (employeeFilter === 'all' || r.employeeId === employeeFilter) &&
          r.fromDate <= appliedRange.to &&
          r.toDate >= appliedRange.from,
      ),
    [leaveRows, employeeFilter, appliedRange],
  );
  const filteredPermission = useMemo(
    () => (permissionRows ?? []).filter((r) => employeeFilter === 'all' || r.employeeId === employeeFilter),
    [permissionRows, employeeFilter],
  );

  const report = useMemo(() => {
    switch (reportType) {
      case 'attendance':
        return attendanceReport(filteredAttendance);
      case 'late':
        return lateReport(filteredAttendance);
      case 'absent':
        return absentReport(filteredAttendance);
      case 'early_going':
        return earlyGoingReport(filteredAttendance);
      case 'overtime':
        return overtimeReport(filteredAttendance);
      case 'leave':
        return leaveReport(filteredLeave);
      case 'permission':
        return permissionReport(filteredPermission);
    }
  }, [reportType, filteredAttendance, filteredLeave, filteredPermission]);

  const isLoading = attendanceLoading || leaveLoading || permissionLoading;
  const reportLabel = reportTypeOptions.find((o) => o.value === reportType)?.label ?? 'Report';
  const filenameBase = `team-${reportType}-${appliedRange.from}-to-${appliedRange.to}`;

  return (
    <div>
      <Breadcrumb items={[{ label: 'Manager Self Service' }, { label: 'Team Reports' }]} />

      <div className="overflow-hidden rounded border border-slate-200 bg-white">
        <PageHeader title="Team Reports" />

        <FilterBar
          actions={
            <>
              <FilterButton onClick={() => setAppliedRange({ from: fromDate, to: toDate })} variant="primary">
                Apply
              </FilterButton>
              <FilterButton onClick={() => exportToCsv(report.exportColumns as ExportColumn<unknown>[], report.rows, `${filenameBase}.csv`)}>
                <span className="flex items-center gap-1.5">
                  <FileDown className="h-3.5 w-3.5" /> CSV
                </span>
              </FilterButton>
              <FilterButton onClick={() => exportToExcel(report.exportColumns as ExportColumn<unknown>[], report.rows, `${filenameBase}.xlsx`)}>
                <span className="flex items-center gap-1.5">
                  <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
                </span>
              </FilterButton>
              <FilterButton
                onClick={() => exportToPdf(report.exportColumns as ExportColumn<unknown>[], report.rows, `${filenameBase}.pdf`, reportLabel)}
              >
                <span className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" /> PDF
                </span>
              </FilterButton>
            </>
          }
        >
          <FilterField label="Report">
            <FilterSelect value={reportType} onChange={(v) => setReportType(v as ReportType)} options={reportTypeOptions} />
          </FilterField>
          <FilterField label="Employee">
            <FilterSelect value={employeeFilter} onChange={setEmployeeFilter} options={employeeOptions} />
          </FilterField>
          <FilterField label="From Date">
            <FilterDate value={fromDate} onChange={setFromDate} />
          </FilterField>
          <FilterField label="To Date">
            <FilterDate value={toDate} onChange={setToDate} />
          </FilterField>
        </FilterBar>

        <DataTable
          columns={report.columns as ColumnDef<unknown, any>[]}
          data={report.rows}
          searchPlaceholder="Search by employee"
          emptyMessage={isLoading ? 'Loading…' : `No ${reportLabel.toLowerCase()} records found for this range.`}
        />
      </div>
    </div>
  );
}
