import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { ORG_ID } from '@/lib/orgContext';

// system_settings is unused anywhere else in the app today — this key set
// and their defaults are invented from scratch for this module, not a
// pre-existing convention.
export interface SystemSettingsValues {
  companyName: string;
  defaultTimezone: string;
  weekendDays: number[];
  leaveYearStartMonth: number;
  sessionTimeoutMinutes: number;
}

export const SYSTEM_SETTINGS_DEFAULTS: SystemSettingsValues = {
  companyName: 'Wallet HR',
  defaultTimezone: 'Asia/Kolkata',
  weekendDays: [0, 6],
  leaveYearStartMonth: 1,
  sessionTimeoutMinutes: 30,
};

const KEY_MAP: Record<keyof SystemSettingsValues, string> = {
  companyName: 'company_name',
  defaultTimezone: 'default_timezone',
  weekendDays: 'weekend_days',
  leaveYearStartMonth: 'leave_year_start_month',
  sessionTimeoutMinutes: 'session_timeout_minutes',
};

export function useSystemSettings() {
  return useQuery({
    queryKey: ['admin-system-settings'],
    queryFn: async (): Promise<SystemSettingsValues> => {
      const { data, error } = await supabase.from('system_settings').select('setting_key, setting_value').eq('organization_id', ORG_ID);
      if (error) throw error;
      const byKey = new Map((data ?? []).map((r) => [r.setting_key, r.setting_value]));

      const values = { ...SYSTEM_SETTINGS_DEFAULTS };
      for (const key of Object.keys(KEY_MAP) as (keyof SystemSettingsValues)[]) {
        const stored = byKey.get(KEY_MAP[key]);
        if (stored !== undefined) (values as any)[key] = stored;
      }
      return values;
    },
  });
}

export function useUpsertSystemSetting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, value }: { key: keyof SystemSettingsValues; value: unknown }) => {
      const { error } = await supabase
        .from('system_settings')
        .upsert({ organization_id: ORG_ID, setting_key: KEY_MAP[key], setting_value: value }, { onConflict: 'organization_id,setting_key' });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-system-settings'] }),
  });
}
