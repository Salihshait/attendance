import { cn } from '@/lib/utils';
import { formatClockTime, formatHoursMinutes, isSameDay } from '@/lib/dateFormat';
import type { AttendanceDay } from '@/types/attendance';

const statusBarClass: Record<string, string> = {
  weekoff: 'bg-status-weekoff text-white',
  holiday: 'bg-status-holiday text-white',
  absent: 'bg-status-absent text-white',
};

export function AttendanceDayCell({
  date,
  inCurrentMonth,
  attendance,
  onClick,
}: {
  date: Date;
  inCurrentMonth: boolean;
  attendance: AttendanceDay | undefined;
  onClick: () => void;
}) {
  const today = isSameDay(date, new Date());
  const isFuture = date > new Date(new Date().toDateString());

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-h-[108px] flex-col gap-1 border border-table-border p-1.5 text-left text-[11px] transition-colors hover:bg-primary-50/40',
        !inCurrentMonth && 'bg-slate-50/70 text-slate-400',
        today && 'ring-2 ring-inset ring-primary-500',
      )}
    >
      <div className="flex items-center justify-between">
        <span className={cn('font-semibold', today ? 'text-primary-600' : inCurrentMonth ? 'text-slate-700' : 'text-slate-300')}>
          {date.getDate()}
        </span>
        {today && <span className="text-[10px] font-semibold text-primary-500">Today</span>}
      </div>

      {inCurrentMonth && (
        <>
          {!attendance && !isFuture && <span className="text-slate-300">-</span>}

          {attendance && (
            <>
              {attendance.shiftName && attendance.dayStatus !== 'weekoff' && (
                <span className="font-medium text-slate-500">{attendance.shiftName}</span>
              )}

              {(attendance.dayStatus === 'weekoff' || attendance.dayStatus === 'holiday' || attendance.dayStatus === 'absent') && (
                <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold', statusBarClass[attendance.dayStatus])}>
                  {attendance.dayStatus === 'weekoff' && 'Weekoff'}
                  {attendance.dayStatus === 'holiday' && (attendance.remarks || 'Holiday')}
                  {attendance.dayStatus === 'absent' && 'Absent: Full Day'}
                </span>
              )}

              {(attendance.dayStatus === 'present' || attendance.dayStatus === 'half_day') && (
                <>
                  <span className="text-slate-600">
                    First IN {formatClockTime(attendance.checkIn)} · Last OUT {formatClockTime(attendance.checkOut)}
                  </span>
                  <span className="text-slate-600">Gross: {formatHoursMinutes(attendance.grossMinutes)}</span>
                  <span className="text-slate-600">Break: {formatHoursMinutes(attendance.breakMinutes)}</span>
                  {attendance.hasExcessBreak && (
                    <span className="rounded bg-status-rejected/15 px-1.5 py-0.5 text-status-rejected">Break exceeds policy</span>
                  )}
                  <span className="text-slate-600">Effective Hours: {formatHoursMinutes(attendance.effectiveMinutes)}</span>
                  {attendance.shortfallMinutes > 0 && (
                    <span className="rounded bg-status-rejected/15 px-1.5 py-0.5 text-status-rejected">
                      Shortfall: {formatHoursMinutes(attendance.shortfallMinutes)}
                    </span>
                  )}
                  {attendance.excessStayMinutes > 0 && (
                    <span className="rounded bg-status-approved/15 px-1.5 py-0.5 text-status-approved">
                      Excess stay: {formatHoursMinutes(attendance.excessStayMinutes)}
                    </span>
                  )}
                  {attendance.earlyGoingMinutes > 0 && (
                    <span className="rounded bg-status-early/15 px-1.5 py-0.5 text-status-early">
                      Early Going: {formatHoursMinutes(attendance.earlyGoingMinutes)}
                    </span>
                  )}
                  {(attendance.missingIn || attendance.missingOut) && (
                    <span className="rounded bg-status-absent/15 px-1.5 py-0.5 text-status-absent">
                      {attendance.missingIn && attendance.missingOut
                        ? 'Missing In & Out'
                        : attendance.missingIn
                          ? 'Missing In'
                          : 'Missing Out'}
                    </span>
                  )}
                  <span className="text-[10px] text-slate-400">
                    {attendance.validationStatus === 'completed' ? 'Validation completed' : 'Validation pending'}
                  </span>
                  <span className="font-semibold text-status-present">
                    Present: {attendance.dayStatus === 'half_day' ? 'Half Day' : 'Full Day'}
                  </span>
                </>
              )}
            </>
          )}
        </>
      )}
    </button>
  );
}
