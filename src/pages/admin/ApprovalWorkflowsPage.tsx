import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Field, FormActions, inputClass } from '@/components/admin/FormField';
import {
  useApprovalWorkflows,
  useCreateWorkflow,
  useUpdateWorkflow,
  useToggleWorkflowActive,
  useApprovalSteps,
  useCreateStep,
  useUpdateStep,
  useDeleteStep,
} from '@/hooks/useAdminApprovalWorkflows';
import { useEmployeesForSelect } from '@/hooks/useAdminEmployees';
import type { AdminApprovalStepRow, AdminApprovalWorkflowRow, ApproverType } from '@/types/admin';

const requestTypeLabels: Record<AdminApprovalWorkflowRow['requestType'], string> = {
  leave_request: 'Leave',
  permission_request: 'Permission',
  onduty_request: 'Work From Home / On Duty',
  attendance_regularization: 'Attendance Regularization',
  exit_request: 'Exit / Resignation',
  bank_detail_change_request: 'Bank Detail Change',
  other_request: 'Other Requests',
};

const workflowSchema = z.object({
  name: z.string().min(1, 'Required'),
  requestType: z.enum([
    'leave_request',
    'permission_request',
    'onduty_request',
    'attendance_regularization',
    'exit_request',
    'bank_detail_change_request',
    'other_request',
  ]),
});
type WorkflowFormValues = z.infer<typeof workflowSchema>;

export default function ApprovalWorkflowsPage() {
  const { data, isLoading } = useApprovalWorkflows();
  const createWorkflow = useCreateWorkflow();
  const updateWorkflow = useUpdateWorkflow();
  const toggleActive = useToggleWorkflowActive();
  const [editing, setEditing] = useState<{ mode: 'create' | 'edit'; row: AdminApprovalWorkflowRow | null } | null>(null);
  const [selected, setSelected] = useState<AdminApprovalWorkflowRow | null>(null);

  const columns: ColumnDef<AdminApprovalWorkflowRow, any>[] = [
    { header: 'Workflow Name', accessorKey: 'name' },
    { header: 'Request Type', accessorFn: (r) => requestTypeLabels[r.requestType], id: 'requestType' },
    { header: 'Steps', accessorKey: 'stepCount' },
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
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => setSelected(row.original)} className="rounded border border-primary-300 px-2 py-1 text-primary-600 hover:bg-primary-50">
            Manage Steps
          </button>
          <button
            type="button"
            onClick={() => setEditing({ mode: 'edit', row: row.original })}
            className="rounded bg-primary-500 p-1 text-white hover:bg-primary-600"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <Breadcrumb items={[{ label: 'Administration' }, { label: 'Approval Workflows' }]} />

      <div className="overflow-hidden rounded border border-slate-200 bg-white">
        <PageHeader
          title="Approval Workflows"
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
        <DataTable columns={columns} data={data ?? []} searchPlaceholder="Search workflows" emptyMessage={isLoading ? 'Loading…' : 'No approval workflows found.'} />
      </div>

      {editing && (
        <Modal title={editing.mode === 'create' ? 'Add Workflow' : 'Edit Workflow'} onClose={() => setEditing(null)}>
          <WorkflowForm
            initial={editing.row}
            onDone={() => setEditing(null)}
            onSubmit={async (values) => {
              if (editing.mode === 'create') await createWorkflow.mutateAsync(values);
              else await updateWorkflow.mutateAsync({ id: editing.row!.id, input: values });
            }}
            isPending={createWorkflow.isPending || updateWorkflow.isPending}
            submitError={(createWorkflow.error as Error)?.message ?? (updateWorkflow.error as Error)?.message}
          />
        </Modal>
      )}

      {selected && <StepsModal workflow={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function WorkflowForm({
  initial,
  onDone,
  onSubmit,
  isPending,
  submitError,
}: {
  initial: AdminApprovalWorkflowRow | null;
  onDone: () => void;
  onSubmit: (values: WorkflowFormValues) => Promise<void>;
  isPending: boolean;
  submitError?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<WorkflowFormValues>({
    resolver: zodResolver(workflowSchema),
    defaultValues: { name: initial?.name ?? '', requestType: initial?.requestType ?? 'leave_request' },
  });

  async function submit(values: WorkflowFormValues) {
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
      <Field label="Workflow Name" error={errors.name?.message}>
        <input {...register('name')} className={inputClass} />
      </Field>
      <Field label="Request Type">
        <select {...register('requestType')} className={inputClass}>
          {Object.entries(requestTypeLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <FormActions onCancel={onDone} isSubmitting={isPending} error={error ?? submitError} />
    </form>
  );
}

function StepsModal({ workflow, onClose }: { workflow: AdminApprovalWorkflowRow; onClose: () => void }) {
  const { data: steps, isLoading } = useApprovalSteps(workflow.id);
  const deleteStep = useDeleteStep();
  const [addingStep, setAddingStep] = useState(false);
  const [editingStep, setEditingStep] = useState<AdminApprovalStepRow | null>(null);

  return (
    <Modal title={`Steps — ${workflow.name}`} onClose={onClose} widthClass="max-w-2xl">
      <div className="space-y-3 text-xs">
        <p className="rounded bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
          Escalation hours are captured here but not yet enforced — the approval engine is currently single-step (manager-or-HR) at runtime.
        </p>

        {isLoading && <p className="text-slate-400">Loading…</p>}
        {!isLoading && (steps ?? []).length === 0 && <p className="text-slate-400">No steps configured yet.</p>}

        <ul className="space-y-2">
          {(steps ?? []).map((step) => (
            <li key={step.id} className="flex items-center justify-between rounded border border-slate-200 px-3 py-2">
              <div>
                <span className="font-semibold text-slate-700">Step {step.stepOrder}</span> ·{' '}
                <span className="text-slate-600">
                  {step.approverType === 'reporting_manager' && 'Reporting Manager'}
                  {step.approverType === 'role' && `Role: ${step.approverRole}`}
                  {step.approverType === 'specific_employee' && `Employee: ${step.approverEmployeeName ?? '-'}`}
                </span>
                {step.isFinal && <span className="ml-2 rounded bg-status-approved/15 px-1.5 py-0.5 text-[10px] text-status-approved">Final</span>}
                {step.escalateAfterHours != null && <span className="ml-2 text-[11px] text-slate-400">Escalate after {step.escalateAfterHours}h</span>}
              </div>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => setEditingStep(step)} className="rounded bg-primary-500 p-1 text-white hover:bg-primary-600">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => deleteStep.mutate({ id: step.id, workflowId: workflow.id })}
                  className="rounded bg-status-rejected p-1 text-white hover:opacity-90"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => setAddingStep(true)}
          className="flex w-full items-center justify-center gap-1.5 rounded border border-dashed border-slate-300 py-2 text-slate-500 hover:border-primary-400 hover:text-primary-600"
        >
          <Plus className="h-3.5 w-3.5" /> Add Step
        </button>

        {(addingStep || editingStep) && (
          <StepForm
            workflowId={workflow.id}
            initial={editingStep}
            nextStepOrder={(steps ?? []).length + 1}
            onDone={() => {
              setAddingStep(false);
              setEditingStep(null);
            }}
          />
        )}
      </div>
    </Modal>
  );
}

const stepSchema = z.object({
  stepOrder: z.string(),
  approverType: z.enum(['reporting_manager', 'role', 'specific_employee']),
  approverRole: z.string().optional(),
  approverEmployeeId: z.string().optional(),
  isFinal: z.boolean(),
  escalateAfterHours: z.string().optional(),
});
type StepFormValues = z.infer<typeof stepSchema>;

function StepForm({
  workflowId,
  initial,
  nextStepOrder,
  onDone,
}: {
  workflowId: string;
  initial: AdminApprovalStepRow | null;
  nextStepOrder: number;
  onDone: () => void;
}) {
  const { data: employees } = useEmployeesForSelect();
  const createStep = useCreateStep();
  const updateStep = useUpdateStep();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<StepFormValues>({
    resolver: zodResolver(stepSchema),
    defaultValues: {
      stepOrder: String(initial?.stepOrder ?? nextStepOrder),
      approverType: initial?.approverType ?? 'reporting_manager',
      approverRole: initial?.approverRole ?? '',
      approverEmployeeId: initial?.approverEmployeeId ?? '',
      isFinal: initial?.isFinal ?? true,
      escalateAfterHours: initial?.escalateAfterHours != null ? String(initial.escalateAfterHours) : '',
    },
  });
  const approverType = watch('approverType');

  async function submit(values: StepFormValues) {
    setError(null);
    const input = {
      workflowId,
      stepOrder: Number(values.stepOrder),
      approverType: values.approverType as ApproverType,
      approverRole: values.approverType === 'role' ? ((values.approverRole || null) as 'manager' | 'hr_admin' | 'super_admin' | null) : null,
      approverEmployeeId: values.approverType === 'specific_employee' ? values.approverEmployeeId || null : null,
      isFinal: values.isFinal,
      escalateAfterHours: values.escalateAfterHours ? Number(values.escalateAfterHours) : null,
    };
    try {
      if (initial) await updateStep.mutateAsync({ id: initial.id, input });
      else await createStep.mutateAsync(input);
      onDone();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-3 rounded border border-slate-200 bg-slate-50 p-3 text-xs">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Step Order">
          <input type="number" {...register('stepOrder')} className={inputClass} />
        </Field>
        <Field label="Approver Type">
          <select {...register('approverType')} className={inputClass}>
            <option value="reporting_manager">Reporting Manager</option>
            <option value="role">Role</option>
            <option value="specific_employee">Specific Employee</option>
          </select>
        </Field>
      </div>
      {approverType === 'role' && (
        <Field label="Role">
          <select {...register('approverRole')} className={inputClass}>
            <option value="manager">Manager</option>
            <option value="hr_admin">HR Administrator</option>
            <option value="super_admin">Super Administrator</option>
          </select>
        </Field>
      )}
      {approverType === 'specific_employee' && (
        <Field label="Employee">
          <select {...register('approverEmployeeId')} className={inputClass}>
            <option value="">Select</option>
            {(employees ?? []).map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} ({e.employeeCode})
              </option>
            ))}
          </select>
        </Field>
      )}
      <div className="grid grid-cols-2 gap-3">
        <label className="flex items-center gap-1.5 pt-5 text-slate-600">
          <input type="checkbox" {...register('isFinal')} /> Final Step
        </label>
        <Field label="Escalate After (hours, not yet enforced)">
          <input type="number" {...register('escalateAfterHours')} className={inputClass} />
        </Field>
      </div>
      <FormActions onCancel={onDone} isSubmitting={createStep.isPending || updateStep.isPending} error={error} submitLabel="Save Step" />
      {errors.stepOrder && <p className="text-status-rejected">{errors.stepOrder.message}</p>}
    </form>
  );
}
