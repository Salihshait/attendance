import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/auth/useAuth';
import { useCreatePermissionRequest } from '@/hooks/useRequestQueries';
import { Field, inputClass } from './LeaveRequestForm';
import { ORG_ID } from '@/lib/orgContext';

const schema = z
  .object({
    permissionDate: z.string().min(1, 'Required'),
    fromTime: z.string().min(1, 'Required'),
    toTime: z.string().min(1, 'Required'),
    reason: z.string().min(3, 'Please enter a reason'),
  })
  .refine((v) => v.toTime > v.fromTime, { message: 'To Time must be after From Time', path: ['toTime'] });

type FormValues = z.infer<typeof schema>;

function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function PermissionRequestForm({ defaultDate, onDone }: { defaultDate?: string; onDone: () => void }) {
  const { authSession } = useAuth();
  const createPermission = useCreatePermissionRequest();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { permissionDate: defaultDate } });

  const fromTime = watch('fromTime');
  const toTime = watch('toTime');
  const durationMinutes = fromTime && toTime && toTime > fromTime ? toMinutes(toTime) - toMinutes(fromTime) : 0;

  if (!authSession) return null;

  async function onSubmit(values: FormValues) {
    if (!authSession) return;
    await createPermission.mutateAsync({
      organizationId: ORG_ID,
      employeeId: authSession.employee.id,
      reportingManagerId: authSession.employee.reportingManagerId ?? null,
      permissionDate: values.permissionDate,
      fromTime: values.fromTime,
      toTime: values.toTime,
      durationMinutes,
      reason: values.reason,
    });
    onDone();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 text-xs">
      <Field label="Date" error={errors.permissionDate?.message}>
        <input type="date" {...register('permissionDate')} className={inputClass} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="From Time" error={errors.fromTime?.message}>
          <input type="time" {...register('fromTime')} className={inputClass} />
        </Field>
        <Field label="To Time" error={errors.toTime?.message}>
          <input type="time" {...register('toTime')} className={inputClass} />
        </Field>
      </div>

      <div className="rounded bg-slate-50 px-3 py-2 text-slate-600">
        Duration: {durationMinutes > 0 ? `${String(Math.floor(durationMinutes / 60)).padStart(2, '0')}:${String(durationMinutes % 60).padStart(2, '0')}` : '-'}
      </div>

      <Field label="Reason" error={errors.reason?.message}>
        <textarea {...register('reason')} rows={3} className={inputClass} />
      </Field>

      {createPermission.isError && (
        <p className="rounded bg-status-rejected/10 px-3 py-2 text-status-rejected">
          {(createPermission.error as Error).message}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onDone} className="rounded border border-slate-300 px-3.5 py-1.5 text-slate-600">
          Cancel
        </button>
        <button
          type="submit"
          disabled={createPermission.isPending}
          className="rounded bg-primary-500 px-3.5 py-1.5 font-semibold text-white hover:bg-primary-600 disabled:opacity-60"
        >
          {createPermission.isPending ? 'Submitting…' : 'Submit'}
        </button>
      </div>
    </form>
  );
}
