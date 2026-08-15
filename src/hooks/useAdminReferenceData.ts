import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { ORG_ID } from '@/lib/orgContext';

export interface ReferenceCrudConfig<TRow, TInput> {
  table: string;
  selectColumns: string;
  queryKey: string;
  orderBy?: { column: string; ascending?: boolean };
  mapRow: (raw: any) => TRow;
  /** Maps form input to snake_case columns, used for both insert and update. */
  toRow: (input: TInput) => Record<string, unknown>;
}

/**
 * Departments/Designations/Locations/Grades/Leave Types all share the same
 * fetch-all-in-org / insert / update / toggle-active shape — this factory
 * centralizes that data layer so each area only needs its own config object
 * instead of a near-duplicate hook file. Forms stay per-page since they
 * genuinely differ (FK selects, extra fields).
 */
export function createReferenceCrudHooks<TRow extends { id: string }, TInput>(config: ReferenceCrudConfig<TRow, TInput>) {
  function useList() {
    return useQuery({
      queryKey: [config.queryKey],
      queryFn: async (): Promise<TRow[]> => {
        let query = supabase.from(config.table).select(config.selectColumns).eq('organization_id', ORG_ID);
        if (config.orderBy) query = query.order(config.orderBy.column, { ascending: config.orderBy.ascending ?? true });
        const { data, error } = await query;
        if (error) throw error;
        return (data ?? []).map(config.mapRow);
      },
    });
  }

  function useCreate() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (input: TInput) => {
        const { error } = await supabase.from(config.table).insert({ ...config.toRow(input), organization_id: ORG_ID });
        if (error) throw error;
      },
      onSuccess: () => queryClient.invalidateQueries({ queryKey: [config.queryKey] }),
    });
  }

  function useUpdate() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async ({ id, input }: { id: string; input: TInput }) => {
        const { error } = await supabase.from(config.table).update(config.toRow(input)).eq('id', id);
        if (error) throw error;
      },
      onSuccess: () => queryClient.invalidateQueries({ queryKey: [config.queryKey] }),
    });
  }

  function useToggleActive() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
        const { error } = await supabase.from(config.table).update({ is_active: isActive }).eq('id', id);
        if (error) throw error;
      },
      onSuccess: () => queryClient.invalidateQueries({ queryKey: [config.queryKey] }),
    });
  }

  return { useList, useCreate, useUpdate, useToggleActive };
}
