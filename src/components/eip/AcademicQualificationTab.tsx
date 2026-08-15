import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/auth/useAuth';
import { useCreateEducationRecord, useDeleteEducationRecord, useEducationRecords } from '@/hooks/useProfileQueries';
import { Modal } from '@/components/ui/Modal';
import { Field, inputClass } from '@/components/attendance/LeaveRequestForm';

const schema = z.object({
  qualification: z.string().min(1, 'Required'),
  specialization: z.string().optional(),
  institution: z.string().optional(),
  university: z.string().optional(),
  yearOfPassing: z.coerce.number().int().min(1950).max(new Date().getFullYear()).optional(),
  scoreType: z.enum(['percentage', 'cgpa']).optional(),
  score: z.coerce.number().min(0).optional(),
});
type FormValues = z.infer<typeof schema>;

export function AcademicQualificationTab() {
  const { authSession } = useAuth();
  const employeeId = authSession?.employee.id;
  const { data, isLoading } = useEducationRecords(employeeId);
  const createRecord = useCreateEducationRecord();
  const deleteRecord = useDeleteEducationRecord();
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
          <Plus className="h-3.5 w-3.5" /> Add Qualification
        </button>
      </div>

      {isLoading && <p className="px-3 py-8 text-center text-xs text-slate-400">Loading…</p>}
      {!isLoading && (data ?? []).length === 0 && <p className="px-3 py-8 text-center text-xs text-slate-400">No academic records added yet.</p>}

      {!isLoading && (data ?? []).length > 0 && (
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              {['Qualification', 'Specialization', 'Institution', 'University', 'Year', 'Score', ''].map((h) => (
                <th key={h} className="border border-table-border bg-table-header px-3 py-1.5 text-left font-semibold text-slate-600">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((r) => (
              <tr key={r.id}>
                <td className="border border-table-border px-3 py-1.5">{r.qualification}</td>
                <td className="border border-table-border px-3 py-1.5">{r.specialization ?? '-'}</td>
                <td className="border border-table-border px-3 py-1.5">{r.institution ?? '-'}</td>
                <td className="border border-table-border px-3 py-1.5">{r.university ?? '-'}</td>
                <td className="border border-table-border px-3 py-1.5">{r.yearOfPassing ?? '-'}</td>
                <td className="border border-table-border px-3 py-1.5">
                  {r.score ? `${r.score}${r.scoreType === 'percentage' ? '%' : ' CGPA'}` : '-'}
                </td>
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
        <Modal title="Add Academic Qualification" onClose={() => setShowForm(false)}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 text-xs">
            <Field label="Qualification" error={errors.qualification?.message}>
              <input {...register('qualification')} className={inputClass} placeholder="e.g. B.Tech" />
            </Field>
            <Field label="Specialization">
              <input {...register('specialization')} className={inputClass} />
            </Field>
            <Field label="Institution">
              <input {...register('institution')} className={inputClass} />
            </Field>
            <Field label="University">
              <input {...register('university')} className={inputClass} />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Year" error={errors.yearOfPassing?.message}>
                <input type="number" {...register('yearOfPassing')} className={inputClass} />
              </Field>
              <Field label="Score Type">
                <select {...register('scoreType')} className={inputClass}>
                  <option value="">Select</option>
                  <option value="percentage">Percentage</option>
                  <option value="cgpa">CGPA</option>
                </select>
              </Field>
              <Field label="Score" error={errors.score?.message}>
                <input type="number" step="0.01" {...register('score')} className={inputClass} />
              </Field>
            </div>

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
