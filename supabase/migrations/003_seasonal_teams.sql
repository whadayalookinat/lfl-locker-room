-- Loser's Locker Room migration 003 — seasonal team assignments
-- Run once after migration 002. Existing accounts/comments remain unchanged.
-- Each member may have one team per season; multiple members may share a team.
-- Assignments are keyed by permanent user_id, not editable usernames.

create table if not exists public.member_season_teams (
  user_id uuid not null references public.league_members(user_id) on delete cascade,
  season integer not null check (season between 2020 and 2100),
  team_name text not null check (char_length(trim(team_name)) between 1 and 50),
  created_at timestamptz not null default now(),
  primary key (user_id, season)
);

create index if not exists member_season_teams_season_idx
  on public.member_season_teams (season, team_name);

alter table public.member_season_teams enable row level security;

-- Active participants can read assignments for active members.
-- Commissioners can also see assignments belonging to inactive members.
create policy "Members can read season assignments"
on public.member_season_teams for select to authenticated
using (
  public.is_active_member()
  and exists (
    select 1 from public.league_members m
    where m.user_id = member_season_teams.user_id
      and (m.is_active or public.is_commissioner())
  )
);

create policy "Commissioners can add season assignments"
on public.member_season_teams for insert to authenticated
with check (public.is_commissioner());

create policy "Commissioners can edit season assignments"
on public.member_season_teams for update to authenticated
using (public.is_commissioner())
with check (public.is_commissioner());

create policy "Commissioners can remove season assignments"
on public.member_season_teams for delete to authenticated
using (public.is_commissioner());

revoke all on public.member_season_teams from anon, authenticated;
grant select, insert, update (team_name), delete
  on public.member_season_teams to authenticated;

-- No roster import occurs here. The commissioner will approve assignments
-- before they are inserted. Do not backfill from league_members.team_name:
-- that legacy field is not guaranteed to represent a particular season.
