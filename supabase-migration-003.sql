-- ProfitRig migration 003: driver contact + segmentation profile.
-- Run this once in: Supabase Dashboard -> SQL Editor -> New Query -> Run.
-- Safe to re-run.

create table if not exists public.driver_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  first_name text,
  last_name text,
  phone text,
  company_name text,
  domicile_city text,
  domicile_state text,
  carrier_name text,
  authority_type text,
  trailer_type text,
  marketing_opt_in boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.driver_profiles enable row level security;

drop policy if exists "Owners can view own driver profile" on public.driver_profiles;
create policy "Owners can view own driver profile"
  on public.driver_profiles for select
  using (auth.uid() = user_id);

drop policy if exists "Owners can insert own driver profile" on public.driver_profiles;
create policy "Owners can insert own driver profile"
  on public.driver_profiles for insert
  with check (auth.uid() = user_id);

drop policy if exists "Owners can update own driver profile" on public.driver_profiles;
create policy "Owners can update own driver profile"
  on public.driver_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
