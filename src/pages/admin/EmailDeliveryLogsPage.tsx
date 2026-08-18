import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { FilterBar, FilterField, FilterDate, FilterSelect, FilterButton } from '@/components/ui/FilterBar';
import { StatusBadge, type StatusKind } from '@/components/ui/StatusBadge';
import { useEmailDeliveryLogs, type EmailDeliveryLogFilters } from '@/hooks/useAdminEmailDeliveryLogs';
import type { AdminEmailDeliveryLogRow, EmailDeliveryStatus } from '@/types/admin';

const statusLabels: Record<EmailDeliveryStatus, string> = {
  pending: 'Pending',
  sent: 'Sent',
  failed: 'Failed',
  retrying: 'Retrying',
};
const statusOptions = [{ value: 'all', label: 'All' }, ...Object.entries(statusLabels).map(([value, label]) => ({ value, label }))];

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

export default function EmailDeliveryLogsPage() {
  const [templateKeyFilter, setTemplateKeyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [appliedFilters, setAppliedFilters] = useState<EmailDeliveryLogFilters>({});

  const { data, isLoading } = useEmailDeliveryLogs(appliedFilters);

  const templateKeyOptions = useMemo(() => {
    const keys = new Set((data ?? []).map((r) => r.templateKey));
    return [{ value: 'all', label: 'All' }, ...Array.from(keys).map((k) => ({ value: k, label: templateKeyLabels[k] ?? k }))];
  }, [data]);

  function applyFilters() {
    setAppliedFilters({
      templateKey: templateKeyFilter === 'all' ? undefined : templateKeyFilter,
      status: statusFilter === 'all' ? undefined : (statusFilter as EmailDeliveryStatus),
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    });
  }

  const columns: ColumnDef<AdminEmailDeliveryLogRow, any>[] = [
    { header: 'Sent At', accessorFn: (r) => (r.sentAt ? new Date(r.sentAt).toLocaleString() : '-'), id: 'sentAt' },
    { header: 'Template', accessorFn: (r) => templateKeyLabels[r.templateKey] ?? r.templateKey, id: 'template' },
    { header: 'Recipient', accessorKey: 'recipientEmail' },
    { header: 'CC', accessorFn: (r) => (r.cc.length > 0 ? r.cc.join(', ') : '-'), id: 'cc' },
    { header: 'BCC', accessorFn: (r) => (r.bcc.length > 0 ? r.bcc.join(', ') : '-'), id: 'bcc' },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ getValue }) => {
        const status = getValue<EmailDeliveryStatus>();
        const statusKind: Record<EmailDeliveryStatus, StatusKind> = {
          sent: 'approved',
          pending: 'pending',
          retrying: 'pending',
          failed: 'rejected',
        };
        return <StatusBadge status={statusKind[status]} label={statusLabels[status]} />;
      },
    },
    { header: 'Attempts', accessorKey: 'attemptCount' },
    { header: 'Error', accessorFn: (r) => r.errorMessage ?? '-', id: 'error' },
    { header: 'Reference ID', accessorFn: (r) => r.referenceId ?? '-', id: 'referenceId' },
  ];

  return (
    <div>
      <Breadcrumb items={[{ label: 'Administration' }, { label: 'Email Delivery Logs' }]} />

      <div className="overflow-hidden rounded border border-slate-200 bg-white">
        <PageHeader title="Email Delivery Logs" />

        <FilterBar
          actions={
            <FilterButton onClick={applyFilters} variant="primary">
              Apply
            </FilterButton>
          }
        >
          <FilterField label="Template">
            <FilterSelect value={templateKeyFilter} onChange={setTemplateKeyFilter} options={templateKeyOptions} />
          </FilterField>
          <FilterField label="Status">
            <FilterSelect value={statusFilter} onChange={setStatusFilter} options={statusOptions} />
          </FilterField>
          <FilterField label="From">
            <FilterDate value={dateFrom} onChange={setDateFrom} />
          </FilterField>
          <FilterField label="To">
            <FilterDate value={dateTo} onChange={setDateTo} />
          </FilterField>
        </FilterBar>

        <p className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-[11px] text-slate-500">
          Showing the most recent 500 entries. A row stays "Pending"/"Retrying" until the outbound email worker (a Supabase Edge
          Function) processes it.
        </p>

        <DataTable
          columns={columns}
          data={data ?? []}
          searchPlaceholder="Search by recipient"
          emptyMessage={isLoading ? 'Loading…' : 'No email delivery logs found.'}
        />
      </div>
    </div>
  );
}
