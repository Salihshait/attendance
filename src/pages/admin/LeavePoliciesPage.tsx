import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Pencil } from 'lucide-react';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { FilterBar, FilterField, FilterSelect } from '@/components/ui/FilterBar';
import { Modal } from '@/components/ui/Modal';
import { Field, FormActions, inputClass } from '@/components/admin/FormField';
import { useLeavePolicies, useCreateLeavePolicy, useUpdateLeavePolicy, useLeaveTypesAdmin } from '@/hooks/useAdminLeaveConfig';
import { useGrades } from '@/hooks/useAdminOrgStructure';
import { findOverlappingLeavePolicy } from '@/lib/leavePolicyValidation';
import { formatDDMMYYYY } from '@/lib/dateFormat';
import type { AdminLeavePolicyRow } from '@/types/admin';

const schema = z
  .object({
    leaveTypeId: z.string().min(1, 'Select a leave type'),
    gradeId: z.string().optional(),
    annualEntitlement: z.string(),
    carryForwardLimit: z.string(),
    encashmentAllowed: z.boolean(),
    effectiveFrom: z.string().min(1, 'Required'),
    effectiveTo: z.string().optional(),
  })
  .refine((v) => !v.effectiveTo || v.effectiveTo >= v.effectiveFrom, { message: 'Must be on or after Effective From', path: ['effectiveTo'] });
type FormValues = z.infer<typeof schema>;

export default function LeavePoliciesPage() {
  const { data, isLoading } = useLeavePolicies();
  const { data: leaveTypes } = useLeaveTypesAdmin();
  const createPolicy = useCreateLeavePolicy();
  const updatePolicy = useUpdateLeavePolicy();
  const [leaveTypeFilter, setLeaveTypeFilter] = useState('all');
  const [editing, setEditing] = useState<{ mode: 'create' | 'edit'; row: AdminLeavePolicyRow | null } | null>(null);

  const leaveTypeOptions = useMemo(
    () => [{ value: 'all', label: 'All' }, ...(leaveTypes ?? []).map((lt) => ({ value: lt.id, label: lt.name }))],
    [leaveTypes],
  );

  const rows = useMemo(
    () => (data ?? []).filter((r) => leaveTypeFilter === 'all' || r.leaveTypeId === leaveTypeFilter),
    [data, leaveTypeFilter],
  );

  const columns: ColumnDef<AdminLeavePolicyRow, any>[] = [
    { header: 'Leave Type', accessorKey: 'leaveTypeName' },
    { header: 'Grade', accessorFn: (r) => r.gradeName ?? 'Org-wide', id: 'grade' },
    { header: 'Annual Entitlement', accessorKey: 'annualEntitlement' },
    { header: 'Carry Forward Limit', accessorKey: 'carryForwardLimit' },
    { header: 'Encashment Allowed', accessorFn: (r) => (r.encashmentAllowed ? 'Yes' : 'No'), id: 'encashment' },
    { header: 'Effective From', accessorFn: (r) => formatDDMMYYYY(r.effectiveFrom), id: 'from' },
    { header: 'Effective To', accessorFn: (r) => (r.effectiveTo ? formatDDMMYYYY(r.effectiveTo) : 'Open-ended'), id: 'to' },
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
      <Breadcrumb items={[{ label: 'Administration' }, { label: 'Leave Policies' }]} />

      <div className="overflow-hidden rounded border border-slate-200 bg-white">
        <PageHeader
          title="Leave Policies"
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

        <FilterBar>
          <FilterField label="Leave Type">
            <FilterSelect value={leaveTypeFilter} onChange={setLeaveTypeFilter} options={leaveTypeOptions} />
          </FilterField>
        </FilterBar>

        <DataTable columns={columns} data={rows} searchPlaceholder="Search leave policies" emptyMessage={isLoading ? 'Loading…' : 'No leave policies found.'} />
      </div>

      {editing && (
        <Modal title={editing.mode === 'create' ? 'Add Leave Policy' : 'Edit Leave Policy'} onClose={() => setEditing(null)} widthClass="max-w-lg">
          <LeavePolicyForm
            initial={editing.row}
            existing={data ?? []}
            onDone={() => setEditing(null)}
            onSubmit={async (values) => {
              if (editing.mode === 'create') await createPolicy.mutateAsync(values);
              else await updatePolicy.mutateAsync({ id: editing.row!.id, input: values });
            }}
            isPending={createPolicy.isPending || updatePolicy.isPending}
            submitError={(createPolicy.error as Error)?.message ?? (updatePolicy.error as Error)?.message}
          />
        </Modal>
      )}
    </div>
  );
}

function LeavePolicyForm({
  initial,
  existing,
  onDone,
  onSubmit,
  isPending,
  submitError,
}: {
  initial: AdminLeavePolicyRow | null;
  existing: AdminLeavePolicyRow[];
  onDone: () => void;
  onSubmit: (values: {
    leaveTypeId: string;
    gradeId: string | null;
    annualEntitlement: number;
    carryForwardLimit: number;
    encashmentAllowed: boolean;
    effectiveFrom: string;
    effectiveTo: string | null;
  }) => Promise<void>;
  isPending: boolean;
  submitError?: string;
}) {
  const { data: leaveTypes } = useLeaveTypesAdmin();
  const { data: grades } = useGrades();
  const [error, setError] = useState<string | null>(null);
  const [overlapWarning, setOverlapWarning] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      leaveTypeId: initial?.leaveTypeId ?? '',
      gradeId: initial?.gradeId ?? '',
      annualEntitlement: String(initial?.annualEntitlement ?? 0),
      carryForwardLimit: String(initial?.carryForwardLimit ?? 0),
      encashmentAllowed: initial?.encashmentAllowed ?? false,
      effectiveFrom: initial?.effectiveFrom ?? '',
      effectiveTo: initial?.effectiveTo ?? '',
    },
  });

  async function submit(values: FormValues) {
    setError(null);
    const candidate = {
      id: initial?.id,
      leaveTypeId: values.leaveTypeId,
      gradeId: values.gradeId || null,
      effectiveFrom: values.effectiveFrom,
      effectiveTo: values.effectiveTo || null,
    };
    const overlap = findOverlappingLeavePolicy(
      existing.map((p) => ({ id: p.id, leaveTypeId: p.leaveTypeId, gradeId: p.gradeId, effectiveFrom: p.effectiveFrom, effectiveTo: p.effectiveTo })),
      candidate,
    );
    if (overlap) {
      setOverlapWarning(
        `This overlaps an existing policy for the same leave type (${overlap.gradeId ? 'that grade' : 'org-wide'}, ${overlap.effectiveFrom} → ${overlap.effectiveTo ?? 'open-ended'}). Adjust the dates or grade before saving.`,
      );
      return;
    }
    setOverlapWarning(null);

    try {
      await onSubmit({
        leaveTypeId: values.leaveTypeId,
        gradeId: values.gradeId || null,
        annualEntitlement: Number(values.annualEntitlement),
        carryForwardLimit: Number(values.carryForwardLimit),
        encashmentAllowed: values.encashmentAllowed,
        effectiveFrom: values.effectiveFrom,
        effectiveTo: values.effectiveTo || null,
      });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-3 text-xs">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Leave Type" error={errors.leaveTypeId?.message}>
          <select {...register('leaveTypeId')} className={inputClass}>
            <option value="">Select</option>
            {(leaveTypes ?? []).map((lt) => (
              <option key={lt.id} value={lt.id}>
                {lt.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Grade (blank = org-wide)">
          <select {...register('gradeId')} className={inputClass}>
            <option value="">Org-wide</option>
            {(grades ?? []).map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Annual Entitlement">
          <input type="number" step="0.5" {...register('annualEntitlement')} className={inputClass} />
        </Field>
        <Field label="Carry Forward Limit">
          <input type="number" step="0.5" {...register('carryForwardLimit')} className={inputClass} />
        </Field>
      </div>
      <label className="flex items-center gap-1.5 text-slate-600">
        <input type="checkbox" {...register('encashmentAllowed')} /> Encashment Allowed
      </label>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Effective From" error={errors.effectiveFrom?.message}>
          <input type="date" {...register('effectiveFrom')} className={inputClass} />
        </Field>
        <Field label="Effective To (optional)" error={errors.effectiveTo?.message}>
          <input type="date" {...register('effectiveTo')} className={inputClass} />
        </Field>
      </div>
      {overlapWarning && <p className="rounded bg-status-pending/10 px-3 py-2 text-[11px] text-status-pending">{overlapWarning}</p>}
      <FormActions onCancel={onDone} isSubmitting={isPending} error={error ?? submitError} />
    </form>
  );
}
