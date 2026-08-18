import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { ORG_ID } from '@/lib/orgContext';
import type { AdminEmailDeliveryLogRow, EmailDeliveryStatus } from '@/types/admin';

export interface EmailDeliveryLogFilters {
  templateKey?: string;
  status?: EmailDeliveryStatus;
  dateFrom?: string;
  dateTo?: string;
}

/** Capped at 500 rows, same pragmatic MVP limit as useAuditLogs -- no server-side pagination UI built for either yet. */
export function useEmailDeliveryLogs(filters: EmailDeliveryLogFilters) {
  return useQuery({
    queryKey: ['admin-email-delivery-logs', filters],
    queryFn: async (): Promise<AdminEmailDeliveryLogRow[]> => {
      let query = supabase
        .from('email_delivery_logs')
        .select('id, template_key, recipient_email, cc, bcc, subject, status, error_message, reference_id, attempt_count, sent_at, created_at')
        .eq('organization_id', ORG_ID)
        .order('created_at', { ascending: false })
        .limit(500);
      if (filters.templateKey) query = query.eq('template_key', filters.templateKey);
      if (filters.status) query = query.eq('status', filters.status);
      if (filters.dateFrom) query = query.gte('created_at', `${filters.dateFrom}T00:00:00`);
      if (filters.dateTo) query = query.lte('created_at', `${filters.dateTo}T23:59:59`);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        templateKey: r.template_key,
        recipientEmail: r.recipient_email,
        cc: r.cc ?? [],
        bcc: r.bcc ?? [],
        subject: r.subject,
        status: r.status,
        errorMessage: r.error_message,
        referenceId: r.reference_id,
        attemptCount: r.attempt_count,
        sentAt: r.sent_at,
        createdAt: r.created_at,
      }));
    },
  });
}
