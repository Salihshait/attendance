import { useState } from 'react';
import { Check, Clock, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useActOnExitClearance } from '@/hooks/useExitQueries';
import { Modal } from '@/components/ui/Modal';
import type { ExitClearanceRow } from '@/types/exit';

const DEPARTMENT_LABELS: Record<ExitClearanceRow['department'], string> = {
  manager: 'Manager',
  hr: 'HR',
  it: 'IT',
  finance: 'Finance',
  admin: 'Admin',
};

const STATUS_STYLES: Record<ExitClearanceRow['status'], string> = {
  pending: 'bg-status-pending/15 text-status-pending border-status-pending/30',
  cleared: 'bg-status-approved/15 text-status-approved border-status-approved/30',
  rejected: 'bg-status-rejected/15 text-status-rejected border-status-rejected/30',
};

const STATUS_ICONS: Record<ExitClearanceRow['status'], typeof Check> = {
  pending: Clock,
  cleared: Check,
  rejected: X,
};

export function ClearanceTimeline({
  clearances,
  isLoading,
  canActOn,
}: {
  clearances: ExitClearanceRow[];
  isLoading?: boolean;
  /** Departments the current viewer is authorized to mark (e.g. HR sees all, a manager only sees 'manager'). Omit for a read-only view. */
  canActOn?: (department: ExitClearanceRow['department']) => boolean;
}) {
  const actOnClearance = useActOnExitClearance();
  const [rejecting, setRejecting] = useState<ExitClearanceRow | null>(null);
  const [rejectRemarks, setRejectRemarks] = useState('');

  function confirmReject() {
    if (!rejecting) return;
    actOnClearance.mutate({ clearanceId: rejecting.id, exitRequestId: rejecting.exitRequestId, status: 'rejected', remarks: rejectRemarks || undefined });
    setRejecting(null);
    setRejectRemarks('');
  }

  if (isLoading) return <p className="px-3 py-6 text-center text-xs text-slate-400">Loading…</p>;
  if (clearances.length === 0) {
    return <p className="px-3 py-6 text-center text-xs text-slate-400">Clearance has not started yet — it opens once HR approves the resignation.</p>;
  }

  return (
    <>
    <ol className="space-y-2">
      {clearances.map((c) => {
        const Icon = STATUS_ICONS[c.status];
        const actionable = c.status === 'pending' && (canActOn?.(c.department) ?? false);
        return (
          <li key={c.id} className="flex items-start gap-3 rounded border border-slate-200 p-3 text-xs">
            <span className={cn('mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border', STATUS_STYLES[c.status])}>
              <Icon className="h-3.5 w-3.5" />
            </span>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700">{DEPARTMENT_LABELS[c.department]}</span>
                <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-semibold capitalize', STATUS_STYLES[c.status])}>{c.status}</span>
              </div>
              {c.remarks && <p className="mt-1 text-slate-500">{c.remarks}</p>}
              {c.clearedByName && c.clearedAt && (
                <p className="mt-1 text-[10px] text-slate-400">
                  by {c.clearedByName} · {new Date(c.clearedAt).toLocaleString()}
                </p>
              )}
              {actionable && (
                <div className="mt-2 flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => actOnClearance.mutate({ clearanceId: c.id, exitRequestId: c.exitRequestId, status: 'cleared' })}
                    disabled={actOnClearance.isPending}
                    className="rounded bg-status-approved px-2.5 py-1 text-[11px] font-semibold text-white hover:opacity-90 disabled:opacity-60"
                  >
                    Mark Cleared
                  </button>
                  <button
                    type="button"
                    onClick={() => setRejecting(c)}
                    disabled={actOnClearance.isPending}
                    className="rounded border border-status-rejected px-2.5 py-1 text-[11px] font-semibold text-status-rejected hover:bg-status-rejected/10 disabled:opacity-60"
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>

    {rejecting && (
      <Modal title={`Reject ${DEPARTMENT_LABELS[rejecting.department]} Clearance`} onClose={() => setRejecting(null)}>
        <div className="space-y-3 text-xs">
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-slate-500">Reason (optional)</span>
            <textarea
              value={rejectRemarks}
              onChange={(e) => setRejectRemarks(e.target.value)}
              rows={3}
              className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs outline-none focus:border-primary-500"
            />
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setRejecting(null)} className="rounded border border-slate-300 px-3.5 py-1.5 text-slate-600">
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmReject}
              disabled={actOnClearance.isPending}
              className="rounded bg-status-rejected px-3.5 py-1.5 font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {actOnClearance.isPending ? 'Submitting…' : 'Reject'}
            </button>
          </div>
        </div>
      </Modal>
    )}
    </>
  );
}
