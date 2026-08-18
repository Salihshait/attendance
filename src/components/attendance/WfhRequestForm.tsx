import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/auth/useAuth';
import { useCreateOndutyRequest, useOndutyRequests } from '@/hooks/useRequestQueries';
import { validateOndutyRequest } from '@/lib/ondutyValidation';
import { Field, inputClass } from './LeaveRequestForm';
import { ORG_ID } from '@/lib/orgContext';

const schema = z
  .object({
    fromDate: z.string().min(1, 'Required'),
    toDate: z.string().min(1, 'Required'),
    location: z.string().optional(),
    reason: z.string().min(3, 'Please enter a reason'),
  })
  .refine((v) => v.toDate >= v.fromDate, { message: 'To Date must be on or after From Date', path: ['toDate'] });

type FormValues = z.infer<typeof schema>;

function countDays(from: string, to: string): number {
  if (!from || !to || to < from) return 0;
  const a = new Date(from);
  const b = new Date(to);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1;
}

// Full-day date-range only — onduty_requests has no is_half_day column
// (unlike leave_requests), so a half-day WFH request isn't representable
// without a schema change. Flagged rather than silently guessed at.
export function WfhRequestForm({ defaultDate, onDone }: { defaultDate?: string; onDone: () => void }) {
  const { authSession } = useAuth();
  const createOnduty = useCreateOndutyRequest();
  const { data: existingRequests } = useOndutyRequests(authSession?.employee.id);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { fromDate: defaultDate, toDate: defaultDate } });

  const fromDate = watch('fromDate');
  const toDate = watch('toDate');
  const days = countDays(fromDate, toDate);

  if (!authSession) return null;

  async function onSubmit(values: FormValues) {
    if (!authSession) return;
    setValidationErrors([]);

    const { valid, errors: ruleErrors } = validateOndutyRequest({
      fromDate: values.fromDate,
      toDate: values.toDate,
      existingRequests: (existingRequests ?? []).map((r) => ({ fromDate: r.fromDate, toDate: r.toDate, status: r.status })),
    });
    if (!valid) {
      setValidationErrors(ruleErrors);
      return;
    }

    await createOnduty.mutateAsync({
      organizationId: ORG_ID,
      employeeId: authSession.employee.id,
      reportingManagerId: authSession.employee.reportingManagerId ?? null,
      ondutyType: 'work_from_home',
      fromDate: values.fromDate,
      toDate: values.toDate,
      reason: values.reason,
      location: values.location || null,
    });
    onDone();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 text-xs">
      <div className="grid grid-cols-2 gap-3">
        <Field label="From Date" error={errors.fromDate?.message}>
          <input type="date" {...register('fromDate')} className={inputClass} />
        </Field>
        <Field label="To Date" error={errors.toDate?.message}>
          <input type="date" {...register('toDate')} className={inputClass} />
        </Field>
      </div>

      <div className="rounded bg-slate-50 px-3 py-2 text-slate-600">
        Requested Days: {days > 0 ? `${days} day${days > 1 ? 's' : ''}` : '-'}
      </div>

      <Field label="Location (optional)">
        <input {...register('location')} placeholder="e.g. Home" className={inputClass} />
      </Field>

      <Field label="Reason" error={errors.reason?.message}>
        <textarea {...register('reason')} rows={3} className={inputClass} />
      </Field>

      {validationErrors.length > 0 && (
        <ul className="list-disc space-y-1 rounded bg-status-rejected/10 px-3 py-2 pl-6 text-status-rejected">
          {validationErrors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      {createOnduty.isError && (
        <p className="rounded bg-status-rejected/10 px-3 py-2 text-status-rejected">
          {(createOnduty.error as Error).message}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onDone} className="rounded border border-slate-300 px-3.5 py-1.5 text-slate-600">
          Cancel
        </button>
        <button
          type="submit"
          disabled={createOnduty.isPending}
          className="rounded bg-primary-500 px-3.5 py-1.5 font-semibold text-white hover:bg-primary-600 disabled:opacity-60"
        >
          {createOnduty.isPending ? 'Submitting…' : 'Submit'}
        </button>
      </div>
    </form>
  );
}
