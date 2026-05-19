-- ProfitRig — Supabase setup
-- Paste this entire file into:
--   Supabase Dashboard  ->  SQL Editor  ->  New Query  ->  Run.
-- Safe to re-run.

create table if not exists public.cost_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,

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
  owner_operator_rate_per_mile numeric not null default 0,
  tolls_misc_per_mile numeric not null default 0,

  desired_profit_per_mile numeric not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cost_profiles enable row level security;

drop policy if exists "Owners can view own profile" on public.cost_profiles;
create policy "Owners can view own profile"
  on public.cost_profiles for select
  using (auth.uid() = user_id);

drop policy if exists "Owners can insert own profile" on public.cost_profiles;
create policy "Owners can insert own profile"
  on public.cost_profiles for insert
  with check (auth.uid() = user_id);

drop policy if exists "Owners can update own profile" on public.cost_profiles;
create policy "Owners can update own profile"
  on public.cost_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Owners can delete own profile" on public.cost_profiles;
create policy "Owners can delete own profile"
  on public.cost_profiles for delete
  using (auth.uid() = user_id);
