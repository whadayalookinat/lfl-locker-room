-- Migration 005: server-side failed-login counters and timed lockouts.
-- Apply in Supabase SQL Editor BEFORE deploying the username-login function.
-- Only service_role can execute these routines. No browser table access.
create table if not exists public.member_login_limits (
  user_id uuid primary key references public.league_members(user_id) on delete cascade,
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.member_login_limits enable row level security;
revoke all on public.member_login_limits from public, anon, authenticated;

create or replace function public.login_limit_status(p_user_id uuid)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql security definer set search_path = ''
as $$
declare v_until timestamptz; v_commissioner boolean;
begin
  select m.is_commissioner into v_commissioner
  from public.league_members m where m.user_id = p_user_id;
  -- Commissioner accounts are exempt from username-based account lockout.
  -- Supabase Auth's own protections still apply; add IP throttling before launch.
  if coalesce(v_commissioner,false) then
    return query select true, 0; return;
  end if;
  select l.locked_until into v_until from public.member_login_limits l where l.user_id=p_user_id;
  if v_until is not null and v_until > now() then
    return query select false, greatest(1,ceil(extract(epoch from v_until-now()))::integer);
  else
    return query select true, 0;
  end if;
end $$;

create or replace function public.record_login_failure(p_user_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  -- Never lock the commissioner account through username-based failures.
  if exists(select 1 from public.league_members where user_id=p_user_id and is_commissioner) then return; end if;
  insert into public.member_login_limits as l (user_id, failed_attempts, locked_until, updated_at)
  values (p_user_id, 1, null, now())
  on conflict (user_id) do update
  set failed_attempts = case
      when l.locked_until is not null and l.locked_until <= now() then 1
      else l.failed_attempts + 1 end,
      locked_until = case
      when l.locked_until is not null and l.locked_until > now() then l.locked_until
      when (case when l.locked_until is not null and l.locked_until <= now() then 1 else l.failed_attempts+1 end) >= 10
        then now()+interval '30 minutes'
      else null end,
      updated_at=now();
end $$;

create or replace function public.clear_login_failures(p_user_id uuid)
returns void language sql security definer set search_path = ''
as $$
  delete from public.member_login_limits where user_id=p_user_id;
$$;

revoke all on function public.login_limit_status(uuid) from public, anon, authenticated;
revoke all on function public.record_login_failure(uuid) from public, anon, authenticated;
revoke all on function public.clear_login_failures(uuid) from public, anon, authenticated;
grant execute on function public.login_limit_status(uuid) to service_role;
grant execute on function public.record_login_failure(uuid) to service_role;
grant execute on function public.clear_login_failures(uuid) to service_role;
