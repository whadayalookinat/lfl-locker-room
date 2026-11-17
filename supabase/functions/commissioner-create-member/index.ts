// Commissioner-only account creation; deploy as Supabase Edge Function "commissioner-create-member".
// Secrets stay in Supabase Edge Functions environment, NEVER in GitHub Pages.
import { createClient } from 'npm:@supabase/supabase-js@2';
const ORIGIN = 'https://whadayalookinat.github.io';
const cors = {
  'Access-Control-Allow-Origin': ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
};
function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return reply(405, { error: 'Method not allowed' });
  if (req.headers.get('origin') !== ORIGIN) return reply(403, { error: 'Origin not allowed' });
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return reply(401, { error: 'Sign in required' });
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) return reply(500, { error: 'Server configuration incomplete' });
  const authClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) return reply(401, { error: 'Invalid session' });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: commissioner, error: roleError } = await admin.from('league_members')
    .select('is_active,is_commissioner').eq('user_id', authData.user.id).maybeSingle();
  if (roleError) return reply(500, { error: 'Could not verify permissions' });
  if (!commissioner?.is_active || !commissioner.is_commissioner) return reply(403, { error: 'Commissioner access required' });
  let payload: Record<string, unknown>;
  try { payload = await req.json(); } catch { return reply(400, { error: 'Invalid JSON' }); }
  const username = String(payload.username ?? '').trim().toLowerCase();
  const displayName = String(payload.display_name ?? '').trim();
  const firstName = String(payload.first_name ?? '').trim();
  const email = String(payload.email ?? '').trim().toLowerCase();
  const password = String(payload.password ?? '');
  if (!/^[a-z0-9_]{3,30}$/.test(username)) return reply(400, { error: 'Username must be 3–30 lowercase letters, numbers or underscores' });
  if (!displayName || displayName.length > 50 || firstName.length > 50) return reply(400, { error: 'Invalid display name or first name' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return reply(400, { error: 'Valid email required for this pilot' });
  if (password.length < 12 || password.length > 128) return reply(400, { error: 'Password must be 12–128 characters' });
  const { data: existing, error: lookupError } = await admin.from('league_members').select('user_id').eq('username', username).maybeSingle();
  if (lookupError) return reply(500, { error: 'Unable to check username' });
  if (existing) return reply(409, { error: 'Username already exists' });
  const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (createError || !created.user) return reply(400, { error: 'Account creation failed: check email uniqueness and password policy' });
  const { error: profileError } = await admin.from('league_members').insert({
    user_id: created.user.id, username, display_name: displayName,
    first_name: firstName || null, is_active: true, is_commissioner: false,
  });
  if (profileError) {
    // Best-effort compensation: never intentionally leave an approved profile without Auth.
    const { error: rollbackError } = await admin.auth.admin.deleteUser(created.user.id);
    return reply(500, { error: rollbackError ? 'Profile failed; manual Auth cleanup required' : 'Profile creation failed; Auth account rolled back' });
  }
  return reply(201, { username, display_name: displayName, user_id: created.user.id });
});
