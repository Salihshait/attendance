import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { ORG_ID } from '@/lib/orgContext';
import type { ParsedHolidayRow } from '@/lib/csvImport';
import type { AdminHolidayRow } from '@/types/admin';

type NameJoin = { name: string } | null;

export function useHolidaysAdmin() {
  return useQuery({
    queryKey: ['admin-holidays'],
    queryFn: async (): Promise<AdminHolidayRow[]> => {
      const { data, error } = await supabase
        .from('holidays')
        .select('id, holiday_date, name, holiday_type, description, location_id, location:locations(name)')
        .eq('organization_id', ORG_ID)
        .order('holiday_date');
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        holidayDate: r.holiday_date,
        name: r.name,
        holidayType: r.holiday_type,
        locationId: r.location_id,
        locationName: (r.location as unknown as NameJoin)?.name ?? null,
        description: r.description,
      }));
    },
  });
}

export interface HolidayInput {
  holidayDate: string;
  name: string;
  holidayType: 'public' | 'restricted' | 'optional';
  locationId: string | null;
  description: string | null;
}

function toHolidayRow(input: HolidayInput) {
  return {
    holiday_date: input.holidayDate,
    name: input.name,
    holiday_type: input.holidayType,
    location_id: input.locationId,
    description: input.description,
  };
}

export function useCreateHoliday() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: HolidayInput) => {
      const { error } = await supabase.from('holidays').insert({ ...toHolidayRow(input), organization_id: ORG_ID });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-holidays'] }),
  });
}

export function useUpdateHoliday() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: HolidayInput }) => {
      const { error } = await supabase.from('holidays').update(toHolidayRow(input)).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-holidays'] }),
  });
}

export function useDeleteHoliday() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('holidays').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-holidays'] }),
  });
}

export function useBulkImportHolidays() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (rows: ParsedHolidayRow[]) => {
      const payload = rows.map((r) => ({
        organization_id: ORG_ID,
        holiday_date: r.date,
        name: r.name,
        holiday_type: r.holidayType,
        location_id: r.locationId,
        description: null,
      }));
      const { error } = await supabase.from('holidays').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-holidays'] }),
  });
}
