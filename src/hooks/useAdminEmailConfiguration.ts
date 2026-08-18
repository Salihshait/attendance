import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { ORG_ID } from '@/lib/orgContext';
import type { AdminEmailConfiguration } from '@/types/admin';

/** Never selects password_encrypted -- the UI shows only hasPassword (a generated boolean column), never the ciphertext, let alone the plaintext. */
export function useEmailConfiguration() {
  return useQuery({
    queryKey: ['admin-email-configuration'],
    queryFn: async (): Promise<AdminEmailConfiguration | null> => {
      const { data, error } = await supabase
        .from('email_configuration')
        .select('host, port, encryption, username, has_password, from_name, from_email, reply_to, is_active, updated_at')
        .eq('organization_id', ORG_ID)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        host: data.host,
        port: data.port,
        encryption: data.encryption,
        username: data.username,
        hasPassword: data.has_password,
        fromName: data.from_name,
        fromEmail: data.from_email,
        replyTo: data.reply_to,
        isActive: data.is_active,
        updatedAt: data.updated_at,
      };
    },
  });
}

export interface EmailConfigurationInput {
  host: string;
  port: number;
  encryption: 'none' | 'tls' | 'ssl';
  username: string;
  fromName: string;
  fromEmail: string;
  replyTo: string;
  isActive: boolean;
  /** Blank/undefined keeps the existing stored secret -- see set_email_configuration()'s comment. */
  password?: string;
}

/** Only entry point for writing SMTP config -- password is encrypted server-side (pgcrypto) inside set_email_configuration(), never sent as a plain column update from this client. */
export function useSaveEmailConfiguration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: EmailConfigurationInput) => {
      const { error } = await supabase.rpc('set_email_configuration', {
        _host: input.host,
        _port: input.port,
        _encryption: input.encryption,
        _username: input.username,
        _from_name: input.fromName,
        _from_email: input.fromEmail,
        _reply_to: input.replyTo,
        _is_active: input.isActive,
        _password: input.password || null,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-email-configuration'] }),
  });
}

/** Both go through the same edge function used for real sends (process-email-queue's sibling) -- see that migration/function's notes: not deployed/tested from this session. */
export function useTestSmtpConnection() {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('test-email-connection', { body: { mode: 'test_connection' } });
      if (error) throw error;
      return data as { success: boolean; message?: string };
    },
  });
}

export function useSendTestSmtpEmail() {
  return useMutation({
    mutationFn: async (recipientEmail: string) => {
      const { data, error } = await supabase.functions.invoke('test-email-connection', {
        body: { mode: 'send_test_email', recipientEmail },
      });
      if (error) throw error;
      return data as { success: boolean; message?: string };
    },
  });
}
