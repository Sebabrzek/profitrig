-- Migration 011: On-the-road expenses (weekly "other expenses")
--
-- Money spent during the week that doesn't belong to any single load:
-- food, truck wash, gloves, a repair, parking, showers, scales, a motel.
-- Attached to a DATE, not a load — the Loads tab groups them by week.
--
-- These are ACTUAL dollars, so they serve both lenses:
--   - management: they come off that week's profit
--   - tax: every category EXCEPT meals flows into the year-end report
--     (meals are excluded because the per-diem worksheet already covers
--     them — counting both would double-report meals to the accountant)
--
-- Run this in the Supabase SQL editor BEFORE deploying the code.

create table if not exists public.road_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  spent_on date not null,
  category text not null,
  amount numeric(12, 2) not null check (amount >= 0),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists road_expenses_user_date_idx
  on public.road_expenses (user_id, spent_on desc);

alter table public.road_expenses enable row level security;

drop policy if exists "road_expenses_select_own" on public.road_expenses;
create policy "road_expenses_select_own"
  on public.road_expenses for select
  using (auth.uid() = user_id);

drop policy if exists "road_expenses_insert_own" on public.road_expenses;
create policy "road_expenses_insert_own"
  on public.road_expenses for insert
  with check (auth.uid() = user_id);

drop policy if exists "road_expenses_update_own" on public.road_expenses;
create policy "road_expenses_update_own"
  on public.road_expenses for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "road_expenses_delete_own" on public.road_expenses;
create policy "road_expenses_delete_own"
  on public.road_expenses for delete
  using (auth.uid() = user_id);
