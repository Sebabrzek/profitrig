-- Migration 012: Which day the driver's week starts on (Loads tab)
--
-- Carrier settlements disagree about the week. Some pay Monday–Sunday; others,
-- like D. Lewis, pay Sunday–Saturday. With a fixed Monday week a Sunday load
-- lands in a different week than the settlement that pays for it, so the
-- weekly profit can never line up with the money that arrives.
--
-- NULL means Monday — the behavior every existing driver already has — so
-- nobody's past weeks move when this ships.
--
-- The app reads this column defensively and treats a missing column as
-- Monday, but saving a choice needs it. Run this in the Supabase SQL editor
-- BEFORE deploying the code.

alter table public.driver_profiles
  add column if not exists week_start text;

alter table public.driver_profiles
  drop constraint if exists driver_profiles_week_start_check;

alter table public.driver_profiles
  add constraint driver_profiles_week_start_check
  check (week_start is null or week_start in ('monday', 'sunday'));
