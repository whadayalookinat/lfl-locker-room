-- Migration 006: atomic username-login request admission.
-- Run AFTER migration 005. No existing members, comments, or passwords changed.
-- A per-username reservation serializes Auth checks; a rolling fixed window
-- throttles both real and nonexistent usernames without trusting client IPs.
create table if not exists public.username_login_gate (
  username text primary key,
  window_started_at timestamptz not null default now(),
  window_count integer not null default 0,
  reservation_id uuid,
  reserved_until timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.username_login_gate enable row level security;
revoke all on public.username_login_gate from public, anon, authenticated;

create or replace function public.reserve_username_login(p_username text, p_reservation uuid)
returns table (admitted boolean, reason text)
language plpgsql security definer set search_path = ''
as $$
declare v_gate public.username_login_gate%rowtype;
begin
  if p_username !~ '^[a-z0-9_]{3,30}$' or p_reservation is null then
    return query select false, 'invalid'::text; return;
  end if;
  insert into public.username_login_gate(username) values (p_username)
    on conflict (username) do nothing;
  select * into v_gate from public.username_login_gate
    where username=p_username for update;
  -- Limit to 20 requests per five minutes per username, including unknown users.
  if v_gate.window_started_at > now()-interval '5 minutes' and v_gate.window_count >= 20 then
    return query select false, 'throttled'::text; return;
  end if;
  -- Only one authentication request per username at a time.
  -- Reservation expires after 60 seconds if an Edge Function crashes.
  if v_gate.reservation_id is not null and v_gate.reserved_until > now() then
    return query select false, 'busy'::text; return;
  end if;
  update public.username_login_gate
  set window_started_at = case when window_started_at <= now()-interval '5 minutes'
       then now() else window_started_at end,
      window_count = case when window_started_at <= now()-interval '5 minutes'
       then 1 else window_count+1 end,
      reservation_id=p_reservation,
      reserved_until=now()+interval '60 seconds',
      updated_at=now()
  where username=p_username;
  return query select true, 'admitted'::text;
end $$;

create or replace function public.release_username_login(p_username text, p_reservation uuid)
returns void language sql security definer set search_path = ''
as $$
  update public.username_login_gate
  set reservation_id=null, reserved_until=null, updated_at=now()
  where username=p_username and reservation_id=p_reservation;
$$;

revoke all on function public.reserve_username_login(text,uuid) from public, anon, authenticated;
revoke all on function public.release_username_login(text,uuid) from public, anon, authenticated;
grant execute on function public.reserve_username_login(text,uuid) to service_role;
grant execute on function public.release_username_login(text,uuid) to service_role;
