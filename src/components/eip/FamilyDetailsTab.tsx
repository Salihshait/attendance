import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/auth/useAuth';
import { useCreateFamilyMember, useDeleteFamilyMember, useFamilyMembers } from '@/hooks/useProfileQueries';
import { Modal } from '@/components/ui/Modal';
import { Field, inputClass } from '@/components/attendance/LeaveRequestForm';
import { formatDDMMYYYY } from '@/lib/dateFormat';

const schema = z.object({
  name: z.string().min(1, 'Required'),
  relationship: z.string().min(1, 'Required'),
  dateOfBirth: z.string().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  occupation: z.string().optional(),
  isDependent: z.boolean(),
  contactNumber: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export function FamilyDetailsTab() {
  const { authSession } = useAuth();
  const employeeId = authSession?.employee.id;
  const { data, isLoading } = useFamilyMembers(employeeId);
  const createMember = useCreateFamilyMember();
  const deleteMember = useDeleteFamilyMember();
  const [showForm, setShowForm] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { isDependent: false } });

  async function onSubmit(values: FormValues) {
    if (!employeeId) return;
    await createMember.mutateAsync({ employeeId, ...values });
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
          <Plus className="h-3.5 w-3.5" /> Add Family Member
        </button>
      </div>

      {isLoading && <p className="px-3 py-8 text-center text-xs text-slate-400">Loading…</p>}
      {!isLoading && (data ?? []).length === 0 && <p className="px-3 py-8 text-center text-xs text-slate-400">No family members added yet.</p>}

      {!isLoading && (data ?? []).length > 0 && (
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              {['Name', 'Relationship', 'DOB', 'Gender', 'Occupation', 'Dependent', 'Contact', ''].map((h) => (
                <th key={h} className="border border-table-border bg-table-header px-3 py-1.5 text-left font-semibold text-slate-600">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((r) => (
              <tr key={r.id}>
                <td className="border border-table-border px-3 py-1.5">{r.name}</td>
                <td className="border border-table-border px-3 py-1.5">{r.relationship}</td>
                <td className="border border-table-border px-3 py-1.5">{r.dateOfBirth ? formatDDMMYYYY(r.dateOfBirth) : '-'}</td>
                <td className="border border-table-border px-3 py-1.5 capitalize">{r.gender ?? '-'}</td>
                <td className="border border-table-border px-3 py-1.5">{r.occupation ?? '-'}</td>
                <td className="border border-table-border px-3 py-1.5">{r.isDependent ? 'Yes' : 'No'}</td>
                <td className="border border-table-border px-3 py-1.5">{r.contactNumber ?? '-'}</td>
                <td className="border border-table-border px-3 py-1.5 text-center">
                  <button
                    type="button"
                    aria-label="Delete"
                    onClick={() => employeeId && deleteMember.mutate({ id: r.id, employeeId })}
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
        <Modal title="Add Family Member" onClose={() => setShowForm(false)}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 text-xs">
            <Field label="Name" error={errors.name?.message}>
              <input {...register('name')} className={inputClass} />
            </Field>
            <Field label="Relationship" error={errors.relationship?.message}>
              <input {...register('relationship')} className={inputClass} placeholder="e.g. Spouse, Child, Parent" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date of Birth">
                <input type="date" {...register('dateOfBirth')} className={inputClass} />
              </Field>
              <Field label="Gender">
                <select {...register('gender')} className={inputClass}>
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </Field>
            </div>
            <Field label="Occupation">
              <input {...register('occupation')} className={inputClass} />
            </Field>
            <Field label="Contact Number">
              <input {...register('contactNumber')} className={inputClass} />
            </Field>
            <label className="flex items-center gap-2 text-[11px] text-slate-600">
              <input type="checkbox" {...register('isDependent')} className="h-3.5 w-3.5" />
              Dependent
            </label>

            {createMember.isError && (
              <p className="rounded bg-status-rejected/10 px-3 py-2 text-status-rejected">{(createMember.error as Error).message}</p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setShowForm(false)} className="rounded border border-slate-300 px-3.5 py-1.5 text-slate-600">
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMember.isPending}
                className="rounded bg-primary-500 px-3.5 py-1.5 font-semibold text-white hover:bg-primary-600 disabled:opacity-60"
              >
                {createMember.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
