import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Pencil } from 'lucide-react';
import { ReferenceCrudShell } from '@/components/admin/ReferenceCrudShell';
import { Field, FormActions, inputClass } from '@/components/admin/FormField';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useLocations, useCreateLocation, useUpdateLocation, useToggleLocationActive } from '@/hooks/useAdminOrgStructure';
import type { AdminLocationRow } from '@/types/admin';

const schema = z.object({
  name: z.string().min(1, 'Required'),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  timeZone: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export default function LocationsPage() {
  const { data, isLoading } = useLocations();
  const createLocation = useCreateLocation();
  const updateLocation = useUpdateLocation();
  const toggleActive = useToggleLocationActive();

  const columns: (helpers: { onEdit: (row: AdminLocationRow) => void }) => ColumnDef<AdminLocationRow, any>[] = ({ onEdit }) => [
    { header: 'Location', accessorKey: 'name' },
    { header: 'City', accessorFn: (r) => r.city ?? '-', id: 'city' },
    { header: 'State', accessorFn: (r) => r.state ?? '-', id: 'state' },
    { header: 'Country', accessorFn: (r) => r.country ?? '-', id: 'country' },
    { header: 'Time Zone', accessorFn: (r) => r.timeZone ?? '-', id: 'timeZone' },
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
    <ReferenceCrudShell<AdminLocationRow>
      breadcrumb={[{ label: 'Administration' }, { label: 'Locations' }]}
      title="Locations"
      rows={data ?? []}
      isLoading={isLoading}
      buildColumns={columns}
      searchPlaceholder="Search locations"
      emptyMessage="No locations found."
      formTitle={(mode) => (mode === 'create' ? 'Add Location' : 'Edit Location')}
      renderForm={({ mode, initial, onClose }) => (
        <LocationForm
          initial={initial}
          onDone={onClose}
          onSubmit={async (values) => {
            if (mode === 'create') await createLocation.mutateAsync(values);
            else await updateLocation.mutateAsync({ id: initial!.id, input: values });
          }}
          isPending={createLocation.isPending || updateLocation.isPending}
          submitError={(createLocation.error as Error)?.message ?? (updateLocation.error as Error)?.message}
        />
      )}
    />
  );
}

function LocationForm({
  initial,
  onDone,
  onSubmit,
  isPending,
  submitError,
}: {
  initial: AdminLocationRow | null;
  onDone: () => void;
  onSubmit: (values: { name: string; city: string | null; state: string | null; country: string | null; timeZone: string | null }) => Promise<void>;
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
      name: initial?.name ?? '',
      city: initial?.city ?? '',
      state: initial?.state ?? '',
      country: initial?.country ?? 'India',
      timeZone: initial?.timeZone ?? 'Asia/Kolkata',
    },
  });

  async function submit(values: FormValues) {
    setError(null);
    try {
      await onSubmit({
        name: values.name,
        city: values.city || null,
        state: values.state || null,
        country: values.country || null,
        timeZone: values.timeZone || null,
      });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-3 text-xs">
      <Field label="Location" error={errors.name?.message}>
        <input {...register('name')} className={inputClass} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="City">
          <input {...register('city')} className={inputClass} />
        </Field>
        <Field label="State">
          <input {...register('state')} className={inputClass} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Country">
          <input {...register('country')} className={inputClass} />
        </Field>
        <Field label="Time Zone">
          <input {...register('timeZone')} className={inputClass} placeholder="e.g. Asia/Kolkata" />
        </Field>
      </div>
      <FormActions onCancel={onDone} isSubmitting={isPending} error={error ?? submitError} />
    </form>
  );
}
