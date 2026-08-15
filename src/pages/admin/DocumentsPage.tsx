import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Check, Pencil, X } from 'lucide-react';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { FilterBar, FilterField, FilterSelect } from '@/components/ui/FilterBar';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge, type StatusKind } from '@/components/ui/StatusBadge';
import { Field, FormActions, inputClass } from '@/components/admin/FormField';
import { useAuth } from '@/auth/useAuth';
import {
  useDocumentTypes,
  useCreateDocumentType,
  useUpdateDocumentType,
  useToggleDocumentTypeActive,
  useEmployeeDocumentsQueue,
  useVerifyEmployeeDocument,
} from '@/hooks/useAdminDocuments';
import type { AdminDocumentTypeRow, AdminEmployeeDocumentRow } from '@/types/admin';

const schema = z.object({ code: z.string().min(1, 'Required'), name: z.string().min(1, 'Required'), isRequired: z.boolean() });
type FormValues = z.infer<typeof schema>;

const verificationLabels: Record<AdminEmployeeDocumentRow['verificationStatus'], string> = { pending: 'Pending', verified: 'Verified', rejected: 'Rejected' };
const verificationTone: Record<AdminEmployeeDocumentRow['verificationStatus'], StatusKind> = { pending: 'pending', verified: 'approved', rejected: 'rejected' };
const queueStatusOptions = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'verified', label: 'Verified' },
  { value: 'rejected', label: 'Rejected' },
];

export default function DocumentsPage() {
  return (
    <div className="space-y-4">
      <Breadcrumb items={[{ label: 'Administration' }, { label: 'Documents' }]} />
      <DocumentTypeCatalog />
      <VerificationQueue />
    </div>
  );
}

function DocumentTypeCatalog() {
  const { data, isLoading } = useDocumentTypes();
  const createType = useCreateDocumentType();
  const updateType = useUpdateDocumentType();
  const toggleActive = useToggleDocumentTypeActive();
  const [editing, setEditing] = useState<{ mode: 'create' | 'edit'; row: AdminDocumentTypeRow | null } | null>(null);

  const columns: ColumnDef<AdminDocumentTypeRow, any>[] = [
    { header: 'Code', accessorKey: 'code' },
    { header: 'Name', accessorKey: 'name' },
    { header: 'Required', accessorFn: (r) => (r.isRequired ? 'Yes' : 'No'), id: 'required' },
    {
      header: 'Status',
      id: 'status',
      cell: ({ row }) => (
        <button type="button" onClick={() => toggleActive.mutate({ id: row.original.id, isActive: !row.original.isActive })}>
          <StatusBadge status={row.original.isActive ? 'active' : 'inactive'} label={row.original.isActive ? 'Active' : 'Inactive'} />
        </button>
      ),
    },
    {
      header: 'Actions',
      id: 'actions',
      cell: ({ row }) => (
        <button
          type="button"
          onClick={() => setEditing({ mode: 'edit', row: row.original })}
          className="rounded bg-primary-500 p-1 text-white hover:bg-primary-600"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      ),
    },
  ];

  return (
    <div className="overflow-hidden rounded border border-slate-200 bg-white">
      <PageHeader
        title="Document Types"
        actions={
          <button
            type="button"
            onClick={() => setEditing({ mode: 'create', row: null })}
            className="rounded bg-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/25"
          >
            + Add New
          </button>
        }
      />
      <DataTable columns={columns} data={data ?? []} searchPlaceholder="Search document types" emptyMessage={isLoading ? 'Loading…' : 'No document types found.'} />

      {editing && (
        <Modal title={editing.mode === 'create' ? 'Add Document Type' : 'Edit Document Type'} onClose={() => setEditing(null)}>
          <DocumentTypeForm
            initial={editing.row}
            onDone={() => setEditing(null)}
            onSubmit={async (values) => {
              if (editing.mode === 'create') await createType.mutateAsync(values);
              else await updateType.mutateAsync({ id: editing.row!.id, input: values });
            }}
            isPending={createType.isPending || updateType.isPending}
            submitError={(createType.error as Error)?.message ?? (updateType.error as Error)?.message}
          />
        </Modal>
      )}
    </div>
  );
}

function DocumentTypeForm({
  initial,
  onDone,
  onSubmit,
  isPending,
  submitError,
}: {
  initial: AdminDocumentTypeRow | null;
  onDone: () => void;
  onSubmit: (values: FormValues) => Promise<void>;
  isPending: boolean;
  submitError?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { code: initial?.code ?? '', name: initial?.name ?? '', isRequired: initial?.isRequired ?? false },
  });

  async function submit(values: FormValues) {
    setError(null);
    try {
      await onSubmit(values);
      onDone();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-3 text-xs">
      <Field label="Code" error={errors.code?.message}>
        <input {...register('code')} className={inputClass} />
      </Field>
      <Field label="Name" error={errors.name?.message}>
        <input {...register('name')} className={inputClass} />
      </Field>
      <label className="flex items-center gap-1.5 text-slate-600">
        <input type="checkbox" {...register('isRequired')} /> Required
      </label>
      <FormActions onCancel={onDone} isSubmitting={isPending} error={error ?? submitError} />
    </form>
  );
}

function VerificationQueue() {
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'verified' | 'rejected'>('pending');
  const { data, isLoading } = useEmployeeDocumentsQueue(statusFilter);
  const { authSession } = useAuth();
  const verifyDocument = useVerifyEmployeeDocument();
  const [acting, setActing] = useState<{ row: AdminEmployeeDocumentRow; status: 'verified' | 'rejected' } | null>(null);
  const [remarks, setRemarks] = useState('');

  const columns: ColumnDef<AdminEmployeeDocumentRow, any>[] = [
    { header: 'Employee', accessorKey: 'employeeName' },
    { header: 'Employee Code', accessorKey: 'employeeCode' },
    { header: 'Document Type', accessorKey: 'documentTypeName' },
    { header: 'File Name', accessorKey: 'fileName' },
    { header: 'Uploaded At', accessorFn: (r) => new Date(r.uploadedAt).toLocaleString(), id: 'uploadedAt' },
    {
      header: 'Status',
      id: 'status',
      cell: ({ row }) => <StatusBadge status={verificationTone[row.original.verificationStatus]} label={verificationLabels[row.original.verificationStatus]} />,
    },
    {
      header: 'Actions',
      id: 'actions',
      cell: ({ row }) =>
        row.original.verificationStatus === 'pending' ? (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setRemarks('');
                setActing({ row: row.original, status: 'verified' });
              }}
              className="rounded bg-status-approved p-1 text-white hover:opacity-90"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setRemarks('');
                setActing({ row: row.original, status: 'rejected' });
              }}
              className="rounded bg-status-rejected p-1 text-white hover:opacity-90"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <span className="text-slate-400">-</span>
        ),
    },
  ];

  return (
    <div className="overflow-hidden rounded border border-slate-200 bg-white">
      <PageHeader title="Document Verification Queue" />
      <FilterBar>
        <FilterField label="Status">
          <FilterSelect value={statusFilter} onChange={(v) => setStatusFilter(v as typeof statusFilter)} options={queueStatusOptions} />
        </FilterField>
      </FilterBar>
      <DataTable columns={columns} data={data ?? []} searchPlaceholder="Search by employee" emptyMessage={isLoading ? 'Loading…' : 'No documents found.'} />

      {acting && (
        <Modal title={acting.status === 'verified' ? 'Verify Document' : 'Reject Document'} onClose={() => setActing(null)}>
          <div className="space-y-3 text-xs">
            <p className="text-slate-600">
              {acting.status === 'verified' ? 'Verify' : 'Reject'} <span className="font-semibold">{acting.row.fileName}</span> uploaded by{' '}
              {acting.row.employeeName}?
            </p>
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium text-slate-500">Remarks (optional)</span>
              <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} className={inputClass} />
            </label>
            {verifyDocument.isError && <p className="text-status-rejected">{(verifyDocument.error as Error).message}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setActing(null)} className="rounded border border-slate-300 px-3.5 py-1.5 text-slate-600">
                Cancel
              </button>
              <button
                type="button"
                disabled={verifyDocument.isPending || !authSession}
                onClick={async () => {
                  if (!authSession) return;
                  await verifyDocument.mutateAsync({
                    id: acting.row.id,
                    status: acting.status,
                    remarks: remarks || null,
                    verifiedByEmployeeId: authSession.employee.id,
                  });
                  setActing(null);
                }}
                className={
                  acting.status === 'verified'
                    ? 'rounded bg-status-approved px-3.5 py-1.5 font-semibold text-white hover:opacity-90 disabled:opacity-60'
                    : 'rounded bg-status-rejected px-3.5 py-1.5 font-semibold text-white hover:opacity-90 disabled:opacity-60'
                }
              >
                {verifyDocument.isPending ? 'Submitting…' : acting.status === 'verified' ? 'Verify' : 'Reject'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
