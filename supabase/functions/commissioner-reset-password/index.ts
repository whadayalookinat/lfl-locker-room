// Commissioner-only password reset. Source-only pilot; not deployed.
// Do not return or log the password; share it with the member through a trusted channel.
import { createClient } from 'npm:@supabase/supabase-js@2';

const ORIGIN = 'https://whadayalookinat.github.io';
const cors = {
  'Access-Control-Allow-Origin': ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
};
function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return reply(405, { error: 'Method not allowed' });
  if (req.headers.get('origin') !== ORIGIN) return reply(403, { error: 'Origin not allowed' });

  const token = req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return reply(401, { error: 'Sign in required' });

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) return reply(500, { error: 'Server configuration incomplete' });

  const auth = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: identity, error: identityError } = await auth.auth.getUser(token);
  if (identityError || !identity.user) return reply(401, { error: 'Invalid session' });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: commissioner, error: commissionerError } = await admin.from('league_members')
    .select('is_active,is_commissioner').eq('user_id', identity.user.id).maybeSingle();
  if (commissionerError) return reply(500, { error: 'Unable to verify permissions' });
  if (!commissioner?.is_active || !commissioner.is_commissioner) {
    return reply(403, { error: 'Commissioner access required' });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return reply(400, { error: 'Invalid JSON' }); }
  const targetId = body.user_id;
  const newPassword = body.new_password;
  if (typeof targetId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId)) {
    return reply(400, { error: 'Valid participant account ID required' });
  }
  if (typeof newPassword !== 'string' || newPassword.length < 12 || newPassword.length > 128) {
    return reply(400, { error: 'Password must be 12–128 characters' });
  }
  if (targetId === identity.user.id) return reply(403, { error: 'Use a separate commissioner self-recovery process' });

  const { data: target, error: targetError } = await admin.from('league_members')
    .select('user_id,username,is_commissioner').eq('user_id', targetId).maybeSingle();
  if (targetError) return reply(500, { error: 'Unable to find participant' });
  if (!target) return reply(404, { error: 'Participant not found' });
  if (target.is_commissioner) return reply(403, { error: 'Cannot reset another commissioner here' });

  const { error: resetError } = await admin.auth.admin.updateUserById(target.user_id, { password: newPassword });
  if (resetError) return reply(500, { error: 'Password reset failed' });
  return reply(200, { username: target.username, reset: true });
});
