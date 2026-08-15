import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Pencil } from 'lucide-react';
import { ReferenceCrudShell } from '@/components/admin/ReferenceCrudShell';
import { Field, FormActions, inputClass } from '@/components/admin/FormField';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useLeaveTypesAdmin, useCreateLeaveType, useUpdateLeaveType, useToggleLeaveTypeActive } from '@/hooks/useAdminLeaveConfig';
import type { AdminLeaveTypeRow } from '@/types/admin';

const schema = z.object({
  code: z.string().min(1, 'Required'),
  name: z.string().min(1, 'Required'),
  isPaid: z.boolean(),
  accrualFrequency: z.enum(['monthly', 'yearly', 'none']),
  allowHalfDay: z.boolean(),
  requiresAttachment: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

const accrualLabels: Record<AdminLeaveTypeRow['accrualFrequency'], string> = { monthly: 'Monthly', yearly: 'Yearly', none: 'None' };

export default function LeaveTypesPage() {
  const { data, isLoading } = useLeaveTypesAdmin();
  const createLeaveType = useCreateLeaveType();
  const updateLeaveType = useUpdateLeaveType();
  const toggleActive = useToggleLeaveTypeActive();

  const columns: (helpers: { onEdit: (row: AdminLeaveTypeRow) => void }) => ColumnDef<AdminLeaveTypeRow, any>[] = ({ onEdit }) => [
    { header: 'Code', accessorKey: 'code' },
    { header: 'Name', accessorKey: 'name' },
    { header: 'Paid', accessorFn: (r) => (r.isPaid ? 'Yes' : 'No'), id: 'isPaid' },
    { header: 'Accrual Frequency', accessorFn: (r) => accrualLabels[r.accrualFrequency], id: 'accrual' },
    { header: 'Half-Day Allowed', accessorFn: (r) => (r.allowHalfDay ? 'Yes' : 'No'), id: 'allowHalfDay' },
    { header: 'Requires Attachment', accessorFn: (r) => (r.requiresAttachment ? 'Yes' : 'No'), id: 'requiresAttachment' },
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
        <button type="button" onClick={() => onEdit(row.original)} className="rounded bg-primary-500 p-1 text-white hover:bg-primary-600">
          <Pencil className="h-3.5 w-3.5" />
        </button>
      ),
    },
  ];

  return (
    <ReferenceCrudShell<AdminLeaveTypeRow>
      breadcrumb={[{ label: 'Administration' }, { label: 'Leave Types' }]}
      title="Leave Types"
      rows={data ?? []}
      isLoading={isLoading}
      buildColumns={columns}
      searchPlaceholder="Search leave types"
      emptyMessage="No leave types found."
      formTitle={(mode) => (mode === 'create' ? 'Add Leave Type' : 'Edit Leave Type')}
      renderForm={({ mode, initial, onClose }) => (
        <LeaveTypeForm
          initial={initial}
          onDone={onClose}
          onSubmit={async (values) => {
            if (mode === 'create') await createLeaveType.mutateAsync(values);
            else await updateLeaveType.mutateAsync({ id: initial!.id, input: values });
          }}
          isPending={createLeaveType.isPending || updateLeaveType.isPending}
          submitError={(createLeaveType.error as Error)?.message ?? (updateLeaveType.error as Error)?.message}
        />
      )}
    />
  );
}

function LeaveTypeForm({
  initial,
  onDone,
  onSubmit,
  isPending,
  submitError,
}: {
  initial: AdminLeaveTypeRow | null;
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
    defaultValues: {
      code: initial?.code ?? '',
      name: initial?.name ?? '',
      isPaid: initial?.isPaid ?? true,
      accrualFrequency: initial?.accrualFrequency ?? 'yearly',
      allowHalfDay: initial?.allowHalfDay ?? true,
      requiresAttachment: initial?.requiresAttachment ?? false,
    },
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
      <div className="grid grid-cols-2 gap-3">
        <Field label="Code" error={errors.code?.message}>
          <input {...register('code')} className={inputClass} />
        </Field>
        <Field label="Name" error={errors.name?.message}>
          <input {...register('name')} className={inputClass} />
        </Field>
      </div>
      <Field label="Accrual Frequency">
        <select {...register('accrualFrequency')} className={inputClass}>
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
          <option value="none">None</option>
        </select>
      </Field>
      <div className="flex flex-wrap gap-4 pt-1">
        <label className="flex items-center gap-1.5 text-slate-600">
          <input type="checkbox" {...register('isPaid')} /> Is Paid
        </label>
        <label className="flex items-center gap-1.5 text-slate-600">
          <input type="checkbox" {...register('allowHalfDay')} /> Allow Half Day
        </label>
        <label className="flex items-center gap-1.5 text-slate-600">
          <input type="checkbox" {...register('requiresAttachment')} /> Requires Attachment
        </label>
      </div>
      <FormActions onCancel={onDone} isSubmitting={isPending} error={error ?? submitError} />
    </form>
  );
}
