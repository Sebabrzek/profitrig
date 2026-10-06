-- Migration 018: Alerts a driver has marked "this is right"
--
-- ProfitRig now points out loads worth a second look — pay that works out
-- to $9 a mile, a partial whose extra miles look like its whole trip, the
-- same freight saved twice. A driver who checks and finds the load is right
-- can say so, and the alert stops showing.
--
-- loads.dismissed_checks  the exact wording of each alert the driver has
--                         marked right on THIS load. The wording carries the
--                         figure ("Pay works out to $9.40/mi …"), so if the
--                         driver later changes the miles or the pay, the
--                         wording changes, it no longer matches, and the
--                         alert comes back. A stale "this is right" can never
--                         hide a new problem.
--
-- ADDITIVE ONLY. Every existing load starts with an empty list, which is
-- exactly what a load nobody has marked is. Safe to run twice. The app
-- tolerates the column being missing: alerts still show, and "This is right"
-- simply says it could not be saved until this runs. The existing row-level
-- security on loads already limits a driver to their own rows.

alter table public.loads
  add column if not exists dismissed_checks text[] not null default '{}';

-- A short list of short strings, so a bad client cannot park a novel here.
alter table public.loads
  drop constraint if exists loads_dismissed_checks_size;

alter table public.loads
  add constraint loads_dismissed_checks_size
  check (cardinality(dismissed_checks) <= 20);


-- Undo:
--   alter table public.loads drop constraint if exists loads_dismissed_checks_size;
--   alter table public.loads drop column if exists dismissed_checks;
