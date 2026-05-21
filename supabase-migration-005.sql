-- ProfitRig migration 005: weekly load profitability tracker.
-- Run this once in: Supabase Dashboard -> SQL Editor -> New Query -> Run.
-- Safe to re-run.

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

  -- Optional actuals. When null, the load page computes the cost from the
  -- driver's saved cost_profile (e.g. fuel from MPG + diesel price).
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
