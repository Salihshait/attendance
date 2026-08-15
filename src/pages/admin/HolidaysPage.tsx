import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Pencil, Trash2, Upload } from 'lucide-react';
import { Breadcrumb } from '@/components/layout/Breadcrumb';
import { PageHeader } from '@/components/layout/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { FilterBar, FilterField, FilterSelect } from '@/components/ui/FilterBar';
import { Modal } from '@/components/ui/Modal';
import { Field, FormActions, inputClass } from '@/components/admin/FormField';
import { useHolidaysAdmin, useCreateHoliday, useUpdateHoliday, useDeleteHoliday, useBulkImportHolidays } from '@/hooks/useAdminHolidays';
import { useLocations } from '@/hooks/useAdminOrgStructure';
import { parseHolidayCsv, type CsvParseResult } from '@/lib/csvImport';
import { formatDDMMYYYY } from '@/lib/dateFormat';
import type { AdminHolidayRow } from '@/types/admin';

const schema = z.object({
  holidayDate: z.string().min(1, 'Required'),
  name: z.string().min(1, 'Required'),
  holidayType: z.enum(['public', 'restricted', 'optional']),
  locationId: z.string().optional(),
  description: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

const typeLabels: Record<AdminHolidayRow['holidayType'], string> = { public: 'Public', restricted: 'Restricted', optional: 'Optional' };
const typeOptions = [
  { value: 'all', label: 'All' },
  { value: 'public', label: 'Public' },
  { value: 'restricted', label: 'Restricted' },
  { value: 'optional', label: 'Optional' },
];

export default function HolidaysPage() {
  const { data, isLoading } = useHolidaysAdmin();
  const { data: locations } = useLocations();
  const createHoliday = useCreateHoliday();
  const updateHoliday = useUpdateHoliday();
  const deleteHoliday = useDeleteHoliday();

  const [typeFilter, setTypeFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [editing, setEditing] = useState<{ mode: 'create' | 'edit'; row: AdminHolidayRow | null } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<AdminHolidayRow | null>(null);

  const locationOptions = useMemo(
    () => [{ value: 'all', label: 'All' }, ...(locations ?? []).map((l) => ({ value: l.id, label: l.name }))],
    [locations],
  );

  const rows = useMemo(
    () =>
      (data ?? []).filter((r) => {
        if (typeFilter !== 'all' && r.holidayType !== typeFilter) return false;
        if (locationFilter !== 'all' && r.locationId !== locationFilter) return false;
        return true;
      }),
    [data, typeFilter, locationFilter],
  );

  const columns: ColumnDef<AdminHolidayRow, any>[] = [
    { header: 'Date', accessorFn: (r) => formatDDMMYYYY(r.holidayDate), id: 'date' },
    { header: 'Name', accessorKey: 'name' },
    { header: 'Type', accessorFn: (r) => typeLabels[r.holidayType], id: 'type' },
    { header: 'Location', accessorFn: (r) => r.locationName ?? 'Org-wide', id: 'location' },
    {
      header: 'Actions',
      id: 'actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setEditing({ mode: 'edit', row: row.original })}
            className="rounded bg-primary-500 p-1 text-white hover:bg-primary-600"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => setConfirmDelete(row.original)} className="rounded bg-status-rejected p-1 text-white hover:opacity-90">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <Breadcrumb items={[{ label: 'Administration' }, { label: 'Holidays' }]} />

      <div className="overflow-hidden rounded border border-slate-200 bg-white">
        <PageHeader
          title="Holidays"
          actions={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setImportOpen(true)}
                className="flex items-center gap-1.5 rounded bg-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/25"
              >
                <Upload className="h-3.5 w-3.5" /> Import CSV
              </button>
              <button
                type="button"
                onClick={() => setEditing({ mode: 'create', row: null })}
                className="rounded bg-white/15 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/25"
              >
                + Add New
              </button>
            </div>
          }
        />

        <FilterBar>
          <FilterField label="Type">
            <FilterSelect value={typeFilter} onChange={setTypeFilter} options={typeOptions} />
          </FilterField>
          <FilterField label="Location">
            <FilterSelect value={locationFilter} onChange={setLocationFilter} options={locationOptions} />
          </FilterField>
        </FilterBar>

        <DataTable columns={columns} data={rows} searchPlaceholder="Search holidays" emptyMessage={isLoading ? 'Loading…' : 'No holidays found.'} />
      </div>

      {editing && (
        <Modal title={editing.mode === 'create' ? 'Add Holiday' : 'Edit Holiday'} onClose={() => setEditing(null)}>
          <HolidayForm
            initial={editing.row}
            onDone={() => setEditing(null)}
            onSubmit={async (values) => {
              if (editing.mode === 'create') await createHoliday.mutateAsync(values);
              else await updateHoliday.mutateAsync({ id: editing.row!.id, input: values });
            }}
            isPending={createHoliday.isPending || updateHoliday.isPending}
            submitError={(createHoliday.error as Error)?.message ?? (updateHoliday.error as Error)?.message}
          />
        </Modal>
      )}

      {confirmDelete && (
        <Modal title="Delete Holiday" onClose={() => setConfirmDelete(null)}>
          <div className="space-y-3 text-xs">
            <p className="text-slate-600">
              Delete <span className="font-semibold">{confirmDelete.name}</span> ({formatDDMMYYYY(confirmDelete.holidayDate)})? This cannot be
              undone.
            </p>
            {deleteHoliday.isError && <p className="text-status-rejected">{(deleteHoliday.error as Error).message}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmDelete(null)} className="rounded border border-slate-300 px-3.5 py-1.5 text-slate-600">
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteHoliday.isPending}
                onClick={async () => {
                  await deleteHoliday.mutateAsync(confirmDelete.id);
                  setConfirmDelete(null);
                }}
                className="rounded bg-status-rejected px-3.5 py-1.5 font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                {deleteHoliday.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {importOpen && <ImportCsvModal onClose={() => setImportOpen(false)} />}
    </div>
  );
}

function HolidayForm({
  initial,
  onDone,
  onSubmit,
  isPending,
  submitError,
}: {
  initial: AdminHolidayRow | null;
  onDone: () => void;
  onSubmit: (values: { holidayDate: string; name: string; holidayType: AdminHolidayRow['holidayType']; locationId: string | null; description: string | null }) => Promise<void>;
  isPending: boolean;
  submitError?: string;
}) {
  const { data: locations } = useLocations();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      holidayDate: initial?.holidayDate ?? '',
      name: initial?.name ?? '',
      holidayType: initial?.holidayType ?? 'public',
      locationId: initial?.locationId ?? '',
      description: initial?.description ?? '',
    },
  });

  async function submit(values: FormValues) {
    setError(null);
    try {
      await onSubmit({
        holidayDate: values.holidayDate,
        name: values.name,
        holidayType: values.holidayType,
        locationId: values.locationId || null,
        description: values.description || null,
      });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-3 text-xs">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date" error={errors.holidayDate?.message}>
          <input type="date" {...register('holidayDate')} className={inputClass} />
        </Field>
        <Field label="Type">
          <select {...register('holidayType')} className={inputClass}>
            <option value="public">Public</option>
            <option value="restricted">Restricted</option>
            <option value="optional">Optional</option>
          </select>
        </Field>
      </div>
      <Field label="Name" error={errors.name?.message}>
        <input {...register('name')} className={inputClass} />
      </Field>
      <Field label="Location (blank = org-wide)">
        <select {...register('locationId')} className={inputClass}>
          <option value="">Org-wide</option>
          {(locations ?? []).map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Description (optional)">
        <textarea {...register('description')} rows={2} className={inputClass} />
      </Field>
      <FormActions onCancel={onDone} isSubmitting={isPending} error={error ?? submitError} />
    </form>
  );
}

function ImportCsvModal({ onClose }: { onClose: () => void }) {
  const { data: locations } = useLocations();
  const bulkImport = useBulkImportHolidays();
  const [result, setResult] = useState<CsvParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const locationsByName = useMemo(() => new Map((locations ?? []).map((l) => [l.name.toLowerCase(), l.id])), [locations]);

  function handleFile(file: File) {
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      setResult(parseHolidayCsv(text, locationsByName));
    };
    reader.readAsText(file);
  }

  async function confirmImport() {
    if (!result || result.valid.length === 0) return;
    setError(null);
    try {
      await bulkImport.mutateAsync(result.valid);
      onClose();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Modal title="Import Holidays from CSV" onClose={onClose} widthClass="max-w-2xl">
      <div className="space-y-3 text-xs">
        <p className="text-slate-500">
          Expected header: <code className="rounded bg-slate-100 px-1 py-0.5">date,name,type,location</code> — dates as{' '}
          <code className="rounded bg-slate-100 px-1 py-0.5">YYYY-MM-DD</code>, type is public/restricted/optional, location is optional (blank =
          org-wide) and must match an existing Location name.
        </p>
        <label className="flex cursor-pointer items-center gap-2 rounded border border-dashed border-slate-300 px-3 py-2 text-slate-500 hover:border-primary-400">
          <Upload className="h-3.5 w-3.5 shrink-0" />
          <span>Choose a CSV file</span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </label>

        {result && (
          <div className="space-y-2">
            <p className="text-slate-600">
              <span className="font-semibold text-status-approved">{result.valid.length} valid row(s)</span>
              {result.errors.length > 0 && <span className="font-semibold text-status-rejected"> · {result.errors.length} error(s)</span>}
            </p>
            {result.errors.length > 0 && (
              <ul className="max-h-32 list-disc space-y-0.5 overflow-y-auto rounded bg-status-rejected/10 px-3 py-2 pl-6 text-status-rejected">
                {result.errors.map((e, i) => (
                  <li key={i}>
                    Line {e.line}: {e.message}
                  </li>
                ))}
              </ul>
            )}
            {result.valid.length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded border border-slate-200">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-table-header">
                    <tr>
                      <th className="px-2 py-1">Date</th>
                      <th className="px-2 py-1">Name</th>
                      <th className="px-2 py-1">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.valid.map((r, i) => (
                      <tr key={i} className="odd:bg-white even:bg-slate-50/60">
                        <td className="px-2 py-1">{r.date}</td>
                        <td className="px-2 py-1">{r.name}</td>
                        <td className="px-2 py-1">{r.holidayType}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {error && <p className="rounded bg-status-rejected/10 px-3 py-2 text-status-rejected">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded border border-slate-300 px-3.5 py-1.5 text-slate-600">
            Cancel
          </button>
          <button
            type="button"
            disabled={!result || result.valid.length === 0 || bulkImport.isPending}
            onClick={confirmImport}
            className="rounded bg-primary-500 px-3.5 py-1.5 font-semibold text-white hover:bg-primary-600 disabled:opacity-60"
          >
            {bulkImport.isPending ? 'Importing…' : `Import ${result?.valid.length ?? 0} row(s)`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
