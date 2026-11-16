-- Loser's Locker Room v0.2 — Migration 001
-- Run once in the Supabase SQL Editor, as the project administrator.
-- Does not create users, credentials, or comments.

create table if not exists public.league_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  display_name text not null,
  is_active boolean not null default true,
  is_commissioner boolean not null default false,
  created_at timestamptz not null default now(),
  constraint username_format check (username ~ '^[a-z0-9_]{3,30}$'),
  constraint display_name_length check (char_length(trim(display_name)) between 1 and 50)
);

create table if not exists public.comments (
  id bigint generated always as identity primary key,
  author_id uuid not null references public.league_members(user_id),
  season integer not null check (season between 2020 and 2100),
  week integer not null check (week between 1 and 18),
  body text not null check (char_length(trim(body)) between 1 and 280),
  created_at timestamptz not null default now()
);

create index if not exists comments_season_week_created_idx
  on public.comments (season, week, created_at, id);

alter table public.league_members enable row level security;
alter table public.comments enable row level security;

-- SECURITY DEFINER avoids circular member-policy checks.
-- Empty search_path ensures all referenced objects must be qualified.
create or replace function public.is_active_member()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.league_members
    where user_id = (select auth.uid()) and is_active
  );
$$;

create or replace function public.is_commissioner()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.league_members
    where user_id = (select auth.uid())
      and is_active and is_commissioner
  );
$$;

revoke all on function public.is_active_member() from public, anon;
revoke all on function public.is_commissioner() from public, anon;
grant execute on function public.is_active_member() to authenticated;
grant execute on function public.is_commissioner() to authenticated;

-- No client can create or modify league member records.
-- Active members can see active participants' display names;
-- commissioners can also inspect deactivated accounts.
create policy "Members can see league roster"
on public.league_members for select to authenticated
using (public.is_active_member() and (is_active or public.is_commissioner()));

create policy "Members can read comments"
on public.comments for select to authenticated
using (public.is_active_member());

create policy "Members can post as themselves"
on public.comments for insert to authenticated
with check (public.is_active_member() and author_id = (select auth.uid()));

create policy "Commissioner can delete comments"
on public.comments for delete to authenticated
using (public.is_commissioner());

-- Grant only the operations needed by the browser client.
revoke all on public.league_members from anon, authenticated;
revoke all on public.comments from anon, authenticated;
grant select on public.league_members to authenticated;
grant select, insert, delete on public.comments to authenticated;
grant usage, select on sequence public.comments_id_seq to authenticated;
