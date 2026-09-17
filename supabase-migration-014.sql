-- Migration 014: Fuel tab, and carriers on saved snapshots
--
-- 1. rigs — the driver's truck (one per driver): make, model, year, engine,
--    transmission, and the odometer reading they started tracking from.
-- 2. fuel_logs — a weekly odometer reading and the gallons bought since the
--    last one. The Fuel tab turns these into real miles per gallon. Connected
--    to nothing else in the app.
-- 3. cost_profile_snapshots.carrier_name / carrier_pct — the carrier and split
--    in effect when a snapshot is saved. Snapshot history now lives at the
--    bottom of Profile and doubles as a record of who the driver drove for.
--    carrier_pct 0 means independent; NULL on older snapshots means unknown.
--
-- Run this in the Supabase SQL editor BEFORE deploying the code.

create table if not exists public.rigs (
  user_id uuid primary key references auth.users (id) on delete cascade,
  make text,
  model text,
  year integer check (year is null or year between 1950 and 2100),
  engine text,
  transmission text check (transmission is null or transmission in ('automatic', 'manual')),
  starting_odometer numeric(10, 1) check (starting_odometer is null or starting_odometer >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.rigs enable row level security;

drop policy if exists "rigs_select_own" on public.rigs;
create policy "rigs_select_own"
  on public.rigs for select
  using (auth.uid() = user_id);

drop policy if exists "rigs_insert_own" on public.rigs;
create policy "rigs_insert_own"
  on public.rigs for insert
  with check (auth.uid() = user_id);

drop policy if exists "rigs_update_own" on public.rigs;
create policy "rigs_update_own"
  on public.rigs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.fuel_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  logged_on date not null,
  odometer numeric(10, 1) not null check (odometer >= 0),
  gallons numeric(8, 2) not null check (gallons > 0),
  created_at timestamptz not null default now()
);

create index if not exists fuel_logs_user_odometer_idx
  on public.fuel_logs (user_id, odometer desc);

alter table public.fuel_logs enable row level security;

drop policy if exists "fuel_logs_select_own" on public.fuel_logs;
create policy "fuel_logs_select_own"
  on public.fuel_logs for select
  using (auth.uid() = user_id);

drop policy if exists "fuel_logs_insert_own" on public.fuel_logs;
create policy "fuel_logs_insert_own"
  on public.fuel_logs for insert
  with check (auth.uid() = user_id);

drop policy if exists "fuel_logs_delete_own" on public.fuel_logs;
create policy "fuel_logs_delete_own"
  on public.fuel_logs for delete
  using (auth.uid() = user_id);

alter table public.cost_profile_snapshots
  add column if not exists carrier_name text;

alter table public.cost_profile_snapshots
  add column if not exists carrier_pct numeric(5, 2);

alter table public.cost_profile_snapshots
  drop constraint if exists cost_profile_snapshots_carrier_pct_check;

alter table public.cost_profile_snapshots
  add constraint cost_profile_snapshots_carrier_pct_check
  check (carrier_pct is null or (carrier_pct >= 0 and carrier_pct < 100));
