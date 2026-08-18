import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, Send } from 'lucide-react';
import { ReferenceCrudShell } from '@/components/admin/ReferenceCrudShell';
import { Field, FormActions, inputClass } from '@/components/admin/FormField';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  useEmailTemplates,
  useCreateEmailTemplate,
  useUpdateEmailTemplate,
  useToggleEmailTemplateActive,
  useSendTestEmail,
} from '@/hooks/useAdminEmailTemplates';
import { EMAIL_TEMPLATE_KEYS, EMAIL_TEMPLATE_VARIABLES, findUnknownVariables, renderTemplate } from '@/lib/emailEngine';
import type { AdminEmailTemplateRow } from '@/types/admin';

const templateKeyLabels: Record<string, string> = {
  approval_request: 'Approval Request',
  approval_approved: 'Approval Approved',
  approval_rejected: 'Approval Rejected',
  missing_punch: 'Missing Punch',
  early_going: 'Early Going',
  wfh_weekly_alert: 'WFH Weekly Alert',
  comp_off_expiry: 'Comp-Off Expiry',
  attendance_closure_reminder: 'Attendance Closure Reminder',
  reconciliation_alert: 'Reconciliation Alert',
  system_notification: 'System Notification',
};

/** Sample data for the instant client-side Preview -- never sent anywhere, purely for HR to see how the template renders. */
const SAMPLE_VARIABLES: Record<string, string> = {
  employee_name: 'Bharath S',
  employee_id: 'EMP0001',
  manager_name: 'Arjun Rao',
  request_type: 'Leave',
  from_date: '2026-08-20',
  to_date: '2026-08-22',
  duration: '3 day(s)',
  reason: 'Family function',
  remarks: 'Approved, enjoy your time off.',
  status: 'approved',
  application_id: 'a1b2c3d4-0000-0000-0000-000000000000',
  approval_url: 'https://app.example.com/approvals/a1b2c3d4',
};

const schema = z.object({
  templateKey: z.enum(EMAIL_TEMPLATE_KEYS),
  name: z.string().min(1, 'Required'),
  subject: z.string().min(1, 'Required'),
  body: z.string().min(1, 'Required'),
  isActive: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

export default function EmailTemplatesPage() {
  const { data, isLoading } = useEmailTemplates();
  const createTemplate = useCreateEmailTemplate();
  const updateTemplate = useUpdateEmailTemplate();
  const toggleActive = useToggleEmailTemplateActive();
  const [previewing, setPreviewing] = useState<AdminEmailTemplateRow | null>(null);
  const [testing, setTesting] = useState<AdminEmailTemplateRow | null>(null);

  const columns: (helpers: { onEdit: (row: AdminEmailTemplateRow) => void }) => ColumnDef<AdminEmailTemplateRow, any>[] = ({ onEdit }) => [
    { header: 'Type', accessorFn: (r) => templateKeyLabels[r.templateKey] ?? r.templateKey, id: 'templateKey' },
    { header: 'Name', accessorKey: 'name' },
    { header: 'Subject', accessorKey: 'subject' },
    {
      header: 'Status',
      id: 'status',
      cell: ({ row }) => (
        <button type="button" onClick={() => toggleActive.mutate({ id: row.original.id, isActive: !row.original.isActive })}>
          <StatusBadge status={row.original.isActive ? 'active' : 'inactive'} label={row.original.isActive ? 'Enabled' : 'Disabled'} />
        </button>
      ),
    },
    {
      header: 'Actions',
      id: 'actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => onEdit(row.original)} className="rounded bg-primary-500 p-1 text-white hover:bg-primary-600" title="Edit">
            <Eye className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setPreviewing(row.original)}
            className="rounded border border-slate-300 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
          >
            Preview
          </button>
          <button
            type="button"
            onClick={() => setTesting(row.original)}
            className="flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
          >
            <Send className="h-3 w-3" /> Send Test
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <ReferenceCrudShell<AdminEmailTemplateRow>
        breadcrumb={[{ label: 'Administration' }, { label: 'Email Templates' }]}
        title="Email Templates"
        rows={data ?? []}
        isLoading={isLoading}
        buildColumns={columns}
        searchPlaceholder="Search templates"
        emptyMessage="No email templates found."
        formTitle={(mode) => (mode === 'create' ? 'Add Email Template' : 'Edit Email Template')}
        renderForm={({ mode, initial, onClose }) => (
          <EmailTemplateForm
            initial={initial}
            onDone={onClose}
            onSubmit={async (values) => {
              if (mode === 'create') await createTemplate.mutateAsync(values);
              else await updateTemplate.mutateAsync({ id: initial!.id, input: values });
            }}
            isPending={createTemplate.isPending || updateTemplate.isPending}
            submitError={(createTemplate.error as Error)?.message ?? (updateTemplate.error as Error)?.message}
          />
        )}
      />

      {previewing && <PreviewModal template={previewing} onClose={() => setPreviewing(null)} />}
      {testing && <SendTestModal template={testing} onClose={() => setTesting(null)} />}
    </>
  );
}

function EmailTemplateForm({
  initial,
  onDone,
  onSubmit,
  isPending,
  submitError,
}: {
  initial: AdminEmailTemplateRow | null;
  onDone: () => void;
  onSubmit: (values: FormValues) => Promise<void>;
  isPending: boolean;
  submitError?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      templateKey: initial?.templateKey ?? 'system_notification',
      name: initial?.name ?? '',
      subject: initial?.subject ?? '',
      body: initial?.body ?? '',
      isActive: initial?.isActive ?? true,
    },
  });

  const subjectValue = watch('subject') ?? '';
  const bodyValue = watch('body') ?? '';
  const unknownVars = Array.from(new Set([...findUnknownVariables(subjectValue), ...findUnknownVariables(bodyValue)]));

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
        <Field label="Template Type" error={errors.templateKey?.message}>
          <select {...register('templateKey')} className={inputClass} disabled={Boolean(initial)}>
            {EMAIL_TEMPLATE_KEYS.map((key) => (
              <option key={key} value={key}>
                {templateKeyLabels[key]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Name" error={errors.name?.message}>
          <input {...register('name')} className={inputClass} />
        </Field>
      </div>
      <Field label="Subject" error={errors.subject?.message}>
        <input {...register('subject')} className={inputClass} />
      </Field>
      <Field label="Body" error={errors.body?.message}>
        <textarea {...register('body')} rows={6} className={inputClass} />
      </Field>
      <p className="text-[11px] text-slate-400">
        Supported variables: {EMAIL_TEMPLATE_VARIABLES.map((v) => `{{${v}}}`).join(', ')}
      </p>
      {unknownVars.length > 0 && (
        <p className="rounded bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-700">
          Unsupported variable(s) will render blank: {unknownVars.map((v) => `{{${v}}}`).join(', ')}
        </p>
      )}
      <label className="flex items-center gap-1.5 text-slate-600">
        <input type="checkbox" {...register('isActive')} /> Enabled
      </label>
      <p className="text-[11px] text-slate-400">Only one enabled template per type is allowed -- enabling this one disables any other of the same type.</p>
      <FormActions onCancel={onDone} isSubmitting={isPending} error={error ?? submitError} />
    </form>
  );
}

function PreviewModal({ template, onClose }: { template: AdminEmailTemplateRow; onClose: () => void }) {
  const rendered = renderTemplate({ subject: template.subject, body: template.body }, SAMPLE_VARIABLES);
  return (
    <Modal title={`Preview — ${template.name}`} onClose={onClose}>
      <div className="space-y-3 text-xs">
        <div>
          <p className="mb-1 font-semibold text-slate-500">Subject</p>
          <p className="rounded border border-slate-200 bg-slate-50 px-2.5 py-1.5">{rendered.subject}</p>
        </div>
        <div>
          <p className="mb-1 font-semibold text-slate-500">Body</p>
          <pre className="whitespace-pre-wrap rounded border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-sans">{rendered.body}</pre>
        </div>
        <p className="text-[11px] text-slate-400">Rendered with sample data for preview only -- nothing is sent.</p>
        <div className="flex justify-end pt-1">
          <button type="button" onClick={onClose} className="rounded border border-slate-300 px-3.5 py-1.5 text-slate-600">
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}

function SendTestModal({ template, onClose }: { template: AdminEmailTemplateRow; onClose: () => void }) {
  const sendTest = useSendTestEmail();
  const [recipientEmail, setRecipientEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit() {
    setError(null);
    try {
      await sendTest.mutateAsync({ templateKey: template.templateKey, recipientEmail, variables: SAMPLE_VARIABLES });
      setSent(true);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Modal title={`Send Test — ${template.name}`} onClose={onClose}>
      <div className="space-y-3 text-xs">
        {sent ? (
          <p className="rounded bg-status-approved/10 px-3 py-2 text-status-approved">
            Test email queued. It will be delivered once the outbound email worker processes the queue.
          </p>
        ) : (
          <>
            <Field label="Recipient Email">
              <input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                className={inputClass}
                placeholder="you@example.com"
              />
            </Field>
            <p className="text-[11px] text-slate-400">Sends with sample data, using the template's live saved content (not unsaved form edits).</p>
            {error && <p className="rounded bg-status-rejected/10 px-3 py-2 text-status-rejected">{error}</p>}
          </>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded border border-slate-300 px-3.5 py-1.5 text-slate-600">
            {sent ? 'Close' : 'Cancel'}
          </button>
          {!sent && (
            <button
              type="button"
              onClick={submit}
              disabled={!recipientEmail || sendTest.isPending}
              className="rounded bg-primary-500 px-3.5 py-1.5 font-semibold text-white hover:bg-primary-600 disabled:opacity-60"
            >
              {sendTest.isPending ? 'Sending…' : 'Send Test'}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
