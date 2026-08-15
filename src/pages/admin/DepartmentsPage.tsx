import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Pencil } from 'lucide-react';
import { ReferenceCrudShell } from '@/components/admin/ReferenceCrudShell';
import { Field, FormActions, inputClass } from '@/components/admin/FormField';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useDepartments, useCreateDepartment, useUpdateDepartment, useToggleDepartmentActive } from '@/hooks/useAdminOrgStructure';
import { useEmployeesForSelect } from '@/hooks/useAdminEmployees';
import type { AdminDepartmentRow } from '@/types/admin';

const schema = z.object({
  name: z.string().min(1, 'Required'),
  code: z.string().optional(),
  headEmployeeId: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export default function DepartmentsPage() {
  const { data, isLoading } = useDepartments();
  const createDepartment = useCreateDepartment();
  const updateDepartment = useUpdateDepartment();
  const toggleActive = useToggleDepartmentActive();

  const columns: (helpers: { onEdit: (row: AdminDepartmentRow) => void }) => ColumnDef<AdminDepartmentRow, any>[] = ({ onEdit }) => [
    { header: 'Code', accessorFn: (r) => r.code ?? '-', id: 'code' },
    { header: 'Department Name', accessorKey: 'name' },
    { header: 'Head', accessorFn: (r) => r.headEmployeeName ?? '-', id: 'head' },
    {
      header: 'Status',
      id: 'status',
      cell: ({ row }) => (
        <button
          type="button"
          onClick={() => toggleActive.mutate({ id: row.original.id, isActive: !row.original.isActive })}
          title="Click to toggle"
        >
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
    <ReferenceCrudShell<AdminDepartmentRow>
      breadcrumb={[{ label: 'Administration' }, { label: 'Departments' }]}
      title="Departments"
      rows={data ?? []}
      isLoading={isLoading}
      buildColumns={columns}
      searchPlaceholder="Search departments"
      emptyMessage="No departments found."
      formTitle={(mode) => (mode === 'create' ? 'Add Department' : 'Edit Department')}
      renderForm={({ mode, initial, onClose }) => (
        <DepartmentForm
          initial={initial}
          onDone={onClose}
          onSubmit={async (values) => {
            if (mode === 'create') await createDepartment.mutateAsync(values);
            else await updateDepartment.mutateAsync({ id: initial!.id, input: values });
          }}
          isPending={createDepartment.isPending || updateDepartment.isPending}
          submitError={(createDepartment.error as Error)?.message ?? (updateDepartment.error as Error)?.message}
        />
      )}
    />
  );
}

function DepartmentForm({
  initial,
  onDone,
  onSubmit,
  isPending,
  submitError,
}: {
  initial: AdminDepartmentRow | null;
  onDone: () => void;
  onSubmit: (values: { name: string; code: string | null; headEmployeeId: string | null }) => Promise<void>;
  isPending: boolean;
  submitError?: string;
}) {
  const { data: employees } = useEmployeesForSelect();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: initial?.name ?? '', code: initial?.code ?? '', headEmployeeId: initial?.headEmployeeId ?? '' },
  });

  async function submit(values: FormValues) {
    setError(null);
    try {
      await onSubmit({ name: values.name, code: values.code || null, headEmployeeId: values.headEmployeeId || null });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-3 text-xs">
      <Field label="Department Code" error={errors.code?.message}>
        <input {...register('code')} className={inputClass} />
      </Field>
      <Field label="Department Name" error={errors.name?.message}>
        <input {...register('name')} className={inputClass} />
      </Field>
      <Field label="Head of Department">
        <select {...register('headEmployeeId')} className={inputClass}>
          <option value="">None</option>
          {(employees ?? []).map((e) => (
            <option key={e.id} value={e.id}>
              {e.name} ({e.employeeCode})
            </option>
          ))}
        </select>
      </Field>
      <FormActions onCancel={onDone} isSubmitting={isPending} error={error ?? submitError} />
    </form>
  );
}
