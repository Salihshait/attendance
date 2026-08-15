import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Pencil } from 'lucide-react';
import { ReferenceCrudShell } from '@/components/admin/ReferenceCrudShell';
import { Field, FormActions, inputClass } from '@/components/admin/FormField';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useGrades, useCreateGrade, useUpdateGrade, useToggleGradeActive } from '@/hooks/useAdminOrgStructure';
import type { AdminGradeRow } from '@/types/admin';

const schema = z.object({
  name: z.string().min(1, 'Required'),
  rank: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export default function GradesPage() {
  const { data, isLoading } = useGrades();
  const createGrade = useCreateGrade();
  const updateGrade = useUpdateGrade();
  const toggleActive = useToggleGradeActive();

  const columns: (helpers: { onEdit: (row: AdminGradeRow) => void }) => ColumnDef<AdminGradeRow, any>[] = ({ onEdit }) => [
    { header: 'Name', accessorKey: 'name' },
    { header: 'Rank', accessorFn: (r) => r.rank ?? '-', id: 'rank' },
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
    <ReferenceCrudShell<AdminGradeRow>
      breadcrumb={[{ label: 'Administration' }, { label: 'Grades' }]}
      title="Grades"
      rows={data ?? []}
      isLoading={isLoading}
      buildColumns={columns}
      searchPlaceholder="Search grades"
      emptyMessage="No grades found."
      formTitle={(mode) => (mode === 'create' ? 'Add Grade' : 'Edit Grade')}
      renderForm={({ mode, initial, onClose }) => (
        <GradeForm
          initial={initial}
          onDone={onClose}
          onSubmit={async (values) => {
            if (mode === 'create') await createGrade.mutateAsync(values);
            else await updateGrade.mutateAsync({ id: initial!.id, input: values });
          }}
          isPending={createGrade.isPending || updateGrade.isPending}
          submitError={(createGrade.error as Error)?.message ?? (updateGrade.error as Error)?.message}
        />
      )}
    />
  );
}

function GradeForm({
  initial,
  onDone,
  onSubmit,
  isPending,
  submitError,
}: {
  initial: AdminGradeRow | null;
  onDone: () => void;
  onSubmit: (values: { name: string; rank: number | null }) => Promise<void>;
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
    defaultValues: { name: initial?.name ?? '', rank: initial?.rank != null ? String(initial.rank) : '' },
  });

  async function submit(values: FormValues) {
    setError(null);
    try {
      await onSubmit({ name: values.name, rank: values.rank ? Number(values.rank) : null });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-3 text-xs">
      <Field label="Name" error={errors.name?.message}>
        <input {...register('name')} className={inputClass} />
      </Field>
      <Field label="Rank">
        <input type="number" {...register('rank')} className={inputClass} />
      </Field>
      <FormActions onCancel={onDone} isSubmitting={isPending} error={error ?? submitError} />
    </form>
  );
}
