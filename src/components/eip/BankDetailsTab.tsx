import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Landmark, Pencil } from 'lucide-react';
import { useAuth } from '@/auth/useAuth';
import { useBankChangeRequests, useBankDetails, useCreateBankChangeRequest } from '@/hooks/useProfileQueries';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge, type StatusKind } from '@/components/ui/StatusBadge';
import { Field, inputClass } from '@/components/attendance/LeaveRequestForm';
import { InfoRow } from './InfoRow';

const schema = z.object({
  bankName: z.string().min(1, 'Required'),
  accountNumber: z.string().min(4, 'Enter a valid account number'),
  ifscCode: z.string().min(4, 'Enter a valid IFSC code'),
  branch: z.string().optional(),
  accountHolderName: z.string().min(1, 'Required'),
});
type FormValues = z.infer<typeof schema>;

export function BankDetailsTab() {
  const { authSession } = useAuth();
  const employeeId = authSession?.employee.id;
  const { data: bank, isLoading } = useBankDetails(employeeId);
  const { data: changeRequests } = useBankChangeRequests(employeeId);
  const createChangeRequest = useCreateBankChangeRequest();
  const [showForm, setShowForm] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const hasPendingRequest = (changeRequests ?? []).some((r) => r.status === 'pending');

  async function onSubmit(values: FormValues) {
    if (!employeeId) return;
    await createChangeRequest.mutateAsync({ employeeId, ...values });
    reset();
    setShowForm(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between border-b border-table-border bg-slate-50 px-3 py-2">
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <Landmark className="h-3.5 w-3.5 shrink-0" />
          Account number is masked. Changes require HR approval before they take effect.
        </div>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          disabled={hasPendingRequest}
          className="flex items-center gap-1.5 rounded bg-primary-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Pencil className="h-3.5 w-3.5" /> Request Change
        </button>
      </div>

      {isLoading && <p className="px-3 py-8 text-center text-xs text-slate-400">Loading…</p>}
      {!isLoading && (
        <div>
          <InfoRow label="Bank Name" value={bank?.bankName} />
          <InfoRow label="Account Number" value={bank?.accountNumber} />
          <InfoRow label="IFSC" value={bank?.ifscCode} />
          <InfoRow label="Branch" value={bank?.branch} />
          <InfoRow label="Account Holder" value={bank?.accountHolderName} />
        </div>
      )}

      {(changeRequests ?? []).length > 0 && (
        <div className="border-t border-table-border px-3 py-3">
          <p className="mb-2 text-xs font-semibold text-slate-600">Change Requests</p>
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr>
                {['Requested Bank', 'Account Number', 'IFSC', 'Requested On', 'Status', 'Remarks'].map((h) => (
                  <th key={h} className="border border-table-border bg-table-header px-2 py-1 text-left font-semibold text-slate-600">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(changeRequests ?? []).map((r) => (
                <tr key={r.id}>
                  <td className="border border-table-border px-2 py-1">{r.requestedBankName}</td>
                  <td className="border border-table-border px-2 py-1">{r.requestedAccountNumber}</td>
                  <td className="border border-table-border px-2 py-1">{r.requestedIfscCode}</td>
                  <td className="border border-table-border px-2 py-1">{new Date(r.createdAt).toLocaleString()}</td>
                  <td className="border border-table-border px-2 py-1">
                    <StatusBadge status={r.status as StatusKind} label={r.status.charAt(0).toUpperCase() + r.status.slice(1)} />
                  </td>
                  <td className="border border-table-border px-2 py-1">{r.approvalRemarks ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <Modal title="Request Bank Detail Change" onClose={() => setShowForm(false)}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 text-xs">
            <Field label="Bank Name" error={errors.bankName?.message}>
              <input {...register('bankName')} className={inputClass} />
            </Field>
            <Field label="Account Number" error={errors.accountNumber?.message}>
              <input {...register('accountNumber')} className={inputClass} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="IFSC" error={errors.ifscCode?.message}>
                <input {...register('ifscCode')} className={inputClass} />
              </Field>
              <Field label="Branch">
                <input {...register('branch')} className={inputClass} />
              </Field>
            </div>
            <Field label="Account Holder Name" error={errors.accountHolderName?.message}>
              <input {...register('accountHolderName')} className={inputClass} />
            </Field>

            {createChangeRequest.isError && (
              <p className="rounded bg-status-rejected/10 px-3 py-2 text-status-rejected">
                {(createChangeRequest.error as Error).message}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setShowForm(false)} className="rounded border border-slate-300 px-3.5 py-1.5 text-slate-600">
                Cancel
              </button>
              <button
                type="submit"
                disabled={createChangeRequest.isPending}
                className="rounded bg-primary-500 px-3.5 py-1.5 font-semibold text-white hover:bg-primary-600 disabled:opacity-60"
              >
                {createChangeRequest.isPending ? 'Submitting…' : 'Submit for Approval'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
