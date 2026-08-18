import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, ClipboardEdit, CalendarPlus, LogIn, Clock3, Home } from 'lucide-react';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { Modal } from '@/components/ui/Modal';
import { AttendanceDayCell } from '@/components/attendance/AttendanceDayCell';
import { MonthlyDetailsPanel, type MonthlyDetailsData } from '@/components/attendance/MonthlyDetailsPanel';
import { LeaveRequestForm } from '@/components/attendance/LeaveRequestForm';
import { PermissionRequestForm } from '@/components/attendance/PermissionRequestForm';
import { RegularizationForm } from '@/components/attendance/RegularizationForm';
import { WfhRequestForm } from '@/components/attendance/WfhRequestForm';
import { useAuth } from '@/auth/useAuth';
import { useAttendanceRange } from '@/hooks/useAttendanceQueries';
import { useLeaveBalances, useOndutyRequests, usePermissionRequests, useRegularizations } from '@/hooks/useRequestQueries';
import { findApplicableLeaveBalance } from '@/lib/leaveValidation';
import { formatDateISO } from '@/lib/utils';
import { formatHoursMinutes, formatMonthYear, getMonthGridDates } from '@/lib/dateFormat';
import { useQueryClient } from '@tanstack/react-query';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type ApplyKind = 'regularize' | 'leave' | 'present' | 'permission' | 'wfh' | null;

export default function AttendanceCalendarPage() {
  const { authSession } = useAuth();
  const queryClient = useQueryClient();
  const [viewDate, setViewDate] = useState(() => new Date());
  const [applyKind, setApplyKind] = useState<ApplyKind>(null);
  const [applyDate, setApplyDate] = useState<string | undefined>(undefined);

  const gridDates = useMemo(() => getMonthGridDates(viewDate), [viewDate]);
  const gridStart = gridDates[0];
  const gridEnd = gridDates[gridDates.length - 1];
  const monthStart = useMemo(() => new Date(viewDate.getFullYear(), viewDate.getMonth(), 1), [viewDate]);
  const monthEnd = useMemo(() => new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0), [viewDate]);

  const employeeId = authSession?.employee.id;
  const { data: attendance, isLoading, refetch } = useAttendanceRange(employeeId, gridStart, gridEnd);
  const { data: leaveBalances } = useLeaveBalances(employeeId);
  const { data: permissionRequests } = usePermissionRequests(employeeId, authSession?.employee.displayName ?? '');
  const { data: regularizations } = useRegularizations(employeeId);
  const { data: ondutyRequests } = useOndutyRequests(employeeId);

  const attendanceByDate = useMemo(() => {
    const map = new Map<string, NonNullable<typeof attendance>[number]>();
    for (const row of attendance ?? []) map.set(row.attendanceDate, row);
    return map;
  }, [attendance]);

  const monthlyDetails: MonthlyDetailsData = useMemo(() => {
    const monthRows = (attendance ?? []).filter((row) => {
      const d = new Date(row.attendanceDate);
      return d >= monthStart && d <= monthEnd;
    });

    const excessStay = monthRows.reduce((sum, r) => sum + r.excessStayMinutes, 0);
    const excessStayDays = monthRows.filter((r) => r.excessStayMinutes > 0).length;
    const shortfall = monthRows.reduce((sum, r) => sum + r.shortfallMinutes, 0);
    const lateRows = monthRows.filter((r) => r.lateMinutes > 0);
    const earlyRows = monthRows.filter((r) => r.earlyGoingMinutes > 0);

    const currentYear = viewDate.getFullYear();
    const permissionThisYear = (permissionRequests ?? []).filter(
      (p) => new Date(p.permissionDate).getFullYear() === currentYear,
    );
    const permissionMinutes = permissionThisYear.reduce((sum, p) => sum + p.durationMinutes, 0);

    const presentCorrections = (regularizations ?? []).filter(
      (r) => r.regularizationType === 'present_correction' && r.status === 'approved' && new Date(r.attendanceDate).getFullYear() === currentYear,
    ).length;

    const approvedOndutyThisYear = (ondutyRequests ?? []).filter(
      (r) => r.status === 'approved' && new Date(r.fromDate).getFullYear() === currentYear,
    );
    const wfhCount = approvedOndutyThisYear.filter((r) => r.ondutyType === 'work_from_home').length;
    const onDutyCount = approvedOndutyThisYear.filter((r) => r.ondutyType === 'on_duty').length;

    // CL/SL now have 12 monthly leave_balances rows (0042) — this panel
    // shows one row per type for the currently-viewed month, not every
    // period at once. Yearly/none-accrual types still have exactly one row,
    // so findApplicableLeaveBalance resolves to it regardless of the date.
    const monthReferenceDate = formatDateISO(monthStart);
    const leaveTypeIds = Array.from(new Set((leaveBalances ?? []).map((b) => b.leaveTypeId)));
    const monthLeaveBalances = leaveTypeIds
      .map((id) => findApplicableLeaveBalance(leaveBalances ?? [], id, monthReferenceDate))
      .filter((b): b is NonNullable<typeof b> => Boolean(b));

    return {
      shortfall: {
        excessStay: `${formatHoursMinutes(excessStay)} (${excessStayDays} ${excessStayDays === 1 ? 'day' : 'days'})`,
        shortfall: formatHoursMinutes(shortfall),
        difference: formatHoursMinutes(excessStay - shortfall),
      },
      leaveBalances: monthLeaveBalances,
      // No entitlement/balance concept exists for on-duty/WFH in the schema
      // (unlike leave types) — only `used` (approved-request count) is real.
      onduty: [
        { label: 'Work from Home', opening: 0, credit: 0, used: wfhCount, balance: 0 },
        { label: 'On Duty', opening: 0, credit: 0, used: onDutyCount, balance: 0 },
      ],
      permission: {
        opening: '00:00',
        credit: '00:00',
        used: `${formatHoursMinutes(permissionMinutes)}(${permissionThisYear.length})`,
        balance: '-',
      },
      present: { opening: 0, credit: 0, used: presentCorrections, balance: 0 },
      late: { count: lateRows.length, hours: formatHoursMinutes(lateRows.reduce((s, r) => s + r.lateMinutes, 0)) },
      earlyGoing: {
        count: earlyRows.length,
        hours: formatHoursMinutes(earlyRows.reduce((s, r) => s + r.earlyGoingMinutes, 0)),
      },
    };
  }, [attendance, leaveBalances, permissionRequests, regularizations, ondutyRequests, monthStart, monthEnd, viewDate]);

  function openApply(kind: ApplyKind, date?: Date) {
    setApplyKind(kind);
    setApplyDate(date ? formatDateISO(date) : formatDateISO(new Date()));
  }

  function closeApply() {
    setApplyKind(null);
    if (employeeId) {
      queryClient.invalidateQueries({ queryKey: ['leave-requests', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['permission-requests', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['regularizations', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['leave-balances', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['onduty-requests', employeeId] });
    }
  }

  return (
    <div>
      <Breadcrumb items={[{ label: 'Attendance' }, { label: 'Calendar' }]} />

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="flex-1 overflow-hidden rounded border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}
                className="rounded p-1 text-slate-500 hover:bg-slate-100"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewDate(new Date())}
                className="rounded border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
              >
                today
              </button>
            </div>
            <h1 className="text-base font-semibold text-primary-600">{formatMonthYear(viewDate)}</h1>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => refetch()}
                className="rounded p-1 text-slate-500 hover:bg-slate-100"
                aria-label="Refresh"
              >
                <RefreshCw className={isLoading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
              </button>
              <button
                type="button"
                onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}
                className="rounded p-1 text-slate-500 hover:bg-slate-100"
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7">
            {WEEKDAYS.map((wd) => (
              <div key={wd} className="border border-table-border bg-table-header px-2 py-1.5 text-center text-xs font-semibold text-slate-600">
                {wd}
              </div>
            ))}
            {gridDates.map((date) => (
              <AttendanceDayCell
                key={date.toISOString()}
                date={date}
                inCurrentMonth={date.getMonth() === viewDate.getMonth()}
                attendance={attendanceByDate.get(formatDateISO(date))}
                onClick={() => openApply('regularize', date)}
              />
            ))}
          </div>
        </div>

        <aside className="w-full shrink-0 space-y-4 lg:w-80">
          <div className="rounded border border-slate-200 bg-white p-4">
            <p className="mb-2 text-sm font-semibold text-status-approved">Apply</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => openApply('regularize')}
                className="flex items-center gap-1.5 rounded bg-card-info px-3 py-1.5 text-xs font-semibold text-white hover:bg-card-info-dark"
              >
                <ClipboardEdit className="h-3.5 w-3.5" /> Regularize
              </button>
              <button
                type="button"
                onClick={() => openApply('leave')}
                className="flex items-center gap-1.5 rounded bg-primary-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-600"
              >
                <CalendarPlus className="h-3.5 w-3.5" /> Leave
              </button>
              <button
                type="button"
                onClick={() => openApply('present')}
                className="flex items-center gap-1.5 rounded bg-primary-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-600"
              >
                <LogIn className="h-3.5 w-3.5" /> Present
              </button>
              <button
                type="button"
                onClick={() => openApply('permission')}
                className="flex items-center gap-1.5 rounded bg-primary-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-600"
              >
                <Clock3 className="h-3.5 w-3.5" /> Permission
              </button>
              <button
                type="button"
                onClick={() => openApply('wfh')}
                className="flex items-center gap-1.5 rounded bg-primary-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-600"
              >
                <Home className="h-3.5 w-3.5" /> Work From Home
              </button>
            </div>
          </div>

          <div className="rounded border border-slate-200 bg-white p-4">
            <p className="mb-3 text-sm font-semibold text-card-info">Monthly Details</p>
            <MonthlyDetailsPanel data={monthlyDetails} />
          </div>
        </aside>
      </div>

      {applyKind === 'regularize' && (
        <Modal title="Attendance Regularization" onClose={closeApply}>
          <RegularizationForm defaultDate={applyDate} onDone={closeApply} />
        </Modal>
      )}
      {applyKind === 'leave' && (
        <Modal title="Apply Leave" onClose={closeApply}>
          <LeaveRequestForm defaultDate={applyDate} onDone={closeApply} />
        </Modal>
      )}
      {applyKind === 'present' && (
        <Modal title="Present Request" onClose={closeApply}>
          <RegularizationForm defaultDate={applyDate} onDone={closeApply} />
        </Modal>
      )}
      {applyKind === 'permission' && (
        <Modal title="Apply Permission" onClose={closeApply}>
          <PermissionRequestForm defaultDate={applyDate} onDone={closeApply} />
        </Modal>
      )}
      {applyKind === 'wfh' && (
        <Modal title="Work From Home Request" onClose={closeApply}>
          <WfhRequestForm defaultDate={applyDate} onDone={closeApply} />
        </Modal>
      )}
    </div>
  );
}
