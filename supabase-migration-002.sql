-- ProfitRig migration 002: rename driver-pay column + add snapshots table
-- Run this once in: Supabase Dashboard -> SQL Editor -> New Query -> Run.
-- Safe to re-run.

-- 1) Rename owner_operator_rate_per_mile -> driver_pay_per_mile (only if old column exists).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'cost_profiles'
      and column_name = 'owner_operator_rate_per_mile'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'cost_profiles'
      and column_name = 'driver_pay_per_mile'
  ) then
    alter table public.cost_profiles
      rename column owner_operator_rate_per_mile to driver_pay_per_mile;
  end if;
end$$;

-- Make sure column exists either way (fresh installs that skipped setup.sql).
alter table public.cost_profiles
  add column if not exists driver_pay_per_mile numeric not null default 0;

-- 2) Snapshots table: every Save appends one row here, keyed by user_id.
create table if not exists public.cost_profile_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  label text,

  truck_payment numeric not null default 0,
  trailer_payment numeric not null default 0,
  insurance numeric not null default 0,
  eld_subscriptions numeric not null default 0,
  permits_irp_ifta numeric not null default 0,
  office_misc numeric not null default 0,

  monthly_miles numeric not null default 0,

  mpg numeric not null default 0,
  fuel_price_per_gallon numeric not null default 0,
  maintenance_per_mile numeric not null default 0,
  tires_per_mile numeric not null default 0,
  def_per_mile numeric not null default 0,
  driver_pay_per_mile numeric not null default 0,
  tolls_misc_per_mile numeric not null default 0,

  desired_profit_per_mile numeric not null default 0,

  -- Stored for fast listing without recomputing on the client.
  total_cpm numeric not null default 0,
  required_rate numeric not null default 0,

  created_at timestamptz not null default now()
);

create index if not exists cost_profile_snapshots_user_id_created_at_idx
  on public.cost_profile_snapshots (user_id, created_at desc);

alter table public.cost_profile_snapshots enable row level security;

drop policy if exists "Owners can view own snapshots" on public.cost_profile_snapshots;
create policy "Owners can view own snapshots"
  on public.cost_profile_snapshots for select
  using (auth.uid() = user_id);

drop policy if exists "Owners can insert own snapshots" on public.cost_profile_snapshots;
create policy "Owners can insert own snapshots"
  on public.cost_profile_snapshots for insert
  with check (auth.uid() = user_id);

drop policy if exists "Owners can delete own snapshots" on public.cost_profile_snapshots;
create policy "Owners can delete own snapshots"
  on public.cost_profile_snapshots for delete
  using (auth.uid() = user_id);
