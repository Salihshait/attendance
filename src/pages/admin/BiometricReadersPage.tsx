import { useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Wifi, RefreshCw } from 'lucide-react';
import { ReferenceCrudShell } from '@/components/admin/ReferenceCrudShell';
import { Field, FormActions, inputClass } from '@/components/admin/FormField';
import { Modal } from '@/components/ui/Modal';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { DataTable } from '@/components/ui/DataTable';
import {
  useBiometricReaders,
  useCreateBiometricReader,
  useUpdateBiometricReader,
  useToggleBiometricReaderActive,
  useTestBiometricReaderConnection,
  useSyncBiometricReader,
  useBiometricSyncLogs,
} from '@/hooks/useAdminBiometricReaders';
import type { AdminBiometricReaderRow, BiometricReaderType } from '@/types/admin';

const readerTypeLabels: Record<BiometricReaderType, string> = {
  biometric: 'Biometric',
  rfid: 'RFID',
  face_recognition: 'Face Recognition',
  hybrid: 'Hybrid',
};

const schema = z.object({
  name: z.string().min(1, 'Required'),
  deviceId: z.string().min(1, 'Required'),
  readerType: z.enum(['biometric', 'rfid', 'face_recognition', 'hybrid']),
  ipAddress: z.string().min(1, 'Required'),
  port: z.string(),
  location: z.string(),
  syncIntervalMinutes: z.string(),
});
type FormValues = z.infer<typeof schema>;

export default function BiometricReadersPage() {
  const { data, isLoading } = useBiometricReaders();
  const createReader = useCreateBiometricReader();
  const updateReader = useUpdateBiometricReader();
  const toggleActive = useToggleBiometricReaderActive();
  const testConnection = useTestBiometricReaderConnection();
  const syncReader = useSyncBiometricReader();
  const [viewingLogsFor, setViewingLogsFor] = useState<AdminBiometricReaderRow | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  async function runTest(reader: AdminBiometricReaderRow) {
    setActionMessage(null);
    try {
      const result = await testConnection.mutateAsync(reader.id);
      setActionMessage(`${reader.name}: ${result.success ? 'Connection OK' : `Connection failed — ${result.message ?? ''}`}`);
    } catch (e) {
      setActionMessage(`${reader.name}: Connection test failed — ${(e as Error).message}`);
    }
  }

  async function runSync(reader: AdminBiometricReaderRow) {
    setActionMessage(null);
    try {
      const result = await syncReader.mutateAsync(reader.id);
      setActionMessage(
        result.success ? `${reader.name}: Sync completed (${result.recordsSynced ?? 0} record(s))` : `${reader.name}: Sync failed — ${result.message ?? ''}`,
      );
    } catch (e) {
      setActionMessage(`${reader.name}: Sync failed — ${(e as Error).message}`);
    }
  }

  const columns: (helpers: { onEdit: (row: AdminBiometricReaderRow) => void }) => ColumnDef<AdminBiometricReaderRow, any>[] = ({ onEdit }) => [
    { header: 'Name', accessorKey: 'name' },
    { header: 'Device ID', accessorKey: 'deviceId' },
    { header: 'Type', accessorFn: (r) => readerTypeLabels[r.readerType], id: 'type' },
    { header: 'IP : Port', accessorFn: (r) => `${r.ipAddress}:${r.port}`, id: 'ipPort' },
    { header: 'Location', accessorFn: (r) => r.location ?? '-', id: 'location' },
    { header: 'Sync Interval', accessorFn: (r) => `${r.syncIntervalMinutes} min`, id: 'syncInterval' },
    {
      header: 'Last Sync',
      id: 'lastSync',
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div className="space-y-0.5">
            <div>{r.lastSyncAt ? new Date(r.lastSyncAt).toLocaleString() : 'Never'}</div>
            <StatusBadge
              status={r.lastSyncStatus === 'success' ? 'approved' : r.lastSyncStatus === 'failed' ? 'rejected' : 'pending'}
              label={r.lastSyncStatus === 'success' ? 'Success' : r.lastSyncStatus === 'failed' ? 'Failed' : 'Never synced'}
            />
          </div>
        );
      },
    },
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
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={() => onEdit(row.original)} className="rounded bg-primary-500 px-2 py-1 text-[11px] font-semibold text-white hover:bg-primary-600">
            Edit
          </button>
          <button
            type="button"
            onClick={() => runTest(row.original)}
            className="flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
          >
            <Wifi className="h-3 w-3" /> Test
          </button>
          <button
            type="button"
            onClick={() => runSync(row.original)}
            className="flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className="h-3 w-3" /> Sync
          </button>
          <button
            type="button"
            onClick={() => setViewingLogsFor(row.original)}
            className="rounded border border-slate-300 px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
          >
            Logs
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      {actionMessage && (
        <div className="mb-3 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">{actionMessage}</div>
      )}
      <ReferenceCrudShell<AdminBiometricReaderRow>
        breadcrumb={[{ label: 'Administration' }, { label: 'Biometric Readers' }]}
        title="Biometric Reader Configuration"
        rows={data ?? []}
        isLoading={isLoading}
        buildColumns={columns}
        searchPlaceholder="Search readers"
        emptyMessage="No biometric readers configured."
        formTitle={(mode) => (mode === 'create' ? 'Add Biometric Reader' : 'Edit Biometric Reader')}
        renderForm={({ mode, initial, onClose }) => (
          <BiometricReaderForm
            initial={initial}
            onDone={onClose}
            onSubmit={async (values) => {
              if (mode === 'create') await createReader.mutateAsync(values);
              else await updateReader.mutateAsync({ id: initial!.id, input: values });
            }}
            isPending={createReader.isPending || updateReader.isPending}
            submitError={(createReader.error as Error)?.message ?? (updateReader.error as Error)?.message}
          />
        )}
      />

      {viewingLogsFor && <SyncLogsModal reader={viewingLogsFor} onClose={() => setViewingLogsFor(null)} />}
    </>
  );
}

function BiometricReaderForm({
  initial,
  onDone,
  onSubmit,
  isPending,
  submitError,
}: {
  initial: AdminBiometricReaderRow | null;
  onDone: () => void;
  onSubmit: (values: {
    name: string;
    deviceId: string;
    readerType: BiometricReaderType;
    ipAddress: string;
    port: number;
    location: string;
    syncIntervalMinutes: number;
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
      deviceId: initial?.deviceId ?? '',
      readerType: initial?.readerType ?? 'biometric',
      ipAddress: initial?.ipAddress ?? '',
      port: String(initial?.port ?? 4370),
      location: initial?.location ?? '',
      syncIntervalMinutes: String(initial?.syncIntervalMinutes ?? 15),
    },
  });

  async function submit(values: FormValues) {
    setError(null);
    try {
      await onSubmit({
        name: values.name,
        deviceId: values.deviceId,
        readerType: values.readerType,
        ipAddress: values.ipAddress,
        port: Number(values.port),
        location: values.location,
        syncIntervalMinutes: Number(values.syncIntervalMinutes),
      });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-3 text-xs">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Reader Name" error={errors.name?.message}>
          <input {...register('name')} className={inputClass} />
        </Field>
        <Field label="Device ID" error={errors.deviceId?.message}>
          <input {...register('deviceId')} className={inputClass} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type">
          <select {...register('readerType')} className={inputClass}>
            {Object.entries(readerTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Location">
          <input {...register('location')} className={inputClass} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="IP Address" error={errors.ipAddress?.message}>
          <input {...register('ipAddress')} placeholder="192.168.1.50" className={inputClass} />
        </Field>
        <Field label="Port">
          <input type="number" {...register('port')} className={inputClass} />
        </Field>
      </div>
      <Field label="Sync Interval (minutes)">
        <input type="number" {...register('syncIntervalMinutes')} className={inputClass} />
      </Field>
      <FormActions onCancel={onDone} isSubmitting={isPending} error={error ?? submitError} />
    </form>
  );
}

function SyncLogsModal({ reader, onClose }: { reader: AdminBiometricReaderRow; onClose: () => void }) {
  const { data, isLoading } = useBiometricSyncLogs(reader.id);

  const columns: ColumnDef<NonNullable<typeof data>[number]>[] = [
    { header: 'Time', accessorFn: (r) => new Date(r.createdAt).toLocaleString(), id: 'time' },
    { header: 'Event', accessorKey: 'eventType' },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: ({ getValue }) => {
        const status = getValue<string>();
        return <StatusBadge status={status === 'success' ? 'approved' : status === 'failed' ? 'rejected' : 'pending'} label={status} />;
      },
    },
    { header: 'Records Synced', accessorFn: (r) => r.recordsSynced ?? '-', id: 'records' },
    { header: 'Error', accessorFn: (r) => r.errorMessage ?? '-', id: 'error' },
  ];

  return (
    <Modal title={`Sync Logs — ${reader.name}`} onClose={onClose}>
      <div className="max-h-[60vh] overflow-y-auto">
        <DataTable columns={columns} data={data ?? []} emptyMessage={isLoading ? 'Loading…' : 'No sync log entries yet.'} />
      </div>
      <div className="flex justify-end pt-3">
        <button type="button" onClick={onClose} className="rounded border border-slate-300 px-3.5 py-1.5 text-xs text-slate-600">
          Close
        </button>
      </div>
    </Modal>
  );
}
