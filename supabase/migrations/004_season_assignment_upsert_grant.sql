-- Loser's Locker Room migration 004 — seasonal assignment upsert permission fix
-- Run after migration 003 on environments where the commissioner dashboard
-- reports "permission denied for table member_season_teams".
-- Already applied manually to the original Supabase project during QA.
--
-- PostgREST upsert needs table-level UPDATE privileges, not only UPDATE(team_name).
-- RLS still restricts updates to active commissioners.
grant update on public.member_season_teams to authenticated;
