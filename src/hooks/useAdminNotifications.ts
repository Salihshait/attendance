import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { ORG_ID } from '@/lib/orgContext';
import type { AdminNotificationRow } from '@/types/admin';

export function useSentAnnouncements() {
  return useQuery({
    queryKey: ['admin-sent-announcements'],
    queryFn: async (): Promise<AdminNotificationRow[]> => {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, title, body, link_path, created_at, recipient_user_id')
        .eq('organization_id', ORG_ID)
        .eq('notification_type', 'system_announcement')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const rows = data ?? [];

      const recipientIds = Array.from(new Set(rows.map((r) => r.recipient_user_id)));
      const nameByUserId = new Map<string, string>();
      if (recipientIds.length > 0) {
        const { data: employees, error: employeesError } = await supabase
          .from('employees')
          .select('user_id, first_name, last_name')
          .in('user_id', recipientIds);
        if (employeesError) throw employeesError;
        for (const e of employees ?? []) {
          if (e.user_id) nameByUserId.set(e.user_id, [e.first_name, e.last_name].filter(Boolean).join(' '));
        }
      }

      return rows.map((r) => ({
        id: r.id,
        title: r.title,
        body: r.body,
        linkPath: r.link_path,
        createdAt: r.created_at,
        recipientUserId: r.recipient_user_id,
        recipientName: nameByUserId.get(r.recipient_user_id) ?? '-',
      }));
    },
  });
}

export interface ComposeNotificationInput {
  title: string;
  body: string | null;
  linkPath: string | null;
  recipientUserIds: string[];
}

/**
 * notifications_insert RLS is already `is_hr_or_admin()` (unlike the
 * manager-approval flow, no RPC is needed to bypass a stricter policy).
 * Employees with no linked login (user_id = NULL) simply can't receive a
 * notification (recipient_user_id is NOT NULL, FK to auth.users) — the
 * caller is expected to have already filtered those out and report the
 * skipped count separately, rather than this mutation erroring on them.
 */
export function useComposeNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ComposeNotificationInput) => {
      if (input.recipientUserIds.length === 0) return;
      const rows = input.recipientUserIds.map((uid) => ({
        organization_id: ORG_ID,
        recipient_user_id: uid,
        notification_type: 'system_announcement' as const,
        title: input.title,
        body: input.body,
        link_path: input.linkPath,
      }));
      const { error } = await supabase.from('notifications').insert(rows);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-sent-announcements'] }),
  });
}
