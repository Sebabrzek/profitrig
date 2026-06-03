-- ProfitRig migration 007: beta-feedback additions.
-- - Adds two new fixed-cost lines: Load Board and Other Monthly Bill.
-- - other_label lets the driver name the catch-all bucket (e.g. "Lawyer").
-- Run this once in: Supabase Dashboard -> SQL Editor -> New Query -> Run.
-- Safe to re-run.

alter table public.cost_profiles
  add column if not exists load_board_per_month numeric not null default 0;
alter table public.cost_profiles
  add column if not exists other_monthly_bill numeric not null default 0;
alter table public.cost_profiles
  add column if not exists other_label text;

alter table public.cost_profile_snapshots
  add column if not exists load_board_per_month numeric not null default 0;
alter table public.cost_profile_snapshots
  add column if not exists other_monthly_bill numeric not null default 0;
alter table public.cost_profile_snapshots
  add column if not exists other_label text;
