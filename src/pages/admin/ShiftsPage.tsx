import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Pencil } from 'lucide-react';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Field, FormActions, inputClass } from '@/components/admin/FormField';
import { useShifts, useCreateShift, useUpdateShift, useToggleShiftActive } from '@/hooks/useAdminShifts';
import { formatClockTime } from '@/lib/dateFormat';
import type { AdminShiftRow } from '@/types/admin';

const schema = z.object({
  name: z.string().min(1, 'Required'),
  startTime: z.string().min(1, 'Required'),
  endTime: z.string().min(1, 'Required'),
  graceMinutes: z.string(),
  halfDayHours: z.string(),
  fullDayHours: z.string(),
});
type FormValues = z.infer<typeof schema>;

function toClockIso(hhmm: string): string {
  return `2000-01-01T${hhmm}:00`;
}

export default function ShiftsPage() {
  const { data, isLoading } = useShifts();
  const createShift = useCreateShift();
  const updateShift = useUpdateShift();
  const toggleActive = useToggleShiftActive();
  const [editing, setEditing] = useState<{ mode: 'create' | 'edit'; row: AdminShiftRow | null } | null>(null);

  const columns: ColumnDef<AdminShiftRow, any>[] = [
    { header: 'Shift Name', accessorKey: 'name' },
    { header: 'Start', accessorFn: (r) => formatClockTime(toClockIso(r.startTime.slice(0, 5))), id: 'start' },
    { header: 'End', accessorFn: (r) => formatClockTime(toClockIso(r.endTime.slice(0, 5))), id: 'end' },
    { header: 'Grace (min)', accessorKey: 'graceMinutes' },
    { header: 'Half-Day Hrs', accessorKey: 'halfDayHours' },
    { header: 'Full-Day Hrs', accessorKey: 'fullDayHours' },
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
    <div>
      <Breadcrumb items={[{ label: 'Administration' }, { label: 'Shifts' }]} />

      <div className="overflow-hidden rounded border border-slate-200 bg-white">
        <PageHeader
          title="Shifts"
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
        <DataTable columns={columns} data={data ?? []} searchPlaceholder="Search shifts" emptyMessage={isLoading ? 'Loading…' : 'No shifts found.'} />
      </div>

      {editing && (
        <Modal title={editing.mode === 'create' ? 'Add Shift' : 'Edit Shift'} onClose={() => setEditing(null)}>
          <ShiftForm
            initial={editing.row}
            onDone={() => setEditing(null)}
            onSubmit={async (values) => {
              if (editing.mode === 'create') await createShift.mutateAsync(values);
              else await updateShift.mutateAsync({ id: editing.row!.id, input: values });
            }}
            isPending={createShift.isPending || updateShift.isPending}
            submitError={(createShift.error as Error)?.message ?? (updateShift.error as Error)?.message}
          />
        </Modal>
      )}
    </div>
  );
}

function ShiftForm({
  initial,
  onDone,
  onSubmit,
  isPending,
  submitError,
}: {
  initial: AdminShiftRow | null;
  onDone: () => void;
  onSubmit: (values: {
    name: string;
    startTime: string;
    endTime: string;
    graceMinutes: number;
    halfDayHours: number;
    fullDayHours: number;
  }) => Promise<void>;
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
      startTime: initial?.startTime?.slice(0, 5) ?? '09:30',
      endTime: initial?.endTime?.slice(0, 5) ?? '18:30',
      graceMinutes: String(initial?.graceMinutes ?? 15),
      halfDayHours: String(initial?.halfDayHours ?? 4.5),
      fullDayHours: String(initial?.fullDayHours ?? 8),
    },
  });

  async function submit(values: FormValues) {
    setError(null);
    try {
      await onSubmit({
        name: values.name,
        startTime: values.startTime,
        endTime: values.endTime,
        graceMinutes: Number(values.graceMinutes),
        halfDayHours: Number(values.halfDayHours),
        fullDayHours: Number(values.fullDayHours),
      });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-3 text-xs">
      <Field label="Shift Name" error={errors.name?.message}>
        <input {...register('name')} className={inputClass} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start Time" error={errors.startTime?.message}>
          <input type="time" {...register('startTime')} className={inputClass} />
        </Field>
        <Field label="End Time" error={errors.endTime?.message}>
          <input type="time" {...register('endTime')} className={inputClass} />
        </Field>
      </div>
      <p className="text-[11px] text-slate-400">An end time on or before the start time is treated as an overnight shift.</p>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Grace (min)">
          <input type="number" {...register('graceMinutes')} className={inputClass} />
        </Field>
        <Field label="Min/Half-Day Hrs">
          <input type="number" step="0.5" {...register('halfDayHours')} className={inputClass} />
        </Field>
        <Field label="Full-Day Hrs">
          <input type="number" step="0.5" {...register('fullDayHours')} className={inputClass} />
        </Field>
      </div>
      <p className="text-[11px] text-slate-400">Break policy (minimum/standard/maximum, paid, deduction mode) is configured on Attendance Rules.</p>
      <FormActions onCancel={onDone} isSubmitting={isPending} error={error ?? submitError} />
    </form>
  );
}

