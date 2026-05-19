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

  monthly_miles numeric not null default 0,

  mpg numeric not null default 0,
  fuel_price_per_gallon numeric not null default 0,
  maintenance_per_mile numeric not null default 0,
  tires_per_mile numeric not null default 0,
  def_per_mile numeric not null default 0,
  driver_pay_per_mile numeric not null default 0,
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
