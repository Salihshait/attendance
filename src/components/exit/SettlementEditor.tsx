import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Lock } from 'lucide-react';
import { Field, inputClass } from '@/components/attendance/LeaveRequestForm';
import { useAuth } from '@/auth/useAuth';
import { useExitSettlement, useUpsertExitSettlement } from '@/hooks/useExitQueries';
import { calculateFinalSettlement } from '@/lib/settlementCalc';
import { formatCurrency } from '@/lib/utils';

interface FormValues {
  lastWorkingDate: string;
  leaveEncashment: number;
  noticePay: number;
  pendingSalary: number;
  deductions: number;
  bonus: number;
  otherAdjustments: number;
}

export function SettlementEditor({ exitRequestId, defaultLastWorkingDate }: { exitRequestId: string; defaultLastWorkingDate: string }) {
  const { authSession } = useAuth();
  const { data: settlement } = useExitSettlement(exitRequestId);
  const upsert = useUpsertExitSettlement();
  const [saved, setSaved] = useState(false);

  const { register, handleSubmit, watch } = useForm<FormValues>({
    values: settlement
      ? {
          lastWorkingDate: settlement.lastWorkingDate,
          leaveEncashment: settlement.leaveEncashment,
          noticePay: settlement.noticePay,
          pendingSalary: settlement.pendingSalary,
          deductions: settlement.deductions,
          bonus: settlement.bonus,
          otherAdjustments: settlement.otherAdjustments,
        }
      : {
          lastWorkingDate: defaultLastWorkingDate,
          leaveEncashment: 0,
          noticePay: 0,
          pendingSalary: 0,
          deductions: 0,
          bonus: 0,
          otherAdjustments: 0,
        },
  });

  const values = watch();
  const liveTotal = calculateFinalSettlement({
    pendingSalary: Number(values.pendingSalary) || 0,
    leaveEncashment: Number(values.leaveEncashment) || 0,
    bonus: Number(values.bonus) || 0,
    otherAdjustments: Number(values.otherAdjustments) || 0,
    noticePay: Number(values.noticePay) || 0,
    deductions: Number(values.deductions) || 0,
  });

  const isReleased = settlement?.status === 'released';

  async function save(release: boolean) {
    if (!authSession) return;
    const v = watch();
    await upsert.mutateAsync({
      exitRequestId,
      lastWorkingDate: v.lastWorkingDate,
      leaveEncashment: Number(v.leaveEncashment) || 0,
      noticePay: Number(v.noticePay) || 0,
      pendingSalary: Number(v.pendingSalary) || 0,
      deductions: Number(v.deductions) || 0,
      bonus: Number(v.bonus) || 0,
      otherAdjustments: Number(v.otherAdjustments) || 0,
      release,
      releasedBy: authSession.employee.id,
    });
    setSaved(true);
  }

  return (
    <form onSubmit={handleSubmit(() => save(false))} className="space-y-3 text-xs">
      {isReleased && (
        <p className="flex items-center gap-1.5 rounded bg-status-approved/10 px-3 py-2 text-status-approved">
          <Lock className="h-3.5 w-3.5" /> Released to employee on {settlement?.releasedAt ? new Date(settlement.releasedAt).toLocaleString() : '-'}.
        </p>
      )}

      <Field label="Last Working Date">
        <input type="date" {...register('lastWorkingDate')} disabled={isReleased} className={inputClass} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Pending Salary">
          <input type="number" step="0.01" {...register('pendingSalary')} disabled={isReleased} className={inputClass} />
        </Field>
        <Field label="Leave Encashment">
          <input type="number" step="0.01" {...register('leaveEncashment')} disabled={isReleased} className={inputClass} />
        </Field>
        <Field label="Bonus">
          <input type="number" step="0.01" {...register('bonus')} disabled={isReleased} className={inputClass} />
        </Field>
        <Field label="Other Adjustments">
          <input type="number" step="0.01" {...register('otherAdjustments')} disabled={isReleased} className={inputClass} />
        </Field>
        <Field label="Notice Pay (recovery)">
          <input type="number" step="0.01" {...register('noticePay')} disabled={isReleased} className={inputClass} />
        </Field>
        <Field label="Deductions">
          <input type="number" step="0.01" {...register('deductions')} disabled={isReleased} className={inputClass} />
        </Field>
      </div>

      <div className="flex justify-between rounded bg-primary-50 px-3 py-2 font-bold text-primary-600">
        <span>Final Settlement</span>
        <span>{formatCurrency(liveTotal)}</span>
      </div>

      {upsert.isError && <p className="rounded bg-status-rejected/10 px-3 py-2 text-status-rejected">{(upsert.error as Error).message}</p>}
      {saved && !upsert.isError && <p className="text-status-approved">Saved.</p>}

      {!isReleased && (
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="submit"
            disabled={upsert.isPending}
            className="rounded border border-primary-300 px-3.5 py-1.5 font-semibold text-primary-600 hover:bg-primary-50 disabled:opacity-60"
          >
            Save Draft
          </button>
          <button
            type="button"
            onClick={() => save(true)}
            disabled={upsert.isPending}
            className="rounded bg-primary-500 px-3.5 py-1.5 font-semibold text-white hover:bg-primary-600 disabled:opacity-60"
          >
            {upsert.isPending ? 'Releasing…' : 'Release to Employee'}
          </button>
        </div>
      )}
    </form>
  );
}
