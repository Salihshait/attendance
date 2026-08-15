import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/auth/useAuth';
import { useCreatePreviousEmployment, useDeletePreviousEmployment, usePreviousEmploymentRecords } from '@/hooks/useProfileQueries';
import { Modal } from '@/components/ui/Modal';
import { Field, inputClass } from '@/components/attendance/LeaveRequestForm';
import { formatDDMMYYYY } from '@/lib/dateFormat';

const schema = z.object({
  companyName: z.string().min(1, 'Required'),
  designation: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  totalExperienceYears: z.coerce.number().min(0).max(60).optional(),
  reasonForLeaving: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export function PreviousEmploymentTab() {
  const { authSession } = useAuth();
  const employeeId = authSession?.employee.id;
  const { data, isLoading } = usePreviousEmploymentRecords(employeeId);
  const createRecord = useCreatePreviousEmployment();
  const deleteRecord = useDeletePreviousEmployment();
  const [showForm, setShowForm] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    if (!employeeId) return;
    await createRecord.mutateAsync({ employeeId, ...values });
    reset();
    setShowForm(false);
  }

  return (
    <div>
      <div className="flex items-center justify-end border-b border-table-border bg-slate-50 px-3 py-2">
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 rounded bg-primary-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-600"
        >
          <Plus className="h-3.5 w-3.5" /> Add Employment
        </button>
      </div>

      {isLoading && <p className="px-3 py-8 text-center text-xs text-slate-400">Loading…</p>}
      {!isLoading && (data ?? []).length === 0 && <p className="px-3 py-8 text-center text-xs text-slate-400">No previous employment records added yet.</p>}

      {!isLoading && (data ?? []).length > 0 && (
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              {['Company', 'Designation', 'Joining Date', 'Leaving Date', 'Experience', 'Reason for Leaving', ''].map((h) => (
                <th key={h} className="border border-table-border bg-table-header px-3 py-1.5 text-left font-semibold text-slate-600">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((r) => (
              <tr key={r.id}>
                <td className="border border-table-border px-3 py-1.5">{r.companyName}</td>
                <td className="border border-table-border px-3 py-1.5">{r.designation ?? '-'}</td>
                <td className="border border-table-border px-3 py-1.5">{r.startDate ? formatDDMMYYYY(r.startDate) : '-'}</td>
                <td className="border border-table-border px-3 py-1.5">{r.endDate ? formatDDMMYYYY(r.endDate) : '-'}</td>
                <td className="border border-table-border px-3 py-1.5">{r.totalExperienceYears ? `${r.totalExperienceYears} yrs` : '-'}</td>
                <td className="border border-table-border px-3 py-1.5">{r.reasonForLeaving ?? '-'}</td>
                <td className="border border-table-border px-3 py-1.5 text-center">
                  <button
                    type="button"
                    aria-label="Delete"
                    onClick={() => employeeId && deleteRecord.mutate({ id: r.id, employeeId })}
                    className="rounded bg-status-rejected p-1 text-white hover:opacity-90"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showForm && (
        <Modal title="Add Previous Employment" onClose={() => setShowForm(false)}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 text-xs">
            <Field label="Company" error={errors.companyName?.message}>
              <input {...register('companyName')} className={inputClass} />
            </Field>
            <Field label="Designation">
              <input {...register('designation')} className={inputClass} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Joining Date">
                <input type="date" {...register('startDate')} className={inputClass} />
              </Field>
              <Field label="Leaving Date">
                <input type="date" {...register('endDate')} className={inputClass} />
              </Field>
            </div>
            <Field label="Experience (years)" error={errors.totalExperienceYears?.message}>
              <input type="number" step="0.1" {...register('totalExperienceYears')} className={inputClass} />
            </Field>
            <Field label="Reason for Leaving">
              <textarea {...register('reasonForLeaving')} rows={2} className={inputClass} />
            </Field>

            {createRecord.isError && (
              <p className="rounded bg-status-rejected/10 px-3 py-2 text-status-rejected">{(createRecord.error as Error).message}</p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setShowForm(false)} className="rounded border border-slate-300 px-3.5 py-1.5 text-slate-600">
                Cancel
              </button>
              <button
                type="submit"
                disabled={createRecord.isPending}
                className="rounded bg-primary-500 px-3.5 py-1.5 font-semibold text-white hover:bg-primary-600 disabled:opacity-60"
              >
                {createRecord.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
