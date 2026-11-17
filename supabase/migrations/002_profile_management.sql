-- Locker Room migration 002: commissioner-managed profile fields.
-- Run in Supabase SQL Editor after migration 001.
-- Existing accounts and comments are preserved.

alter table public.league_members
  add column if not exists first_name text,
  add column if not exists team_name text;

alter table public.league_members
  add constraint first_name_length check (
    first_name is null or char_length(trim(first_name)) between 1 and 50
  );

alter table public.league_members
  add constraint team_name_length check (
    team_name is null or char_length(trim(team_name)) between 1 and 50
  );

-- Commissioner may edit roster metadata and active status.
-- RLS alone cannot restrict individual columns, so use column-level grants.
create policy "Commissioner can update member profiles"
on public.league_members for update to authenticated
using (public.is_commissioner())
with check (public.is_commissioner());

grant update (username, display_name, first_name, team_name, is_active)
  on public.league_members to authenticated;

-- Commissioner may inspect inactive profiles; regular members only active ones.
-- Passwords, email identities, and roles remain admin-only operations.
