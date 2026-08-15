import { useState, type ReactNode } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import { Breadcrumb, type BreadcrumbItem } from '@/components/layout/Breadcrumb';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { FilterBar } from '@/components/ui/FilterBar';
import { Modal } from '@/components/ui/Modal';

interface EditingState<TRow> {
  mode: 'create' | 'edit';
  row: TRow | null;
}

interface ReferenceCrudShellProps<TRow extends { id: string }> {
  breadcrumb: BreadcrumbItem[];
  title: string;
  rows: TRow[];
  isLoading: boolean;
  buildColumns: (helpers: { onEdit: (row: TRow) => void }) => ColumnDef<TRow, any>[];
  filters?: ReactNode;
  searchPlaceholder?: string;
  emptyMessage: string;
  addLabel?: string;
  formTitle: (mode: 'create' | 'edit') => string;
  renderForm: (props: { mode: 'create' | 'edit'; initial: TRow | null; onClose: () => void }) => ReactNode;
}

/**
 * Shared list+create/edit-modal shell for simple reference-table admin
 * pages (Departments, Designations, Locations, Grades, Leave Types, ...).
 * The caller supplies columns (via a render prop so row actions can open
 * the shell's own edit state) and the form body — everything else
 * (Breadcrumb/PageHeader/DataTable/Modal wiring) is standardized here.
 */
export function ReferenceCrudShell<TRow extends { id: string }>({
  breadcrumb,
  title,
  rows,
  isLoading,
  buildColumns,
  filters,
  searchPlaceholder = 'Search',
  emptyMessage,
  addLabel = 'Add New',
  formTitle,
  renderForm,
}: ReferenceCrudShellProps<TRow>) {
  const [editing, setEditing] = useState<EditingState<TRow> | null>(null);

  const columns = buildColumns({ onEdit: (row) => setEditing({ mode: 'edit', row }) });

  return (
    <div>
      <Breadcrumb items={breadcrumb} />

      <div className="overflow-hidden rounded border border-slate-200 bg-white">
        <PageHeader
          title={title}
          actions={
            <button
              type="button"
              onClick={() => setEditing({ mode: 'create', row: null })}
              className="flex items-center gap-1.5 rounded bg-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/25"
            >
              <Plus className="h-3.5 w-3.5" /> {addLabel}
            </button>
          }
        />

        {filters && <FilterBar>{filters}</FilterBar>}

        <DataTable
          columns={columns}
          data={rows}
          searchPlaceholder={searchPlaceholder}
          emptyMessage={isLoading ? 'Loading…' : emptyMessage}
        />
      </div>

      {editing && (
        <Modal title={formTitle(editing.mode)} onClose={() => setEditing(null)}>
          {renderForm({ mode: editing.mode, initial: editing.row, onClose: () => setEditing(null) })}
        </Modal>
      )}
    </div>
  );
}
