// Outbound email worker for the centralized HR Email Notification Engine
// (supabase/migrations/0047_email_notification_engine.sql,
// src/lib/emailEngine.ts). This is the ONLY place SMTP credentials are ever
// read -- from this function's own environment (`supabase secrets set`),
// never from the database or any UI, per the "never expose SMTP
// passwords/secrets in the UI" requirement.
//
// Drains public.email_delivery_logs rows with status in ('pending',
// 'retrying') whose next_retry_at has passed, sends each via SMTP, and
// updates the row (sent -> 'sent'/sent_at; failed -> 'retrying' with a
// backoff-scheduled next_retry_at, or permanently 'failed' once
// max_attempts is reached). The retry-backoff arithmetic mirrors
// src/lib/emailEngine.ts's decideRetry() -- kept in sync by hand, the same
// TS-mirrors-SQL convention used throughout this codebase, since Deno edge
// functions and the Vite app are separate runtimes/bundlers.
//
// NOT YET DEPLOYED OR LIVE-TESTED from this session (no Supabase project
// connection here). Deploy with:
//   supabase functions deploy process-email-queue
//   supabase secrets set SMTP_HOST=... SMTP_PORT=... SMTP_USERNAME=... \
//     SMTP_PASSWORD=... SMTP_FROM_EMAIL=... SMTP_FROM_NAME=...
// Then invoke it periodically (Supabase's own Scheduled Functions / an
// external cron hitting its URL with the project's service-role bearer
// token) to actually flush the queue -- the app's "Send Test Email" button
// invokes it directly for an immediate one-off send.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SmtpClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

const RETRY_BACKOFF_MINUTES = [5, 15, 60];
const MAX_ATTEMPTS = 3;
const BATCH_SIZE = 20;

interface PendingEmail {
  id: string;
  recipient_email: string;
  cc: string[] | null;
  bcc: string[] | null;
  subject: string | null;
  body: string | null;
  attempt_count: number;
  max_attempts: number;
}

/** Mirrors src/lib/emailEngine.ts's decideRetry(). attemptCount is the count AFTER this failed attempt. */
function decideRetry(attemptCount: number, maxAttempts: number, now = new Date()): { status: 'retrying' | 'failed'; nextRetryAt: string | null } {
  if (attemptCount >= maxAttempts) return { status: 'failed', nextRetryAt: null };
  const delayMinutes = RETRY_BACKOFF_MINUTES[Math.min(attemptCount - 1, RETRY_BACKOFF_MINUTES.length - 1)];
  return { status: 'retrying', nextRetryAt: new Date(now.getTime() + delayMinutes * 60_000).toISOString() };
}

async function sendOne(smtp: SmtpClient, fromEmail: string, fromName: string, email: PendingEmail): Promise<void> {
  await smtp.send({
    from: `${fromName} <${fromEmail}>`,
    to: email.recipient_email,
    cc: email.cc ?? undefined,
    bcc: email.bcc ?? undefined,
    subject: email.subject ?? '(no subject)',
    content: email.body ?? '',
    html: email.body ?? '',
  });
}

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const smtpHost = Deno.env.get('SMTP_HOST');
  const smtpPort = Number(Deno.env.get('SMTP_PORT') ?? '587');
  const smtpUsername = Deno.env.get('SMTP_USERNAME');
  const smtpPassword = Deno.env.get('SMTP_PASSWORD');
  const fromEmail = Deno.env.get('SMTP_FROM_EMAIL') ?? smtpUsername ?? '';
  const fromName = Deno.env.get('SMTP_FROM_NAME') ?? 'Wallet HR';

  if (!supabaseUrl || !serviceRoleKey || !smtpHost || !smtpUsername || !smtpPassword) {
    return new Response(JSON.stringify({ error: 'Missing required environment configuration (SUPABASE_URL/SERVICE_ROLE_KEY/SMTP_*).' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: pending, error: fetchError } = await supabase
    .from('email_delivery_logs')
    .select('id, recipient_email, cc, bcc, subject, body, attempt_count, max_attempts')
    .in('status', ['pending', 'retrying'])
    .or(`next_retry_at.is.null,next_retry_at.lte.${new Date().toISOString()}`)
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (fetchError) {
    return new Response(JSON.stringify({ error: fetchError.message }), { status: 500, headers: { 'content-type': 'application/json' } });
  }

  const results = { sent: 0, retrying: 0, failed: 0 };

  for (const email of (pending ?? []) as PendingEmail[]) {
    const smtp = new SmtpClient();
    try {
      await smtp.connect({ hostname: smtpHost, port: smtpPort, username: smtpUsername, password: smtpPassword });
      await sendOne(smtp, fromEmail, fromName, email);
      await supabase
        .from('email_delivery_logs')
        .update({ status: 'sent', sent_at: new Date().toISOString(), error_message: null })
        .eq('id', email.id);
      results.sent += 1;
    } catch (err) {
      const attemptCount = email.attempt_count + 1;
      const decision = decideRetry(attemptCount, email.max_attempts ?? MAX_ATTEMPTS);
      await supabase
        .from('email_delivery_logs')
        .update({
          status: decision.status,
          attempt_count: attemptCount,
          next_retry_at: decision.nextRetryAt,
          error_message: err instanceof Error ? err.message : String(err),
        })
        .eq('id', email.id);
      if (decision.status === 'retrying') results.retrying += 1;
      else results.failed += 1;
    } finally {
      try {
        await smtp.close();
      } catch {
        // already closed / never connected -- nothing to clean up
      }
    }
  }

  return new Response(JSON.stringify({ processed: (pending ?? []).length, ...results }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
});
