import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { ColumnDef } from '@tanstack/react-table';
import { Info, Paperclip, X } from 'lucide-react';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge, type StatusKind } from '@/components/ui/StatusBadge';
import { Field, inputClass } from '@/components/attendance/LeaveRequestForm';
import { useAuth } from '@/auth/useAuth';
import { supabase } from '@/lib/supabase';
import { useActOnExitRequest, useCreateExitRequest, useMyExitRequests } from '@/hooks/useExitQueries';
import { calculateExpectedLastWorkingDate } from '@/lib/exitCalc';
import { formatDDMMYYYY } from '@/lib/dateFormat';
import type { ExitRequestRow, ExitRequestStatus } from '@/types/exit';
import { ORG_ID } from '@/lib/orgContext';

const ACTIVE_STATUSES: ExitRequestStatus[] = ['submitted', 'manager_approved', 'hr_approved'];

const statusLabels: Record<ExitRequestStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  manager_approved: 'Manager Approved',
  hr_approved: 'HR Approved',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
  completed: 'Completed',
};
const statusTone: Record<ExitRequestStatus, StatusKind> = {
  draft: 'draft',
  submitted: 'pending',
  manager_approved: 'pending',
  hr_approved: 'approved',
  rejected: 'rejected',
  withdrawn: 'cancelled',
  completed: 'approved',
};

const schema = z
  .object({
    resignationDate: z.string().min(1, 'Required'),
    noticePeriodDays: z.coerce.number().int().min(0, 'Must be 0 or more'),
    proposedLastWorkingDate: z.string().min(1, 'Required'),
    reason: z.string().min(3, 'Please enter a reason'),
    detailedComments: z.string().optional(),
  })
  .refine((v) => v.proposedLastWorkingDate >= v.resignationDate, {
    message: 'Proposed last working date must be on or after the resignation date',
    path: ['proposedLastWorkingDate'],
  });
type FormValues = z.infer<typeof schema>;

export default function ResignationEntryPage() {
  const { authSession, isDemoMode } = useAuth();
  const employeeId = authSession?.employee.id;
  const { data, isLoading } = useMyExitRequests(employeeId);
  const createRequest = useCreateExitRequest();
  const actOnRequest = useActOnExitRequest();

  const [attachment, setAttachment] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [detail, setDetail] = useState<ExitRequestRow | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const resignationDate = watch('resignationDate');
  const noticePeriodDays = watch('noticePeriodDays');
  const expectedLastWorkingDate =
    resignationDate && noticePeriodDays !== undefined && noticePeriodDays !== null
      ? calculateExpectedLastWorkingDate(resignationDate, Number(noticePeriodDays))
      : null;

  const activeRequest = useMemo(() => (data ?? []).find((r) => ACTIVE_STATUSES.includes(r.status)), [data]);

  async function onSubmit(values: FormValues) {
    if (!authSession) return;

    let attachmentUrl: string | null = null;
    if (attachment && !isDemoMode) {
      setUploading(true);
      const path = `${authSession.employee.id}/resignation-${Date.now()}-${attachment.name}`;
      const { error: uploadError } = await supabase.storage.from('employee-documents').upload(path, attachment);
      setUploading(false);
      if (uploadError) return;
      attachmentUrl = path;
    }

    await createRequest.mutateAsync({
      organizationId: ORG_ID,
      employeeId: authSession.employee.id,
      managerId: authSession.employee.reportingManagerId ?? null,
      resignationDate: values.resignationDate,
      noticePeriodDays: values.noticePeriodDays,
      proposedLastWorkingDate: values.proposedLastWorkingDate,
      reason: values.reason,
      detailedComments: values.detailedComments,
      attachmentUrl,
    });
    reset();
    setAttachment(null);
  }

  const columns: ColumnDef<ExitRequestRow>[] = [
    { header: 'Request Date', accessorFn: (r) => new Date(r.createdAt).toLocaleDateString(), id: 'requestDate' },
    { header: 'Resignation Date', accessorFn: (r) => formatDDMMYYYY(r.resignationDate), id: 'resignationDate' },
    { header: 'Last Working Date', accessorFn: (r) => formatDDMMYYYY(r.expectedLastWorkingDate), id: 'lwd' },
    { header: 'Reason', accessorKey: 'reason' },
    { header: 'Manager', accessorFn: (r) => r.managerName ?? '-', id: 'manager' },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ getValue }) => {
        const status = getValue<ExitRequestStatus>();
        return <StatusBadge status={statusTone[status]} label={statusLabels[status]} />;
      },
    },
    {
      header: 'Approval Remarks',
      accessorFn: (r) => r.hrRemarks ?? r.managerRemarks ?? '-',
      id: 'remarks',
    },
    {
      header: 'Action',
      id: 'action',
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label="View"
            onClick={() => setDetail(row.original)}
            className="rounded bg-slate-400 p-1 text-white hover:bg-slate-500"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
          {ACTIVE_STATUSES.includes(row.original.status) && row.original.status !== 'hr_approved' && (
            <button
              type="button"
              aria-label="Withdraw"
              onClick={() => actOnRequest.mutate({ exitRequestId: row.original.id, action: 'withdraw' })}
              className="rounded bg-status-pending p-1 text-white hover:opacity-90"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <Breadcrumb items={[{ label: 'Exit' }, { label: 'Transaction' }, { label: 'Resignation Entry' }]} />

      <div className="mb-4 overflow-hidden rounded border border-slate-200 bg-white">
        <PageHeader title="Resignation Entry" />

        {activeRequest ? (
          <div className="p-4 text-xs text-slate-600">
            You already have an active resignation (
            <StatusBadge status={statusTone[activeRequest.status]} label={statusLabels[activeRequest.status]} />
            ) submitted on {new Date(activeRequest.createdAt).toLocaleDateString()}. Withdraw it from the table below before submitting a new one.
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 p-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Resignation Date" error={errors.resignationDate?.message}>
                <input type="date" {...register('resignationDate')} className={inputClass} />
              </Field>
              <Field label="Notice Period (days)" error={errors.noticePeriodDays?.message}>
                <input type="number" {...register('noticePeriodDays')} className={inputClass} />
              </Field>
            </div>

            <Field label="Proposed Last Working Date" error={errors.proposedLastWorkingDate?.message}>
              <input type="date" {...register('proposedLastWorkingDate')} className={inputClass} />
            </Field>

            <div className="rounded bg-slate-50 px-3 py-2 text-slate-600">
              Expected Last Working Date: <span className="font-semibold">{expectedLastWorkingDate ? formatDDMMYYYY(expectedLastWorkingDate) : '-'}</span>
              <span className="ml-1 text-slate-400">(Resignation Date + Notice Period)</span>
            </div>

            <Field label="Reason" error={errors.reason?.message}>
              <input {...register('reason')} className={inputClass} placeholder="e.g. Better career opportunity" />
            </Field>

            <Field label="Detailed Comments">
              <textarea {...register('detailedComments')} rows={3} className={inputClass} />
            </Field>

            <Field label="Attachment (optional)">
              <label className="flex cursor-pointer items-center gap-2 rounded border border-dashed border-slate-300 px-3 py-2 text-slate-500 hover:border-primary-400">
                <Paperclip className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{attachment ? attachment.name : isDemoMode ? 'Upload disabled in demo mode' : 'Choose a file'}</span>
                <input type="file" className="hidden" disabled={isDemoMode} onChange={(e) => setAttachment(e.target.files?.[0] ?? null)} />
              </label>
            </Field>

            {createRequest.isError && (
              <p className="rounded bg-status-rejected/10 px-3 py-2 text-status-rejected">{(createRequest.error as Error).message}</p>
            )}

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={createRequest.isPending || uploading}
                className="rounded bg-primary-500 px-3.5 py-1.5 font-semibold text-white hover:bg-primary-600 disabled:opacity-60"
              >
                {uploading ? 'Uploading…' : createRequest.isPending ? 'Submitting…' : 'Submit Resignation'}
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="overflow-hidden rounded border border-slate-200 bg-white">
        <PageHeader title="Resignation History" />
        <DataTable columns={columns} data={data ?? []} searchPlaceholder="Search by reason" emptyMessage={isLoading ? 'Loading…' : 'No resignation requests yet.'} />
      </div>

      {detail && (
        <Modal title="Resignation Details" onClose={() => setDetail(null)}>
          <dl className="space-y-2 text-xs">
            {[
              ['Resignation Date', formatDDMMYYYY(detail.resignationDate)],
              ['Proposed Last Working Date', formatDDMMYYYY(detail.proposedLastWorkingDate)],
              ['Expected Last Working Date', formatDDMMYYYY(detail.expectedLastWorkingDate)],
              ['Notice Period', `${detail.noticePeriodDays} days`],
              ['Reason', detail.reason],
              ['Detailed Comments', detail.detailedComments ?? '-'],
              ['Manager', detail.managerName ?? '-'],
              ['Manager Remarks', detail.managerRemarks ?? '-'],
              ['HR Remarks', detail.hrRemarks ?? '-'],
              ['Status', statusLabels[detail.status]],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-slate-100 pb-1.5">
                <dt className="font-medium text-slate-500">{k}</dt>
                <dd className="text-right text-slate-700">{v}</dd>
              </div>
            ))}
          </dl>
        </Modal>
      )}
    </div>
  );
}
