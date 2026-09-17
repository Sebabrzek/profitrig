-- Migration 013: What a leased driver's carrier keeps
--
-- Leased owner-operators are paid a percentage of each load. D. Lewis, for
-- example, keeps 20% and the driver keeps 80%. ProfitRig counted the whole
-- load as the driver's revenue, so a $2,000 load showed $2,000 when the driver
-- got $1,600 — overstating profit on every leased load.
--
-- driver_profiles.carrier_pct  the % the carrier keeps; the default for new
--                              loads. NULL = independent, or not set yet.
-- loads.carrier_pct            the % applied to THAT load. Stored per load so
--                              a later change to the split (DLT went 18% → 20%
--                              in July) never rewrites past weeks. NULL = never
--                              set, counted as 0%; 0 = the driver kept it all.
--
-- Every existing row starts NULL, so no driver's numbers change until they
-- turn the setting on.
--
-- The app tolerates these columns being missing, but saving a split needs
-- them. Run this in the Supabase SQL editor BEFORE deploying the code.

alter table public.driver_profiles
  add column if not exists carrier_pct numeric(5, 2);

alter table public.driver_profiles
  drop constraint if exists driver_profiles_carrier_pct_check;

alter table public.driver_profiles
  add constraint driver_profiles_carrier_pct_check
  check (carrier_pct is null or (carrier_pct > 0 and carrier_pct < 100));

alter table public.loads
  add column if not exists carrier_pct numeric(5, 2);

alter table public.loads
  drop constraint if exists loads_carrier_pct_check;

alter table public.loads
  add constraint loads_carrier_pct_check
  check (carrier_pct is null or (carrier_pct >= 0 and carrier_pct < 100));
