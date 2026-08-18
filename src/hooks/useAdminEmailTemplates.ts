import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { ORG_ID } from '@/lib/orgContext';
import type { AdminEmailTemplateRow, EmailTemplateKey } from '@/types/admin';

const TEMPLATE_SELECT = 'id, template_key, name, subject, body, is_active, updated_at';

function mapTemplateRow(r: any): AdminEmailTemplateRow {
  return {
    id: r.id,
    templateKey: r.template_key,
    name: r.name,
    subject: r.subject,
    body: r.body,
    isActive: r.is_active,
    updatedAt: r.updated_at,
  };
}

export function useEmailTemplates() {
  return useQuery({
    queryKey: ['admin-email-templates'],
    queryFn: async (): Promise<AdminEmailTemplateRow[]> => {
      const { data, error } = await supabase
        .from('email_templates')
        .select(TEMPLATE_SELECT)
        .eq('organization_id', ORG_ID)
        .order('template_key');
      if (error) throw error;
      return (data ?? []).map(mapTemplateRow);
    },
  });
}

export interface EmailTemplateInput {
  templateKey: EmailTemplateKey;
  name: string;
  subject: string;
  body: string;
  isActive: boolean;
}

function toTemplateRow(input: EmailTemplateInput) {
  return {
    template_key: input.templateKey,
    name: input.name,
    subject: input.subject,
    body: input.body,
    is_active: input.isActive,
  };
}

export function useCreateEmailTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: EmailTemplateInput) => {
      const { error } = await supabase.from('email_templates').insert({ ...toTemplateRow(input), organization_id: ORG_ID });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-email-templates'] }),
  });
}

export function useUpdateEmailTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: EmailTemplateInput }) => {
      const { error } = await supabase.from('email_templates').update(toTemplateRow(input)).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-email-templates'] }),
  });
}

export function useToggleEmailTemplateActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase.from('email_templates').update({ is_active: isActive }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-email-templates'] }),
  });
}

/**
 * Goes through the exact same queue_templated_email() RPC every real send
 * uses (0047) -- a "test" send is not a separate code path, just a
 * recipient/variables the HR admin chose themselves. Only queues the
 * delivery-log row; actual SMTP dispatch happens in the
 * process-email-queue edge function (supabase/functions/), which this app
 * cannot invoke synchronously without that function being deployed.
 */
export function useSendTestEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ templateKey, recipientEmail, variables }: { templateKey: EmailTemplateKey; recipientEmail: string; variables: Record<string, string> }) => {
      const { data, error } = await supabase.rpc('queue_templated_email', {
        _template_key: templateKey,
        _recipient_email: recipientEmail,
        _variables: variables,
        _reference_id: 'test-send',
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-email-delivery-logs'] }),
  });
}
