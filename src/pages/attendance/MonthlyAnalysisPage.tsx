import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  ReferenceLine,
} from 'recharts';
import { FileDown, FileSpreadsheet, FileText } from 'lucide-react';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { FilterBar, FilterField, FilterSelect } from '@/components/ui/FilterBar';
import { useMonthlyAttendanceAnalysis } from '@/hooks/useMonthlyAttendanceAnalysis';
import { sumMonthlySummaries, type MonthlyAttendanceSummary } from '@/lib/monthlyAnalysisEngine';
import { formatHoursMinutes } from '@/lib/dateFormat';
import { exportToCsv, exportToExcel, exportToPdf, type ExportColumn } from '@/lib/exportTable';
import type { MonthlyAttendanceSummaryRow } from '@/types/attendance';

// Chart palette -- validated with the dataviz skill's validator (not
// eyeballed): every pair below passes CVD-separation and normal-vision
// floors in light mode (this app has no dark mode -- no `dark:` classes or
// theme toggle exist anywhere in it, so only light mode is built).
//   present/absent:  #2a78d6 / #eb6834  -> ALL CHECKS PASS
//   leave/wfh:       #1baf7a / #eda100  -> ALL CHECKS PASS (contrast WARN,
//     relief satisfied by the legend + the data table below every chart)
const COLOR = {
  present: '#2a78d6',
  absent: '#eb6834',
  leave: '#1baf7a',
  wfh: '#eda100',
  onDuty: '#e87ba4',
  late: '#008300',
  earlyGoing: '#4a3aa7',
  missingPunch: '#e34948',
  neutral: '#9aa0a6',
};
const GRID_STROKE = '#e2e5e9';
const AXIS_TEXT = { fill: '#64748b', fontSize: 11 };

const MONTH_NAMES = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleDateString('en-US', { month: 'long' }));

function minutesToHours(minutes: number): number {
  return Math.round((minutes / 60) * 10) / 10;
}

interface DashboardCard {
  label: string;
  value: number;
  color: string;
}

function Cards({ summary }: { summary: MonthlyAttendanceSummary }) {
  const cards: DashboardCard[] = [
    { label: 'Present', value: summary.presentDays, color: COLOR.present },
    { label: 'Absent', value: summary.absentDays, color: COLOR.absent },
    { label: 'Leave', value: summary.leaveDays, color: COLOR.leave },
    { label: 'WFH', value: summary.wfhDays, color: COLOR.wfh },
    { label: 'On Duty', value: summary.onDutyDays, color: COLOR.onDuty },
    { label: 'Late', value: summary.lateDays, color: COLOR.late },
    { label: 'Early Going', value: summary.earlyGoingDays, color: COLOR.earlyGoing },
    { label: 'Missing Punch', value: summary.missingPunchDays, color: COLOR.missingPunch },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
      {cards.map((c) => (
        <div key={c.label} className="rounded border border-slate-200 bg-white p-3">
          <p className="mb-1 truncate text-[11px] font-medium text-slate-500">{c.label}</p>
          <p className="text-2xl font-semibold text-slate-800">{c.value}</p>
          <div className="mt-2 h-1 rounded" style={{ backgroundColor: c.color }} />
        </div>
      ))}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-slate-200 bg-white p-4">
      <p className="mb-3 text-xs font-semibold text-slate-600">{title}</p>
      <div className="h-64">{children}</div>
    </div>
  );
}

function defaultMonthYear() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export default function MonthlyAnalysisPage() {
  const initial = defaultMonthYear();
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [managerFilter, setManagerFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');

  const { data, isLoading } = useMonthlyAttendanceAnalysis(year, month);
  const rows = useMemo(() => data ?? [], [data]);

  const employeeOptions = useMemo(
    () => [{ value: 'all', label: 'All' }, ...Array.from(new Map(rows.map((r) => [r.employeeId, r.employeeName])).entries()).map(([id, name]) => ({ value: id, label: name }))],
    [rows],
  );
  const departmentOptions = useMemo(
    () => [{ value: 'all', label: 'All' }, ...Array.from(new Set(rows.map((r) => r.departmentName).filter((d): d is string => Boolean(d)))).map((d) => ({ value: d, label: d }))],
    [rows],
  );
  const managerOptions = useMemo(
    () => [{ value: 'all', label: 'All' }, ...Array.from(new Set(rows.map((r) => r.managerName).filter((m): m is string => Boolean(m)))).map((m) => ({ value: m, label: m }))],
    [rows],
  );
  const locationOptions = useMemo(
    () => [{ value: 'all', label: 'All' }, ...Array.from(new Set(rows.map((r) => r.locationName).filter((l): l is string => Boolean(l)))).map((l) => ({ value: l, label: l }))],
    [rows],
  );

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (employeeFilter !== 'all' && r.employeeId !== employeeFilter) return false;
        if (departmentFilter !== 'all' && r.departmentName !== departmentFilter) return false;
        if (managerFilter !== 'all' && r.managerName !== managerFilter) return false;
        if (locationFilter !== 'all' && r.locationName !== locationFilter) return false;
        return true;
      }),
    [rows, employeeFilter, departmentFilter, managerFilter, locationFilter],
  );

  const totals = useMemo(
    () =>
      sumMonthlySummaries(
        filtered.map((r) => ({
          workingDays: r.workingDays,
          presentDays: r.presentDays,
          absentDays: r.absentDays,
          leaveDays: r.leaveDays,
          wfhDays: r.wfhDays,
          onDutyDays: r.onDutyDays,
          lateDays: r.lateDays,
          earlyGoingDays: r.earlyGoingDays,
          missingPunchDays: r.missingPunchDays,
          effectiveMinutes: r.effectiveMinutes,
          requiredMinutes: r.requiredMinutes,
          shortfallMinutes: r.shortfallMinutes,
          excessStayMinutes: r.excessStayMinutes,
        })),
      ),
    [filtered],
  );

  const presentVsAbsentData = [{ name: 'This Month', Present: totals.presentDays, Absent: totals.absentDays }];
  const leaveVsWfhData = [{ name: 'This Month', Leave: totals.leaveDays, WFH: totals.wfhDays }];
  const trendData = useMemo(
    () =>
      [...filtered]
        .sort((a, b) => a.employeeName.localeCompare(b.employeeName))
        .slice(0, 15)
        .map((r) => ({ name: r.employeeCode, Present: r.presentDays, Absent: r.absentDays })),
    [filtered],
  );
  const departmentComparisonData = useMemo(() => {
    const byDept = new Map<string, { present: number; count: number }>();
    for (const r of filtered) {
      const key = r.departmentName ?? 'Unassigned';
      const entry = byDept.get(key) ?? { present: 0, count: 0 };
      entry.present += r.presentDays;
      entry.count += 1;
      byDept.set(key, entry);
    }
    return Array.from(byDept.entries()).map(([name, { present, count }]) => ({
      name,
      'Avg. Present Days': count > 0 ? Math.round((present / count) * 10) / 10 : 0,
    }));
  }, [filtered]);
  const workingHoursData = useMemo(
    () =>
      [...filtered]
        .sort((a, b) => a.employeeName.localeCompare(b.employeeName))
        .slice(0, 15)
        .map((r) => ({
          name: r.employeeCode,
          'Effective Hours': minutesToHours(r.effectiveMinutes),
          'Required Hours': minutesToHours(r.requiredMinutes),
        })),
    [filtered],
  );
  const excessVsShortfallData = useMemo(
    () =>
      [...filtered]
        .sort((a, b) => a.employeeName.localeCompare(b.employeeName))
        .slice(0, 15)
        .map((r) => ({
          name: r.employeeCode,
          'Excess Stay': minutesToHours(r.excessStayMinutes),
          Shortfall: -minutesToHours(r.shortfallMinutes),
        })),
    [filtered],
  );

  const columns: ColumnDef<MonthlyAttendanceSummaryRow>[] = [
    { header: 'Employee', accessorFn: (r) => `${r.employeeName} [${r.employeeCode}]`, id: 'employee' },
    { header: 'Department', accessorFn: (r) => r.departmentName ?? '-', id: 'department' },
    { header: 'Manager', accessorFn: (r) => r.managerName ?? '-', id: 'manager' },
    { header: 'Location', accessorFn: (r) => r.locationName ?? '-', id: 'location' },
    { header: 'Working Days', accessorKey: 'workingDays' },
    { header: 'Present', accessorKey: 'presentDays' },
    { header: 'Absent', accessorKey: 'absentDays' },
    { header: 'Leave', accessorKey: 'leaveDays' },
    { header: 'WFH', accessorKey: 'wfhDays' },
    { header: 'On Duty', accessorKey: 'onDutyDays' },
    { header: 'Permission', accessorFn: (r) => `${r.permissionCount} (${formatHoursMinutes(r.permissionMinutes)})`, id: 'permission' },
    { header: 'Late Coming', accessorKey: 'lateDays' },
    { header: 'Early Going', accessorKey: 'earlyGoingDays' },
    { header: 'Missing Punch', accessorKey: 'missingPunchDays' },
    { header: 'Effective Hours', accessorFn: (r) => formatHoursMinutes(r.effectiveMinutes), id: 'effectiveHours' },
    { header: 'Required Hours', accessorFn: (r) => formatHoursMinutes(r.requiredMinutes), id: 'requiredHours' },
    { header: 'Shortfall', accessorFn: (r) => formatHoursMinutes(r.shortfallMinutes), id: 'shortfall' },
    { header: 'Excess Stay', accessorFn: (r) => formatHoursMinutes(r.excessStayMinutes), id: 'excessStay' },
    { header: 'Comp-Off Earned', accessorFn: (r) => r.compOffEarned, id: 'compOffEarned' },
    { header: 'Comp-Off Used', accessorFn: (r) => r.compOffUsed, id: 'compOffUsed' },
  ];

  const exportColumns: ExportColumn<MonthlyAttendanceSummaryRow>[] = [
    { header: 'Employee', accessor: (r) => r.employeeName },
    { header: 'Employee Code', accessor: (r) => r.employeeCode },
    { header: 'Department', accessor: (r) => r.departmentName ?? '-' },
    { header: 'Manager', accessor: (r) => r.managerName ?? '-' },
    { header: 'Location', accessor: (r) => r.locationName ?? '-' },
    { header: 'Working Days', accessor: (r) => r.workingDays },
    { header: 'Present', accessor: (r) => r.presentDays },
    { header: 'Absent', accessor: (r) => r.absentDays },
    { header: 'Leave', accessor: (r) => r.leaveDays },
    { header: 'WFH', accessor: (r) => r.wfhDays },
    { header: 'On Duty', accessor: (r) => r.onDutyDays },
    { header: 'Permission Count', accessor: (r) => r.permissionCount },
    { header: 'Permission Minutes', accessor: (r) => r.permissionMinutes },
    { header: 'Late Coming', accessor: (r) => r.lateDays },
    { header: 'Early Going', accessor: (r) => r.earlyGoingDays },
    { header: 'Missing Punch', accessor: (r) => r.missingPunchDays },
    { header: 'Effective Hours', accessor: (r) => formatHoursMinutes(r.effectiveMinutes) },
    { header: 'Required Hours', accessor: (r) => formatHoursMinutes(r.requiredMinutes) },
    { header: 'Shortfall', accessor: (r) => formatHoursMinutes(r.shortfallMinutes) },
    { header: 'Excess Stay', accessor: (r) => formatHoursMinutes(r.excessStayMinutes) },
    { header: 'Comp-Off Earned', accessor: (r) => r.compOffEarned },
    { header: 'Comp-Off Used', accessor: (r) => r.compOffUsed },
  ];

  const filenameBase = `monthly-attendance-analysis-${year}-${String(month).padStart(2, '0')}`;

  return (
    <div className="space-y-4">
      <Breadcrumb items={[{ label: 'Attendance' }, { label: 'My Report' }, { label: 'Monthly Analysis' }]} />

      <div className="overflow-hidden rounded border border-slate-200 bg-white">
        <PageHeader
          title="Monthly Attendance Analysis"
          actions={
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => exportToCsv(exportColumns, filtered, `${filenameBase}.csv`)} className="flex items-center gap-1 rounded bg-white/15 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-white/25">
                <FileDown className="h-3.5 w-3.5" /> CSV
              </button>
              <button type="button" onClick={() => exportToExcel(exportColumns, filtered, `${filenameBase}.xlsx`)} className="flex items-center gap-1 rounded bg-white/15 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-white/25">
                <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
              </button>
              <button
                type="button"
                onClick={() => exportToPdf(exportColumns, filtered, `${filenameBase}.pdf`, `Monthly Attendance Analysis — ${MONTH_NAMES[month - 1]} ${year}`)}
                className="flex items-center gap-1 rounded bg-white/15 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-white/25"
              >
                <FileText className="h-3.5 w-3.5" /> PDF
              </button>
            </div>
          }
        />

        <FilterBar>
          <FilterField label="Month">
            <FilterSelect value={String(month)} onChange={(v) => setMonth(Number(v))} options={MONTH_NAMES.map((m, i) => ({ value: String(i + 1), label: m }))} />
          </FilterField>
          <FilterField label="Year">
            <FilterSelect
              value={String(year)}
              onChange={(v) => setYear(Number(v))}
              options={Array.from({ length: 6 }, (_, i) => defaultMonthYear().year - 3 + i).map((y) => ({ value: String(y), label: String(y) }))}
            />
          </FilterField>
          <FilterField label="Employee">
            <FilterSelect value={employeeFilter} onChange={setEmployeeFilter} options={employeeOptions} />
          </FilterField>
          <FilterField label="Department">
            <FilterSelect value={departmentFilter} onChange={setDepartmentFilter} options={departmentOptions} />
          </FilterField>
          <FilterField label="Manager">
            <FilterSelect value={managerFilter} onChange={setManagerFilter} options={managerOptions} />
          </FilterField>
          <FilterField label="Location">
            <FilterSelect value={locationFilter} onChange={setLocationFilter} options={locationOptions} />
          </FilterField>
        </FilterBar>

        <div className="space-y-4 p-4">
          {isLoading && <p className="text-xs text-slate-400">Loading…</p>}

          <Cards summary={totals} />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartCard title="Present vs Absent">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={presentVsAbsentData} barSize={20}>
                  <CartesianGrid strokeDasharray="0" stroke={GRID_STROKE} vertical={false} />
                  <XAxis dataKey="name" tick={AXIS_TEXT} axisLine={{ stroke: GRID_STROKE }} tickLine={false} />
                  <YAxis tick={AXIS_TEXT} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Present" fill={COLOR.present} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Absent" fill={COLOR.absent} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Leave vs WFH">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={leaveVsWfhData} barSize={20}>
                  <CartesianGrid strokeDasharray="0" stroke={GRID_STROKE} vertical={false} />
                  <XAxis dataKey="name" tick={AXIS_TEXT} axisLine={{ stroke: GRID_STROKE }} tickLine={false} />
                  <YAxis tick={AXIS_TEXT} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Leave" fill={COLOR.leave} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="WFH" fill={COLOR.wfh} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Attendance Trend (Present vs Absent, per employee)">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="0" stroke={GRID_STROKE} vertical={false} />
                  <XAxis dataKey="name" tick={AXIS_TEXT} axisLine={{ stroke: GRID_STROKE }} tickLine={false} />
                  <YAxis tick={AXIS_TEXT} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="Present" stroke={COLOR.present} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: '#ffffff' }} />
                  <Line type="monotone" dataKey="Absent" stroke={COLOR.absent} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: '#ffffff' }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Department Comparison (avg. present days)">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={departmentComparisonData} barSize={20}>
                  <CartesianGrid strokeDasharray="0" stroke={GRID_STROKE} vertical={false} />
                  <XAxis dataKey="name" tick={AXIS_TEXT} axisLine={{ stroke: GRID_STROKE }} tickLine={false} />
                  <YAxis tick={AXIS_TEXT} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="Avg. Present Days" radius={[4, 4, 0, 0]}>
                    {departmentComparisonData.map((_, i) => (
                      <Cell key={i} fill={COLOR.present} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Working Hours (Effective vs Required, per employee)">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={workingHoursData} barSize={20}>
                  <CartesianGrid strokeDasharray="0" stroke={GRID_STROKE} vertical={false} />
                  <XAxis dataKey="name" tick={AXIS_TEXT} axisLine={{ stroke: GRID_STROKE }} tickLine={false} />
                  <YAxis tick={AXIS_TEXT} axisLine={false} tickLine={false} unit="h" />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Effective Hours" fill={COLOR.present} radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="Required Hours" stroke={COLOR.neutral} strokeWidth={2} dot={false} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Excess Stay vs Shortfall (per employee, hours)">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={excessVsShortfallData} barSize={20}>
                  <CartesianGrid strokeDasharray="0" stroke={GRID_STROKE} vertical={false} />
                  <XAxis dataKey="name" tick={AXIS_TEXT} axisLine={{ stroke: GRID_STROKE }} tickLine={false} />
                  <YAxis tick={AXIS_TEXT} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <ReferenceLine y={0} stroke={GRID_STROKE} />
                  <Bar dataKey="Excess Stay" fill={COLOR.present} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Shortfall" fill={COLOR.absent} radius={[0, 0, 4, 4]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <DataTable columns={columns} data={filtered} searchPlaceholder="Search by employee" emptyMessage={isLoading ? 'Loading…' : 'No attendance data for this month.'} />

          <p className="text-[11px] text-slate-400">
            Comp-Off tracking does not exist in this system yet — those two columns always show 0, not fabricated data.
          </p>
        </div>
      </div>
    </div>
  );
}
