import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { Field, FormActions, inputClass } from '@/components/admin/FormField';
import { useAdminEmployeeList } from '@/hooks/useAdminEmployees';
import { useDepartments } from '@/hooks/useAdminOrgStructure';
import { useSentAnnouncements, useComposeNotification } from '@/hooks/useAdminNotifications';
import type { AdminNotificationRow } from '@/types/admin';

const schema = z.object({
  title: z.string().min(1, 'Required'),
  body: z.string().optional(),
  linkPath: z.string().optional(),
  departmentId: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export default function NotificationsPage() {
  const { data: employees } = useAdminEmployeeList();
  const { data: departments } = useDepartments();
  const { data: sent, isLoading } = useSentAnnouncements();
  const composeNotification = useComposeNotification();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { title: '', body: '', linkPath: '', departmentId: '' } });

  async function submit(values: FormValues) {
    setError(null);
    setResult(null);
    const scoped = (employees ?? []).filter((e) => !values.departmentId || e.departmentId === values.departmentId);
    const withLogin = scoped.filter((e) => e.userId);
    const skipped = scoped.length - withLogin.length;

    try {
      await composeNotification.mutateAsync({
        title: values.title,
        body: values.body || null,
        linkPath: values.linkPath || null,
        recipientUserIds: withLogin.map((e) => e.userId as string),
      });
      setResult(`Sent to ${withLogin.length}, skipped ${skipped} (no login).`);
      reset({ title: '', body: '', linkPath: '', departmentId: '' });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const columns: ColumnDef<AdminNotificationRow, any>[] = [
    { header: 'Title', accessorKey: 'title' },
    { header: 'Recipient', accessorKey: 'recipientName' },
    { header: 'Sent At', accessorFn: (r) => new Date(r.createdAt).toLocaleString(), id: 'sentAt' },
    { header: 'Body', accessorFn: (r) => r.body ?? '-', id: 'body' },
  ];

  const groupedSummary = useMemo(() => {
    const byTitleAndTime = new Map<string, number>();
    for (const row of sent ?? []) {
      const key = `${row.title}|${row.createdAt}`;
      byTitleAndTime.set(key, (byTitleAndTime.get(key) ?? 0) + 1);
    }
    return byTitleAndTime;
  }, [sent]);

  return (
    <div className="space-y-4">
      <Breadcrumb items={[{ label: 'Administration' }, { label: 'Notifications' }]} />

      <div className="overflow-hidden rounded border border-slate-200 bg-white">
        <PageHeader title="Compose Announcement" />
        <form onSubmit={handleSubmit(submit)} className="space-y-3 p-4 text-xs">
          <Field label="Title" error={errors.title?.message}>
            <input {...register('title')} className={inputClass} />
          </Field>
          <Field label="Body (optional)">
            <textarea {...register('body')} rows={3} className={inputClass} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Link Path (optional)">
              <input {...register('linkPath')} className={inputClass} placeholder="/dashboard" />
            </Field>
            <Field label="Scope">
              <select {...register('departmentId')} className={inputClass}>
                <option value="">All Departments</option>
                {(departments ?? []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {result && <p className="rounded bg-status-approved/10 px-3 py-2 text-status-approved">{result}</p>}
          <FormActions onCancel={() => reset()} isSubmitting={composeNotification.isPending} error={error} submitLabel="Send" submittingLabel="Sending…" />
        </form>
      </div>

      <div className="overflow-hidden rounded border border-slate-200 bg-white">
        <PageHeader title="Sent History" />
        <DataTable
          columns={columns}
          data={sent ?? []}
          searchPlaceholder="Search by title"
          emptyMessage={isLoading ? 'Loading…' : 'No announcements sent yet.'}
        />
        {groupedSummary.size > 0 && (
          <p className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">
            Each announcement is stored as one row per recipient — {groupedSummary.size} distinct send(s) shown above as individual rows.
          </p>
        )}
      </div>
    </div>
  );
}
