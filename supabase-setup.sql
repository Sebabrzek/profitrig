-- ProfitRig — Supabase setup (full schema, for fresh installs)
-- Paste this into: Supabase Dashboard -> SQL Editor -> New Query -> Run.
-- Safe to re-run. For an existing install moving from v1, also run
-- supabase-migration-002.sql.

-- Current cost profile per user (the form values they last saved).
create table if not exists public.cost_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,

  truck_payment numeric not null default 0,
  trailer_payment numeric not null default 0,
  insurance numeric not null default 0,
  eld_subscriptions numeric not null default 0,
  permits_irp_ifta numeric not null default 0,
  office_misc numeric not null default 0,
  load_board_per_month numeric not null default 0,
  other_monthly_bill numeric not null default 0,
  other_label text,

  monthly_miles numeric not null default 0,

  mpg numeric not null default 0,
  fuel_price_per_gallon numeric not null default 0,
  maintenance_per_mile numeric not null default 0,
  tires_per_mile numeric not null default 0,
  def_per_mile numeric not null default 0,
  driver_pay_per_mile numeric not null default 0,
  tolls_misc_per_mile numeric not null default 0,

  desired_profit_per_mile numeric not null default 0,

  -- Phase 0: user-tappable override of the computed totalCPM, set from the
  -- realCPM derived from their logged loads. NULL = no override.
  real_cpm_override numeric,

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

-- Dated snapshots: every Save also appends one row here so drivers can
-- review/restore old cost models (e.g. "Carrier XYZ — Jan 2026").
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
  load_board_per_month numeric not null default 0,
  other_monthly_bill numeric not null default 0,
  other_label text,

  monthly_miles numeric not null default 0,

  mpg numeric not null default 0,
  fuel_price_per_gallon numeric not null default 0,
  maintenance_per_mile numeric not null default 0,
  tires_per_mile numeric not null default 0,
  def_per_mile numeric not null default 0,
  driver_pay_per_mile numeric not null default 0,
  tolls_misc_per_mile numeric not null default 0,

  desired_profit_per_mile numeric not null default 0,

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

-- Driver contact + segmentation profile (used for personalization and, with
-- explicit opt-in, ProfitRig email campaigns).
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

-- In-app feedback inbox. Signed-in drivers can submit messages; admins read
-- them in the Supabase dashboard (or via service_role). Users cannot read
-- their own past feedback, which keeps the policy and UI dead simple.
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  message text not null check (length(trim(message)) > 0 and length(message) <= 5000),
  created_at timestamptz not null default now()
);

create index if not exists feedback_created_at_idx
  on public.feedback (created_at desc);

alter table public.feedback enable row level security;

drop policy if exists "Signed-in users can submit feedback" on public.feedback;
create policy "Signed-in users can submit feedback"
  on public.feedback for insert
  with check (auth.uid() = user_id);

-- Stage 2: weekly load profitability tracker. Each row is one load; fixed +
-- per-mile costs are derived from the user's saved cost_profile at display
-- time, so drivers only have to enter what's unique per load (miles, pay,
-- and optional actual receipts for fuel / tolls / lumpers).
create table if not exists public.loads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  load_date date not null,
  broker text,
  origin text,
  destination text,

  loaded_miles numeric not null default 0,
  deadhead_miles numeric not null default 0,

  linehaul_pay numeric not null default 0,
  fuel_surcharge numeric not null default 0,
  accessorials numeric not null default 0,

  fuel_actual numeric,
  tolls_actual numeric,
  lumpers_actual numeric,

  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists loads_user_date_idx
  on public.loads (user_id, load_date desc);

alter table public.loads enable row level security;

drop policy if exists "Owners can view own loads" on public.loads;
create policy "Owners can view own loads"
  on public.loads for select
  using (auth.uid() = user_id);

drop policy if exists "Owners can insert own loads" on public.loads;
create policy "Owners can insert own loads"
  on public.loads for insert
  with check (auth.uid() = user_id);

drop policy if exists "Owners can update own loads" on public.loads;
create policy "Owners can update own loads"
  on public.loads for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Owners can delete own loads" on public.loads;
create policy "Owners can delete own loads"
  on public.loads for delete
  using (auth.uid() = user_id);

-- Stripe subscriptions for ProfitRig Pro. Writes happen exclusively via the
-- Stripe webhook running as service_role; users can read their own row.
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text,
  status text not null default 'inactive',
  plan text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_status_idx
  on public.subscriptions (status);
create index if not exists subscriptions_customer_idx
  on public.subscriptions (stripe_customer_id);

alter table public.subscriptions enable row level security;

drop policy if exists "Owners can view own subscription" on public.subscriptions;
create policy "Owners can view own subscription"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- Phase 1 (Tax Pack) tables. See supabase-migration-009.sql for full notes.
-- All five tables are deliberately separated from the management/cost-profile
-- world; the Tax Pack reads ONLY from these + load actuals + load revenue.

create table if not exists public.tax_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  entity_type text,
  has_hired_driver boolean not null default false,
  truck_financing text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.tax_profiles enable row level security;
drop policy if exists "Owners can view own tax profile" on public.tax_profiles;
create policy "Owners can view own tax profile"
  on public.tax_profiles for select using (auth.uid() = user_id);
drop policy if exists "Owners can insert own tax profile" on public.tax_profiles;
create policy "Owners can insert own tax profile"
  on public.tax_profiles for insert with check (auth.uid() = user_id);
drop policy if exists "Owners can update own tax profile" on public.tax_profiles;
create policy "Owners can update own tax profile"
  on public.tax_profiles for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

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
  on public.expenses for select using (auth.uid() = user_id);
drop policy if exists "Owners can insert own expenses" on public.expenses;
create policy "Owners can insert own expenses"
  on public.expenses for insert with check (auth.uid() = user_id);
drop policy if exists "Owners can update own expenses" on public.expenses;
create policy "Owners can update own expenses"
  on public.expenses for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Owners can delete own expenses" on public.expenses;
create policy "Owners can delete own expenses"
  on public.expenses for delete using (auth.uid() = user_id);

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
  on public.capital_assets for select using (auth.uid() = user_id);
drop policy if exists "Owners can insert own assets" on public.capital_assets;
create policy "Owners can insert own assets"
  on public.capital_assets for insert with check (auth.uid() = user_id);
drop policy if exists "Owners can update own assets" on public.capital_assets;
create policy "Owners can update own assets"
  on public.capital_assets for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Owners can delete own assets" on public.capital_assets;
create policy "Owners can delete own assets"
  on public.capital_assets for delete using (auth.uid() = user_id);

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
  on public.per_diem_rates for select using (true);
insert into public.per_diem_rates (effective_date, conus_rate, ooc_rate, notice)
values
  ('2023-10-01', 69, 74, 'IRS Notice 2023-68'),
  ('2024-10-01', 80, 86, 'IRS Notice 2024-68'),
  ('2025-10-01', 80, 86, 'IRS Notice 2025-54')
on conflict (effective_date) do nothing;

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
  on public.per_diem_summary for select using (auth.uid() = user_id);
drop policy if exists "Owners can insert own per_diem_summary" on public.per_diem_summary;
create policy "Owners can insert own per_diem_summary"
  on public.per_diem_summary for insert with check (auth.uid() = user_id);
drop policy if exists "Owners can update own per_diem_summary" on public.per_diem_summary;
create policy "Owners can update own per_diem_summary"
  on public.per_diem_summary for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
