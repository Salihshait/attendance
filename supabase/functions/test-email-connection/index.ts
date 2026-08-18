// Interactive "Test Connection" / "Send Test Email" for the Email
// Configuration admin page. Unlike process-email-queue (a scheduled
// worker), this is invoked directly by an HR admin's browser session, so it
// must verify the CALLER is actually hr_admin/super_admin (using a
// Supabase client scoped to their own JWT) before switching to a
// service-role client to call get_smtp_credentials() -- the only function
// allowed to decrypt the stored SMTP password (supabase/migrations/0048).
//
// NOT YET DEPLOYED OR LIVE-TESTED from this session. Deploy with:
//   supabase functions deploy test-email-connection

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SmtpClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

interface RequestBody {
  mode: 'test_connection' | 'send_test_email';
  recipientEmail?: string;
}

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authHeader = req.headers.get('Authorization');

  if (!supabaseUrl || !serviceRoleKey || !authHeader) {
    return new Response(JSON.stringify({ success: false, message: 'Missing required environment/auth configuration.' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }

  // Scoped to the CALLER's own JWT -- respects RLS/is_hr_or_admin() exactly
  // as the browser session would, so an unauthorized caller is rejected
  // before any privileged credential ever gets read.
  const callerClient = createClient(supabaseUrl, serviceRoleKey, { global: { headers: { Authorization: authHeader } } });
  const { data: authCheck, error: authCheckError } = await callerClient.rpc('is_hr_or_admin');
  if (authCheckError || !authCheck) {
    return new Response(JSON.stringify({ success: false, message: 'Not authorized.' }), { status: 403, headers: { 'content-type': 'application/json' } });
  }

  const { data: orgRow, error: orgError } = await callerClient.rpc('current_organization_id');
  if (orgError || !orgRow) {
    return new Response(JSON.stringify({ success: false, message: 'Could not resolve organization.' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ success: false, message: 'Invalid JSON body' }), { status: 400, headers: { 'content-type': 'application/json' } });
  }

  // Service-role client only for the one call that actually needs it --
  // get_smtp_credentials() is granted exclusively to service_role (0048),
  // so even this function's caller-scoped client above could never call it.
  const serviceClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: creds, error: credsError } = await serviceClient.rpc('get_smtp_credentials', { _organization_id: orgRow }).single();
  if (credsError || !creds || !creds.host || !creds.username || !creds.password) {
    return new Response(JSON.stringify({ success: false, message: 'SMTP is not fully configured.' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }

  const smtp = new SmtpClient();
  try {
    await smtp.connect({ hostname: creds.host, port: creds.port ?? 587, username: creds.username, password: creds.password });

    if (body.mode === 'send_test_email') {
      if (!body.recipientEmail) {
        return new Response(JSON.stringify({ success: false, message: 'recipientEmail is required for send_test_email' }), {
          status: 400,
          headers: { 'content-type': 'application/json' },
        });
      }
      await smtp.send({
        from: `${creds.from_name ?? 'Wallet HR'} <${creds.from_email ?? creds.username}>`,
        to: body.recipientEmail,
        subject: 'Wallet HR — Test Email',
        content: 'This is a test email from your Wallet HR Email Configuration.',
        html: '<p>This is a test email from your Wallet HR Email Configuration.</p>',
      });
    }

    return new Response(JSON.stringify({ success: true, message: body.mode === 'send_test_email' ? 'Test email sent.' : 'Connection successful.' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, message: err instanceof Error ? err.message : String(err) }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } finally {
    try {
      await smtp.close();
    } catch {
      // already closed / never connected
    }
  }
});
