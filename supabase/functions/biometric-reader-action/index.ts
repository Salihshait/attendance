// Stateless TCP reachability probe for a biometric reader's IP:port.
// Deliberately does NOT touch the database or speak any vendor-specific
// biometric protocol -- no such SDK is available in this environment. The
// caller (src/hooks/useAdminBiometricReaders.ts, running as an
// already-authenticated HR admin) records the outcome via
// record_biometric_sync_event() itself, using its own session, so this
// function needs no privileged Supabase client or auth handling at all.
//
// NOT YET DEPLOYED OR LIVE-TESTED from this session. Deploy with:
//   supabase functions deploy biometric-reader-action

const CONNECT_TIMEOUT_MS = 5000;

Deno.serve(async (req) => {
  let body: { ipAddress?: string; port?: number };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ success: false, message: 'Invalid JSON body' }), { status: 400, headers: { 'content-type': 'application/json' } });
  }

  const { ipAddress, port } = body;
  if (!ipAddress || !port) {
    return new Response(JSON.stringify({ success: false, message: 'ipAddress and port are required' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  try {
    const connectPromise = Deno.connect({ hostname: ipAddress, port });
    const timeoutPromise = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), CONNECT_TIMEOUT_MS));
    const conn = await Promise.race([connectPromise, timeoutPromise]);
    conn.close();
    return new Response(JSON.stringify({ success: true, message: `Reachable at ${ipAddress}:${port}` }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, message: err instanceof Error ? err.message : String(err) }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }
});
