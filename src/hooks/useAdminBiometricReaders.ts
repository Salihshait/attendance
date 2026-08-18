import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { ORG_ID } from '@/lib/orgContext';
import type { AdminBiometricReaderRow, AdminBiometricSyncLogRow, BiometricReaderType } from '@/types/admin';

const READER_SELECT =
  'id, name, device_id, reader_type, ip_address, port, location, is_active, sync_interval_minutes, last_sync_at, last_sync_status, last_error_message';

function mapReaderRow(r: any): AdminBiometricReaderRow {
  return {
    id: r.id,
    name: r.name,
    deviceId: r.device_id,
    readerType: r.reader_type,
    ipAddress: r.ip_address,
    port: r.port,
    location: r.location,
    isActive: r.is_active,
    syncIntervalMinutes: r.sync_interval_minutes,
    lastSyncAt: r.last_sync_at,
    lastSyncStatus: r.last_sync_status,
    lastErrorMessage: r.last_error_message,
  };
}

export function useBiometricReaders() {
  return useQuery({
    queryKey: ['admin-biometric-readers'],
    queryFn: async (): Promise<AdminBiometricReaderRow[]> => {
      const { data, error } = await supabase.from('biometric_readers').select(READER_SELECT).eq('organization_id', ORG_ID).order('name');
      if (error) throw error;
      return (data ?? []).map(mapReaderRow);
    },
  });
}

export interface BiometricReaderInput {
  name: string;
  deviceId: string;
  readerType: BiometricReaderType;
  ipAddress: string;
  port: number;
  location: string;
  syncIntervalMinutes: number;
}

function toReaderRow(input: BiometricReaderInput) {
  return {
    name: input.name,
    device_id: input.deviceId,
    reader_type: input.readerType,
    ip_address: input.ipAddress,
    port: input.port,
    location: input.location || null,
    sync_interval_minutes: input.syncIntervalMinutes,
  };
}

export function useCreateBiometricReader() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: BiometricReaderInput) => {
      const { error } = await supabase.from('biometric_readers').insert({ ...toReaderRow(input), organization_id: ORG_ID });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-biometric-readers'] }),
  });
}

export function useUpdateBiometricReader() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: BiometricReaderInput }) => {
      const { error } = await supabase.from('biometric_readers').update(toReaderRow(input)).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-biometric-readers'] }),
  });
}

export function useToggleBiometricReaderActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase.from('biometric_readers').update({ is_active: isActive }).eq('id', id);
      if (error) throw error;
      await supabase.rpc('record_biometric_sync_event', {
        _reader_id: id,
        _event_type: isActive ? 'enabled' : 'disabled',
        _status: 'success',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-biometric-readers'] });
      queryClient.invalidateQueries({ queryKey: ['admin-biometric-sync-logs'] });
    },
  });
}

export function useBiometricSyncLogs(readerId?: string) {
  return useQuery({
    queryKey: ['admin-biometric-sync-logs', readerId],
    queryFn: async (): Promise<AdminBiometricSyncLogRow[]> => {
      let query = supabase
        .from('biometric_sync_logs')
        .select('id, reader_id, event_type, status, records_synced, error_message, created_at, reader:biometric_readers(name)')
        .eq('organization_id', ORG_ID)
        .order('created_at', { ascending: false })
        .limit(200);
      if (readerId) query = query.eq('reader_id', readerId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        readerId: r.reader_id,
        readerName: (r.reader as unknown as { name: string } | null)?.name ?? '-',
        eventType: r.event_type,
        status: r.status,
        recordsSynced: r.records_synced,
        errorMessage: r.error_message,
        createdAt: r.created_at,
      }));
    },
  });
}

/**
 * Test/Sync cannot be performed from the browser or from Postgres itself --
 * both need a real TCP round-trip to the reader's IP/port, which only the
 * biometric-reader-action edge function (supabase/functions/, not
 * deployed/tested from this session) can do. That function is a stateless
 * network probe only (it doesn't touch the database) -- the *caller*
 * records the outcome via record_biometric_sync_event(), using the
 * already-authenticated HR admin's own session, rather than the edge
 * function needing its own privileged write path for this.
 */
export function useTestBiometricReaderConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (readerId: string) => {
      const { data: reader, error: readerError } = await supabase.from('biometric_readers').select('ip_address, port').eq('id', readerId).single();
      if (readerError) throw readerError;

      const { data, error } = await supabase.functions.invoke('biometric-reader-action', {
        body: { ipAddress: reader.ip_address, port: reader.port },
      });
      if (error) throw error;
      const result = data as { success: boolean; message?: string };

      await supabase.rpc('record_biometric_sync_event', {
        _reader_id: readerId,
        _event_type: 'test_connection',
        _status: result.success ? 'success' : 'failed',
        _error_message: result.success ? null : (result.message ?? 'Connection failed'),
      });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-biometric-readers'] });
      queryClient.invalidateQueries({ queryKey: ['admin-biometric-sync-logs'] });
    },
  });
}

/**
 * No vendor-specific biometric SDK is available in this environment, so
 * "Sync" performs the same reachability probe as Test and logs a
 * 'sync_completed'/'sync_failed' event -- it does not actually pull real
 * punch data from the device. Wiring a real device protocol is out of
 * scope here; the log/status plumbing (this function, the table, the UI)
 * is ready for whichever integration is added later to call
 * record_biometric_sync_event() with real records_synced counts.
 */
export function useSyncBiometricReader() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (readerId: string) => {
      const { data: reader, error: readerError } = await supabase.from('biometric_readers').select('ip_address, port').eq('id', readerId).single();
      if (readerError) throw readerError;

      const { data, error } = await supabase.functions.invoke('biometric-reader-action', {
        body: { ipAddress: reader.ip_address, port: reader.port },
      });
      if (error) throw error;
      const result = data as { success: boolean; message?: string };

      await supabase.rpc('record_biometric_sync_event', {
        _reader_id: readerId,
        _event_type: result.success ? 'sync_completed' : 'sync_failed',
        _status: result.success ? 'success' : 'failed',
        _records_synced: result.success ? 0 : null,
        _error_message: result.success ? null : (result.message ?? 'Sync failed'),
      });
      return { success: result.success, recordsSynced: 0, message: result.message };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-biometric-readers'] });
      queryClient.invalidateQueries({ queryKey: ['admin-biometric-sync-logs'] });
    },
  });
}
