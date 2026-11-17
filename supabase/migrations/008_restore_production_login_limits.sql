-- Migration 008: Restore production lockout thresholds.
-- Apply in Supabase SQL Editor before inviting real league participants.
create or replace function public.record_login_failure(p_user_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
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
revoke all on function public.record_login_failure(uuid) from public, anon, authenticated;
grant execute on function public.record_login_failure(uuid) to service_role;
