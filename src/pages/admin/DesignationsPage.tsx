import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Pencil } from 'lucide-react';
import { ReferenceCrudShell } from '@/components/admin/ReferenceCrudShell';
import { Field, FormActions, inputClass } from '@/components/admin/FormField';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useDesignations, useCreateDesignation, useUpdateDesignation, useToggleDesignationActive, useDepartments, useGrades } from '@/hooks/useAdminOrgStructure';
import type { AdminDesignationRow } from '@/types/admin';

const schema = z.object({
  name: z.string().min(1, 'Required'),
  code: z.string().optional(),
  departmentId: z.string().optional(),
  gradeId: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export default function DesignationsPage() {
  const { data, isLoading } = useDesignations();
  const createDesignation = useCreateDesignation();
  const updateDesignation = useUpdateDesignation();
  const toggleActive = useToggleDesignationActive();

  const columns: (helpers: { onEdit: (row: AdminDesignationRow) => void }) => ColumnDef<AdminDesignationRow, any>[] = ({ onEdit }) => [
    { header: 'Code', accessorFn: (r) => r.code ?? '-', id: 'code' },
    { header: 'Designation', accessorKey: 'name' },
    { header: 'Grade', accessorFn: (r) => r.gradeName ?? '-', id: 'grade' },
    { header: 'Department', accessorFn: (r) => r.departmentName ?? '-', id: 'department' },
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
    <ReferenceCrudShell<AdminDesignationRow>
      breadcrumb={[{ label: 'Administration' }, { label: 'Designations' }]}
      title="Designations"
      rows={data ?? []}
      isLoading={isLoading}
      buildColumns={columns}
      searchPlaceholder="Search designations"
      emptyMessage="No designations found."
      formTitle={(mode) => (mode === 'create' ? 'Add Designation' : 'Edit Designation')}
      renderForm={({ mode, initial, onClose }) => (
        <DesignationForm
          initial={initial}
          onDone={onClose}
          onSubmit={async (values) => {
            if (mode === 'create') await createDesignation.mutateAsync(values);
            else await updateDesignation.mutateAsync({ id: initial!.id, input: values });
          }}
          isPending={createDesignation.isPending || updateDesignation.isPending}
          submitError={(createDesignation.error as Error)?.message ?? (updateDesignation.error as Error)?.message}
        />
      )}
    />
  );
}

function DesignationForm({
  initial,
  onDone,
  onSubmit,
  isPending,
  submitError,
}: {
  initial: AdminDesignationRow | null;
  onDone: () => void;
  onSubmit: (values: { name: string; code: string | null; departmentId: string | null; gradeId: string | null }) => Promise<void>;
  isPending: boolean;
  submitError?: string;
}) {
  const { data: departments } = useDepartments();
  const { data: grades } = useGrades();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name ?? '',
      code: initial?.code ?? '',
      departmentId: initial?.departmentId ?? '',
      gradeId: initial?.gradeId ?? '',
    },
  });

  async function submit(values: FormValues) {
    setError(null);
    try {
      await onSubmit({
        name: values.name,
        code: values.code || null,
        departmentId: values.departmentId || null,
        gradeId: values.gradeId || null,
      });
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
      <Field label="Designation" error={errors.name?.message}>
        <input {...register('name')} className={inputClass} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Department">
          <select {...register('departmentId')} className={inputClass}>
            <option value="">None</option>
            {(departments ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Grade">
          <select {...register('gradeId')} className={inputClass}>
            <option value="">None</option>
            {(grades ?? []).map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <FormActions onCancel={onDone} isSubmitting={isPending} error={error ?? submitError} />
    </form>
  );
}
