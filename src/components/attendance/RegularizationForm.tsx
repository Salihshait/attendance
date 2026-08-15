import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/auth/useAuth';
import { useCreateRegularization, useRegularizations } from '@/hooks/useRequestQueries';
import { useAttendanceDay } from '@/hooks/useAttendanceQueries';
import { formatClockTime, formatHoursMinutes } from '@/lib/dateFormat';
import { normalizedPunchMinutes, parseClockToMinutes } from '@/lib/attendanceCalc';
import { Field, inputClass } from './LeaveRequestForm';
import { ORG_ID } from '@/lib/orgContext';

const regularizationTypes = [
  { value: 'missed_punch', label: 'Missed In/Out Punch' },
  { value: 'incorrect_checkin', label: 'Incorrect Check-in' },
  { value: 'incorrect_checkout', label: 'Incorrect Check-out' },
  { value: 'work_from_home', label: 'Work From Home' },
  { value: 'present_correction', label: 'Present on that day' },
  { value: 'shift_correction', label: 'Shift Correction' },
];

const schema = z.object({
  attendanceDate: z.string().min(1, 'Required'),
  regularizationType: z.string().min(1, 'Required'),
  requestedCheckIn: z.string().optional(),
  requestedCheckOut: z.string().optional(),
  reason: z.string().min(3, 'Please enter a reason'),
});

type FormValues = z.infer<typeof schema>;

export function RegularizationForm({ defaultDate, onDone }: { defaultDate?: string; onDone: () => void }) {
  const { authSession } = useAuth();
  const createRegularization = useCreateRegularization();
  const { data: existingRegularizations } = useRegularizations(authSession?.employee.id);
  const [validationError, setValidationError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { attendanceDate: defaultDate } });

  const attendanceDate = watch('attendanceDate');
  const requestedCheckIn = watch('requestedCheckIn');
  const requestedCheckOut = watch('requestedCheckOut');

  const { data: original } = useAttendanceDay(authSession?.employee.id, attendanceDate);

  if (!authSession) return null;

  let requestedDurationLabel = '-';
  if (requestedCheckIn && requestedCheckOut) {
    const inMinutes = parseClockToMinutes(requestedCheckIn);
    const outMinutes = normalizedPunchMinutes(parseClockToMinutes(requestedCheckOut), inMinutes);
    requestedDurationLabel = formatHoursMinutes(outMinutes - inMinutes);
  }

  async function onSubmit(values: FormValues) {
    if (!authSession) return;
    setValidationError(null);
    const dt = values.attendanceDate;

    const hasActiveDuplicate = (existingRegularizations ?? []).some(
      (r) => r.attendanceDate === dt && (r.status === 'draft' || r.status === 'pending'),
    );
    if (hasActiveDuplicate) {
      setValidationError('You already have a pending regularization request for this date.');
      return;
    }

    await createRegularization.mutateAsync({
      organizationId: ORG_ID,
      employeeId: authSession.employee.id,
      attendanceDate: dt,
      regularizationType: values.regularizationType,
      requestedCheckIn: values.requestedCheckIn ? `${dt}T${values.requestedCheckIn}:00` : null,
      requestedCheckOut: values.requestedCheckOut ? `${dt}T${values.requestedCheckOut}:00` : null,
      reason: values.reason,
    });
    onDone();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 text-xs">
      <Field label="Date" error={errors.attendanceDate?.message}>
        <input type="date" {...register('attendanceDate')} className={inputClass} />
      </Field>

      <Field label="Attendance Type" error={errors.regularizationType?.message}>
        <select {...register('regularizationType')} className={inputClass}>
          <option value="">Select</option>
          {regularizationTypes.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </Field>

      {attendanceDate && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="mb-1 font-semibold text-slate-500">Original Attendance</p>
            {original ? (
              <>
                <p className="text-slate-600">
                  {formatClockTime(original.checkIn)} - {formatClockTime(original.checkOut)}
                </p>
                <p className="text-slate-500">Effective: {formatHoursMinutes(original.effectiveMinutes)}</p>
                <p className="text-slate-500 capitalize">Status: {original.dayStatus.replace('_', ' ')}</p>
              </>
            ) : (
              <p className="text-slate-400">No attendance record for this date.</p>
            )}
          </div>
          <div className="rounded border border-primary-200 bg-primary-50/40 px-3 py-2">
            <p className="mb-1 font-semibold text-primary-600">Requested Attendance</p>
            <p className="text-slate-600">
              {requestedCheckIn ? formatClockTime(`${attendanceDate}T${requestedCheckIn}:00`) : '-'} -{' '}
              {requestedCheckOut ? formatClockTime(`${attendanceDate}T${requestedCheckOut}:00`) : '-'}
            </p>
            <p className="text-slate-500">Effective: {requestedDurationLabel}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Requested Check-in (optional)">
          <input type="time" {...register('requestedCheckIn')} className={inputClass} />
        </Field>
        <Field label="Requested Check-out (optional)">
          <input type="time" {...register('requestedCheckOut')} className={inputClass} />
        </Field>
      </div>

      <Field label="Reason" error={errors.reason?.message}>
        <textarea {...register('reason')} rows={3} className={inputClass} />
      </Field>

      {validationError && (
        <p className="rounded bg-status-rejected/10 px-3 py-2 text-status-rejected">{validationError}</p>
      )}
      {createRegularization.isError && (
        <p className="rounded bg-status-rejected/10 px-3 py-2 text-status-rejected">
          {(createRegularization.error as Error).message}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onDone} className="rounded border border-slate-300 px-3.5 py-1.5 text-slate-600">
          Cancel
        </button>
        <button
          type="submit"
          disabled={createRegularization.isPending}
          className="rounded bg-primary-500 px-3.5 py-1.5 font-semibold text-white hover:bg-primary-600 disabled:opacity-60"
        >
          {createRegularization.isPending ? 'Submitting…' : 'Submit'}
        </button>
      </div>
    </form>
  );
}

export { regularizationTypes };
