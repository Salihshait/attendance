import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Paperclip } from 'lucide-react';
import { useAuth } from '@/auth/useAuth';
import { supabase } from '@/lib/supabase';
import { useCreateLeaveRequest, useLeaveBalances, useLeaveRequests, useLeaveTypes } from '@/hooks/useRequestQueries';
import { useHolidays } from '@/hooks/useAttendanceQueries';
import { validateLeaveRequest } from '@/lib/leaveValidation';
import { ORG_ID } from '@/lib/orgContext';
import { Field, inputClass } from '@/components/ui/FormField';

export { Field, inputClass };

// Matches the weekoff rule the seed generator uses (extract(dow ...) in (0, 6)).
const WEEKOFF_DAY_INDEXES = [0, 6];

const schema = z
  .object({
    leaveTypeId: z.string().min(1, 'Select a leave type'),
    fromDate: z.string().min(1, 'Required'),
    toDate: z.string().min(1, 'Required'),
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

export function LeaveRequestForm({ defaultDate, onDone }: { defaultDate?: string; onDone: () => void }) {
  const { authSession, isDemoMode } = useAuth();
  const orgId = authSession?.employee ? ORG_ID : undefined;
  const { data: leaveTypes } = useLeaveTypes(orgId);
  const { data: balances } = useLeaveBalances(authSession?.employee.id);
  const { data: existingRequests } = useLeaveRequests(authSession?.employee.id, authSession?.employee.displayName ?? '');
  const { data: holidays } = useHolidays(orgId);
  const createLeave = useCreateLeaveRequest();

  const [attachment, setAttachment] = useState<File | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { fromDate: defaultDate, toDate: defaultDate },
  });

  const leaveTypeId = watch('leaveTypeId');
  const fromDate = watch('fromDate');
  const toDate = watch('toDate');
  const days = countDays(fromDate, toDate);
  const balance = balances?.find((b) => b.leaveTypeId === leaveTypeId);

  if (!authSession) return null;

  async function onSubmit(values: FormValues) {
    if (!authSession) return;
    setValidationErrors([]);

    const holidayDates = new Set((holidays ?? []).map((h) => h.holidayDate));
    const { valid, errors: ruleErrors } = validateLeaveRequest({
      fromDate: values.fromDate,
      toDate: values.toDate,
      requestedDays: days,
      availableBalance: balance?.balance ?? 0,
      existingRequests: (existingRequests ?? []).map((r) => ({ fromDate: r.fromDate, toDate: r.toDate, status: r.status })),
      holidayDates,
      weekoffDayIndexes: WEEKOFF_DAY_INDEXES,
    });
    if (!valid) {
      setValidationErrors(ruleErrors);
      return;
    }

    let attachmentUrl: string | null = null;
    if (attachment && !isDemoMode) {
      setUploading(true);
      const path = `${authSession.employee.id}/leave-${Date.now()}-${attachment.name}`;
      const { error: uploadError } = await supabase.storage.from('employee-documents').upload(path, attachment);
      setUploading(false);
      if (uploadError) {
        setValidationErrors([`Attachment upload failed: ${uploadError.message}`]);
        return;
      }
      attachmentUrl = path;
    }

    await createLeave.mutateAsync({
      organizationId: ORG_ID,
      employeeId: authSession.employee.id,
      reportingManagerId: authSession.employee.reportingManagerId ?? null,
      leaveTypeId: values.leaveTypeId,
      fromDate: values.fromDate,
      toDate: values.toDate,
      durationDays: days,
      reason: values.reason,
      attachmentUrl,
    });
    onDone();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 text-xs">
      <Field label="Leave Type" error={errors.leaveTypeId?.message}>
        <select {...register('leaveTypeId')} className={inputClass}>
          <option value="">Select</option>
          {(leaveTypes ?? []).map((lt) => (
            <option key={lt.id} value={lt.id}>
              {lt.name}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="From Date" error={errors.fromDate?.message}>
          <input type="date" {...register('fromDate')} className={inputClass} />
        </Field>
        <Field label="To Date" error={errors.toDate?.message}>
          <input type="date" {...register('toDate')} className={inputClass} />
        </Field>
      </div>

      <div className="flex items-center justify-between rounded bg-slate-50 px-3 py-2 text-slate-600">
        <span>Requested Days: {days > 0 ? `${days} day${days > 1 ? 's' : ''}` : '-'}</span>
        {balance && (
          <span>
            Available: {balance.balance} &rarr; Remaining: {days > 0 ? (balance.balance - days).toFixed(2) : balance.balance}
          </span>
        )}
      </div>

      <Field label="Reason" error={errors.reason?.message}>
        <textarea {...register('reason')} rows={3} className={inputClass} />
      </Field>

      <Field label="Attachment (optional)">
        <label className="flex cursor-pointer items-center gap-2 rounded border border-dashed border-slate-300 px-3 py-2 text-slate-500 hover:border-primary-400">
          <Paperclip className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{attachment ? attachment.name : isDemoMode ? 'Upload disabled in demo mode' : 'Choose a file'}</span>
          <input
            type="file"
            className="hidden"
            disabled={isDemoMode}
            onChange={(e) => setAttachment(e.target.files?.[0] ?? null)}
          />
        </label>
      </Field>

      {validationErrors.length > 0 && (
        <ul className="list-disc space-y-1 rounded bg-status-rejected/10 px-3 py-2 pl-6 text-status-rejected">
          {validationErrors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      {createLeave.isError && (
        <p className="rounded bg-status-rejected/10 px-3 py-2 text-status-rejected">
          {(createLeave.error as Error).message}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onDone} className="rounded border border-slate-300 px-3.5 py-1.5 text-slate-600">
          Cancel
        </button>
        <button
          type="submit"
          disabled={createLeave.isPending || uploading}
          className="rounded bg-primary-500 px-3.5 py-1.5 font-semibold text-white hover:bg-primary-600 disabled:opacity-60"
        >
          {uploading ? 'Uploading…' : createLeave.isPending ? 'Submitting…' : 'Submit'}
        </button>
      </div>
    </form>
  );
}
