-- ProfitRig migration 009: Phase 1 — Tax Pack.
-- Five new tables, all entirely separate from the management/cost_profile
-- world. The Tax Pack reads exclusively from these tables + the existing
-- load.fuel_actual/tolls_actual/lumpers_actual fields and load revenue.
-- It NEVER reads driver_pay_per_mile, maintenance_per_mile, tires_per_mile,
-- def_per_mile, monthly_miles, allocated fixed-cost numbers, or
-- real_cpm_override.
--
-- Safe to re-run.

-- 1.1 TAX PROFILE — one row per user with entity + financing.
create table if not exists public.tax_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  entity_type text,            -- 'sole_prop' | 'smllc' | 's_corp' | null
  has_hired_driver boolean not null default false,
  truck_financing text,        -- 'owned_financed' | 'owned_outright' | 'leased' | null
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.tax_profiles enable row level security;

drop policy if exists "Owners can view own tax profile" on public.tax_profiles;
create policy "Owners can view own tax profile"
  on public.tax_profiles for select
  using (auth.uid() = user_id);

drop policy if exists "Owners can insert own tax profile" on public.tax_profiles;
create policy "Owners can insert own tax profile"
  on public.tax_profiles for insert
  with check (auth.uid() = user_id);

drop policy if exists "Owners can update own tax profile" on public.tax_profiles;
create policy "Owners can update own tax profile"
  on public.tax_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 1.4 NON-LOAD BUSINESS EXPENSES — actuals only, categorized to Schedule C.
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  expense_date date not null,
  category text not null,
  amount numeric not null check (amount >= 0),
  vendor text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists expenses_user_date_idx
  on public.expenses (user_id, expense_date desc);
alter table public.expenses enable row level security;

drop policy if exists "Owners can view own expenses" on public.expenses;
create policy "Owners can view own expenses"
  on public.expenses for select
  using (auth.uid() = user_id);

drop policy if exists "Owners can insert own expenses" on public.expenses;
create policy "Owners can insert own expenses"
  on public.expenses for insert
  with check (auth.uid() = user_id);

drop policy if exists "Owners can update own expenses" on public.expenses;
create policy "Owners can update own expenses"
  on public.expenses for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Owners can delete own expenses" on public.expenses;
create policy "Owners can delete own expenses"
  on public.expenses for delete
  using (auth.uid() = user_id);

-- 1.6 CAPITAL ASSETS — never aggregated into expense totals. CPA depreciates.
create table if not exists public.capital_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  description text not null,
  placed_in_service date not null,
  cost numeric not null check (cost >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists capital_assets_user_date_idx
  on public.capital_assets (user_id, placed_in_service desc);
alter table public.capital_assets enable row level security;

drop policy if exists "Owners can view own assets" on public.capital_assets;
create policy "Owners can view own assets"
  on public.capital_assets for select
  using (auth.uid() = user_id);

drop policy if exists "Owners can insert own assets" on public.capital_assets;
create policy "Owners can insert own assets"
  on public.capital_assets for insert
  with check (auth.uid() = user_id);

drop policy if exists "Owners can update own assets" on public.capital_assets;
create policy "Owners can update own assets"
  on public.capital_assets for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Owners can delete own assets" on public.capital_assets;
create policy "Owners can delete own assets"
  on public.capital_assets for delete
  using (auth.uid() = user_id);

-- 1.5 PER-DIEM RATES — global config with effective dates. Rates change
-- every Oct 1 with the IRS Notice. Anyone signed in can read; writes only
-- via service_role (admin updates from a future Notice).
create table if not exists public.per_diem_rates (
  id uuid primary key default gen_random_uuid(),
  effective_date date not null unique,
  conus_rate numeric not null,
  ooc_rate numeric not null,
  notice text,
  created_at timestamptz not null default now()
);
alter table public.per_diem_rates enable row level security;

drop policy if exists "Anyone can view per_diem_rates" on public.per_diem_rates;
create policy "Anyone can view per_diem_rates"
  on public.per_diem_rates for select
  using (true);

-- Seed the rates needed for tax years 2024 and 2025+.
-- - Notice 2023-68 (eff Oct 1, 2023): $69 CONUS / $74 OOC — covers Jan 1–Sep 30, 2024
-- - Notice 2024-68 (eff Oct 1, 2024): $80 CONUS / $86 OOC — covers Oct 1, 2024 onward
-- - Notice 2025-54 (eff Oct 1, 2025): $80 CONUS / $86 OOC — kept the bump from FY24-25
insert into public.per_diem_rates (effective_date, conus_rate, ooc_rate, notice)
values
  ('2023-10-01', 69, 74, 'IRS Notice 2023-68'),
  ('2024-10-01', 80, 86, 'IRS Notice 2024-68'),
  ('2025-10-01', 80, 86, 'IRS Notice 2025-54')
on conflict (effective_date) do nothing;

-- 1.5 PER-DIEM SUMMARY — nights away per user per tax year, split into two
-- periods so the rate change on Oct 1 of each tax year can be applied
-- correctly. period_a covers Jan 1 - Sep 30 of tax_year (rate that was
-- effective the prior Oct 1); period_b covers Oct 1 - Dec 31 (current Oct 1).
create table if not exists public.per_diem_summary (
  user_id uuid not null references auth.users (id) on delete cascade,
  tax_year integer not null,
  period_a_nights numeric not null default 0,
  period_b_nights numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, tax_year)
);
alter table public.per_diem_summary enable row level security;

drop policy if exists "Owners can view own per_diem_summary" on public.per_diem_summary;
create policy "Owners can view own per_diem_summary"
  on public.per_diem_summary for select
  using (auth.uid() = user_id);

drop policy if exists "Owners can insert own per_diem_summary" on public.per_diem_summary;
create policy "Owners can insert own per_diem_summary"
  on public.per_diem_summary for insert
  with check (auth.uid() = user_id);

drop policy if exists "Owners can update own per_diem_summary" on public.per_diem_summary;
create policy "Owners can update own per_diem_summary"
  on public.per_diem_summary for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
