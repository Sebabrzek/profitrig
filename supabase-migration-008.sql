-- ProfitRig migration 008: Phase 0 — real cost-per-mile override.
-- One nullable column on cost_profiles. When set, the Calculator displays
-- this value as the user's "true" CPM (a "management" lens override
-- derived from logged loads), replacing the computed totalCPM. The line
-- items underneath stay untouched. NULL = no override, use computed value.
-- Run once in: Supabase Dashboard -> SQL Editor -> New Query -> Run.
-- Safe to re-run.

alter table public.cost_profiles
  add column if not exists real_cpm_override numeric;
