import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus } from 'lucide-react';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { PageHeader } from '@/components/layout/PageHeader';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge, type StatusKind } from '@/components/ui/StatusBadge';
import { Field, inputClass } from '@/components/attendance/LeaveRequestForm';
import { useAuth } from '@/auth/useAuth';
import { useCreatePreviousEmployerDeclaration, usePreviousEmployerDeclarations } from '@/hooks/useEipQueries';
import { formatCurrency } from '@/lib/utils';

const schema = z.object({
  financialYear: z.string().regex(/^\d{4}-\d{2}$/, 'Format: 2025-26'),
  employerName: z.string().min(1, 'Required'),
  incomeEarned: z.coerce.number().min(0),
  tdsDeducted: z.coerce.number().min(0),
  pfContribution: z.coerce.number().min(0),
});
type FormValues = z.infer<typeof schema>;

const statusTone: Record<string, StatusKind> = { draft: 'draft', submitted: 'pending', verified: 'approved' };

export default function PreviousEmployerDeclarationPage() {
  const { authSession } = useAuth();
  const employeeId = authSession?.employee.id;
  const { data, isLoading } = usePreviousEmployerDeclarations(employeeId);
  const createDeclaration = useCreatePreviousEmployerDeclaration();
  const [showForm, setShowForm] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    if (!employeeId) return;
    await createDeclaration.mutateAsync({ employeeId, ...values });
    reset();
    setShowForm(false);
  }

  return (
    <div>
      <Breadcrumb items={[{ label: 'EIP' }, { label: 'TDS' }, { label: 'Previous Employer Declaration' }]} />

      <div className="overflow-hidden rounded border border-slate-200 bg-white">
        <PageHeader
          title="Previous Employer Declaration"
          actions={
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 rounded bg-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/25"
            >
              <Plus className="h-3.5 w-3.5" /> Add Declaration
            </button>
          }
        />

        {isLoading && <p className="px-3 py-8 text-center text-xs text-slate-400">Loading…</p>}
        {!isLoading && (data ?? []).length === 0 && (
          <p className="px-3 py-8 text-center text-xs text-slate-400">No previous employer declarations submitted yet.</p>
        )}
        {!isLoading && (data ?? []).length > 0 && (
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                {['Financial Year', 'Employer', 'Income Earned', 'TDS Deducted', 'PF Contribution', 'Status'].map((h) => (
                  <th key={h} className="border border-table-border bg-table-header px-3 py-1.5 text-left font-semibold text-slate-600">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((r) => (
                <tr key={r.id}>
                  <td className="border border-table-border px-3 py-1.5">{r.financialYear}</td>
                  <td className="border border-table-border px-3 py-1.5">{r.employerName}</td>
                  <td className="border border-table-border px-3 py-1.5">{formatCurrency(r.incomeEarned)}</td>
                  <td className="border border-table-border px-3 py-1.5">{formatCurrency(r.tdsDeducted)}</td>
                  <td className="border border-table-border px-3 py-1.5">{formatCurrency(r.pfContribution)}</td>
                  <td className="border border-table-border px-3 py-1.5">
                    <StatusBadge status={statusTone[r.status]} label={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <Modal title="Add Previous Employer Declaration" onClose={() => setShowForm(false)}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 text-xs">
            <Field label="Financial Year" error={errors.financialYear?.message}>
              <input {...register('financialYear')} placeholder="2025-26" className={inputClass} />
            </Field>
            <Field label="Employer Name" error={errors.employerName?.message}>
              <input {...register('employerName')} className={inputClass} />
            </Field>
            <Field label="Income Earned" error={errors.incomeEarned?.message}>
              <input type="number" {...register('incomeEarned')} className={inputClass} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="TDS Deducted" error={errors.tdsDeducted?.message}>
                <input type="number" {...register('tdsDeducted')} className={inputClass} />
              </Field>
              <Field label="PF Contribution" error={errors.pfContribution?.message}>
                <input type="number" {...register('pfContribution')} className={inputClass} />
              </Field>
            </div>

            {createDeclaration.isError && (
              <p className="rounded bg-status-rejected/10 px-3 py-2 text-status-rejected">{(createDeclaration.error as Error).message}</p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setShowForm(false)} className="rounded border border-slate-300 px-3.5 py-1.5 text-slate-600">
                Cancel
              </button>
              <button
                type="submit"
                disabled={createDeclaration.isPending}
                className="rounded bg-primary-500 px-3.5 py-1.5 font-semibold text-white hover:bg-primary-600 disabled:opacity-60"
              >
                {createDeclaration.isPending ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
