import { Laptop, LogIn, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatClockTime, formatHoursMinutes } from '@/lib/dateFormat';
import { deriveWebCheckinAction } from '@/lib/webCheckin';
import { useWebCheckinStatus, useWebCheckinPunch } from '@/hooks/useWebCheckin';

export function WebCheckinCard({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const { data: status, isLoading } = useWebCheckinStatus();
  const punch = useWebCheckinPunch();

  const action = status
    ? deriveWebCheckinAction({ enabled: status.enabled, isWfhToday: status.isWfhToday, lastPunchType: status.lastPunchType })
    : { canCheckIn: false, canCheckOut: false, blockedReason: null };

  return (
    <div className="w-44">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'flex w-44 flex-col items-center gap-2 rounded-md py-6 text-white shadow-sm transition-colors',
          open ? 'bg-card-webcheckin-dark' : 'bg-card-webcheckin',
          !open && 'hover:opacity-90',
        )}
      >
        <Laptop className="h-7 w-7" />
        <span className="px-2 text-center text-xs font-semibold">Web Check-In / Out</span>
      </button>

      {open && (
        <div className="mt-1.5 space-y-2.5 rounded-md border border-slate-200 bg-white p-3 shadow-sm">
          {isLoading || !status ? (
            <p className="text-xs text-slate-400">Loading…</p>
          ) : (
            <>
              <div className="text-xs text-slate-600">
                {status.lastPunchType === null ? (
                  <p>Not checked in today.</p>
                ) : status.lastPunchType === 'in' ? (
                  <p>
                    Checked in at <span className="font-semibold">{formatClockTime(status.lastPunchTime)}</span>
                  </p>
                ) : (
                  <p>
                    Checked out at <span className="font-semibold">{formatClockTime(status.lastPunchTime)}</span>
                  </p>
                )}
                <p className="mt-0.5 text-slate-400">Effective today: {formatHoursMinutes(status.effectiveMinutes)}</p>
              </div>

              {action.blockedReason ? (
                <p className="rounded bg-slate-50 px-2 py-1.5 text-[11px] text-slate-500">{action.blockedReason}</p>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={!action.canCheckIn || punch.isPending}
                    onClick={() => punch.mutate('in')}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded bg-status-approved px-2 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <LogIn className="h-3.5 w-3.5" />
                    Check In
                  </button>
                  <button
                    type="button"
                    disabled={!action.canCheckOut || punch.isPending}
                    onClick={() => punch.mutate('out')}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded bg-status-rejected px-2 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Check Out
                  </button>
                </div>
              )}

              {punch.isError && (
                <p className="rounded bg-status-rejected/10 px-2 py-1.5 text-[11px] text-status-rejected">
                  {(punch.error as Error).message}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
