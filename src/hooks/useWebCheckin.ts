import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { WebCheckinPunchType } from '@/lib/webCheckin';

export interface WebCheckinStatus {
  enabled: boolean;
  isWfhToday: boolean;
  attendanceDate: string;
  lastPunchType: WebCheckinPunchType | null;
  lastPunchTime: string | null;
  effectiveMinutes: number;
}

/** Everything the dashboard widget needs, in one round trip (0057). */
export function useWebCheckinStatus() {
  return useQuery({
    queryKey: ['web-checkin-status'],
    queryFn: async (): Promise<WebCheckinStatus> => {
      const { data, error } = await supabase.rpc('get_web_checkin_status').single();
      if (error) throw error;
      const row = data as any;
      return {
        enabled: row.web_checkin_enabled,
        isWfhToday: row.is_wfh_today,
        attendanceDate: row.attendance_date,
        lastPunchType: row.last_punch_type,
        lastPunchTime: row.last_punch_time,
        effectiveMinutes: row.effective_minutes,
      };
    },
  });
}

export function useWebCheckinPunch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (punchType: WebCheckinPunchType) => {
      const { error } = await supabase.rpc('web_checkin_punch', { _punch_type: punchType });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['web-checkin-status'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-range'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-day'] });
      queryClient.invalidateQueries({ queryKey: ['raw-punches'] });
    },
  });
}
