import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { FileDown } from 'lucide-react';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { FilterBar, FilterField, FilterDate, FilterSelect, FilterButton } from '@/components/ui/FilterBar';
import { useAuditLogs } from '@/hooks/useAdminAuditLogs';
import { exportToCsv, type ExportColumn } from '@/lib/exportTable';
import type { AdminAuditLogRow } from '@/types/admin';

const actionLabels: Record<string, string> = {
  login: 'Login',
  logout: 'Logout',
  create: 'Create',
  update: 'Update',
  delete: 'Delete',
  approval: 'Approval',
  rejection: 'Rejection',
  document_upload: 'Document Upload',
  view: 'View',
};
const actionOptions = [{ value: 'all', label: 'All' }, ...Object.entries(actionLabels).map(([value, label]) => ({ value, label }))];

function truncateJson(value: unknown): string {
  if (value == null) return '-';
  const str = JSON.stringify(value);
  return str.length > 60 ? `${str.slice(0, 60)}…` : str;
}

const exportColumns: ExportColumn<AdminAuditLogRow>[] = [
  { header: 'Timestamp', accessor: (r) => new Date(r.createdAt).toISOString() },
  { header: 'User', accessor: (r) => r.actorName },
  { header: 'Module', accessor: (r) => r.module },
  { header: 'Action', accessor: (r) => actionLabels[r.action] ?? r.action },
  { header: 'Record', accessor: (r) => r.recordId ?? '-' },
  { header: 'Old Value', accessor: (r) => (r.oldValue ? JSON.stringify(r.oldValue) : '-') },
  { header: 'New Value', accessor: (r) => (r.newValue ? JSON.stringify(r.newValue) : '-') },
  { header: 'IP Address', accessor: (r) => r.ipAddress ?? '-' },
];

export default function AuditLogsPage() {
  const [moduleFilter, setModuleFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [appliedFilters, setAppliedFilters] = useState<{ module?: string; action?: string; dateFrom?: string; dateTo?: string }>({});

  const { data, isLoading } = useAuditLogs(appliedFilters);

  const moduleOptions = useMemo(() => {
    const modules = new Set((data ?? []).map((r) => r.module));
    return [{ value: 'all', label: 'All' }, ...Array.from(modules).map((m) => ({ value: m, label: m }))];
  }, [data]);

  function applyFilters() {
    setAppliedFilters({
      module: moduleFilter === 'all' ? undefined : moduleFilter,
      action: actionFilter === 'all' ? undefined : actionFilter,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    });
  }

  const columns: ColumnDef<AdminAuditLogRow, any>[] = [
    { header: 'Timestamp', accessorFn: (r) => new Date(r.createdAt).toLocaleString(), id: 'timestamp' },
    { header: 'User', accessorKey: 'actorName' },
    { header: 'Module', accessorKey: 'module' },
    { header: 'Action', accessorFn: (r) => actionLabels[r.action] ?? r.action, id: 'action' },
    { header: 'Record', accessorFn: (r) => r.recordId ?? '-', id: 'record' },
    { header: 'Old Value', accessorFn: (r) => truncateJson(r.oldValue), id: 'oldValue' },
    { header: 'New Value', accessorFn: (r) => truncateJson(r.newValue), id: 'newValue' },
    { header: 'IP Address', accessorFn: (r) => r.ipAddress ?? '—', id: 'ip' },
  ];

  return (
    <div>
      <Breadcrumb items={[{ label: 'Administration' }, { label: 'Audit Logs' }]} />

      <div className="overflow-hidden rounded border border-slate-200 bg-white">
        <PageHeader title="Audit Logs" />

        <FilterBar
          actions={
            <>
              <FilterButton onClick={applyFilters} variant="primary">
                Apply
              </FilterButton>
              <FilterButton onClick={() => exportToCsv(exportColumns, data ?? [], `audit-logs-${Date.now()}.csv`)}>
                <span className="flex items-center gap-1.5">
                  <FileDown className="h-3.5 w-3.5" /> Export CSV
                </span>
              </FilterButton>
            </>
          }
        >
          <FilterField label="Module">
            <FilterSelect value={moduleFilter} onChange={setModuleFilter} options={moduleOptions} />
          </FilterField>
          <FilterField label="Action">
            <FilterSelect value={actionFilter} onChange={setActionFilter} options={actionOptions} />
          </FilterField>
          <FilterField label="From">
            <FilterDate value={dateFrom} onChange={setDateFrom} />
          </FilterField>
          <FilterField label="To">
            <FilterDate value={dateTo} onChange={setDateTo} />
          </FilterField>
        </FilterBar>

        <p className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-[11px] text-slate-500">
          Showing the most recent 500 entries. IP Address is not captured by any code path today, so it always shows "—".
        </p>

        <DataTable columns={columns} data={data ?? []} searchPlaceholder="Search by user or module" emptyMessage={isLoading ? 'Loading…' : 'No audit log entries found.'} />
      </div>
    </div>
  );
}
