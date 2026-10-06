-- Migration 019: A monthly AI allowance, in dollars, per plan
--
-- Ask ProfitRig was limited by NUMBER of questions. That stops working the
-- moment photo scanning arrives: one long settlement can cost as much as
-- fifty questions. From here on, every driver has a monthly AI allowance in
-- dollars — Ask ProfitRig and scanning together — so no driver can ever cost
-- more in AI than their plan earns. The dollar figures live in the app
-- (src/lib/aiGuard.ts, AI_MONTHLY_BUDGET_USD) and are handed to the check
-- below on every request.
--
-- 1. ai_usage.feature            'chat' (Ask ProfitRig) or 'scan' (photo
--                                scanning, coming next). Every existing row
--                                is a chat question, which is what the
--                                default says.
-- 2. ai_usage.reserved_cost_usd  what a request was ALLOWED to cost while it
--                                was running. The real cost replaces it when
--                                the answer is recorded. Holding it means two
--                                requests at the same instant cannot both
--                                squeeze into the last few cents.
-- 3. ai_reserve_budget()         the new check. Locks on the driver (the same
--                                lock as ai_reserve_request, so old and new
--                                never race), keeps the per-minute and
--                                per-day caps, then adds up this month's
--                                spend and records the request only if it
--                                fits. Only the server can run it.
--
-- ADDITIVE ONLY. The old ai_reserve_request() is left exactly as it is, so
-- the live chat keeps working before and after this runs, and the new app
-- code falls back to it if this has not run yet. Safe to run twice.


-- 1. Which AI feature a request was for -------------------------------------

alter table public.ai_usage
  add column if not exists feature text not null default 'chat';

alter table public.ai_usage
  drop constraint if exists ai_usage_feature_check;

alter table public.ai_usage
  add constraint ai_usage_feature_check
  check (feature in ('chat', 'scan'));


-- 2. The cost held while a request runs -------------------------------------

alter table public.ai_usage
  add column if not exists reserved_cost_usd numeric(12, 6);

alter table public.ai_usage
  drop constraint if exists ai_usage_reserved_cost_check;

alter table public.ai_usage
  add constraint ai_usage_reserved_cost_check
  check (reserved_cost_usd is null or reserved_cost_usd >= 0);


-- 3. The allowance check ----------------------------------------------------

create or replace function public.ai_reserve_budget(
  p_user_id uuid,
  p_plan text,
  p_model text,
  p_feature text,
  p_per_minute integer,
  p_per_day integer,
  p_budget_usd numeric,
  p_reserve_usd numeric,
  p_period_start timestamptz
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_now timestamptz;
  v_minute integer;
  v_day integer;
  v_spent numeric;
  v_retry timestamptz;
  v_id uuid;
begin
  if p_user_id is null
     or p_plan is null or p_plan not in ('pro', 'free')
     or p_model is null
     or p_feature is null or p_feature not in ('chat', 'scan')
     or p_per_minute is null or p_per_minute < 1
     or p_per_day is null or p_per_day < 1
     or p_budget_usd is null or p_budget_usd < 0
     or p_reserve_usd is null or p_reserve_usd <= 0
     or p_period_start is null then
    raise exception 'ai_reserve_budget: invalid arguments';
  end if;

  -- The same per-driver lock as ai_reserve_request: a second simultaneous
  -- request waits here until the first has been recorded, then counts it.
  perform pg_advisory_xact_lock(
    hashtextextended('ai_usage:' || p_user_id::text, 0)
  );
  v_now := clock_timestamp();

  -- A month that has not started, or started long ago, is a bug in the
  -- caller. A future start would count nothing and let everything through.
  -- (Five minutes of slack: the app's clock may run a little ahead of the
  -- database's at midnight on the 1st.)
  if p_period_start > v_now + interval '5 minutes'
     or p_period_start < v_now - interval '32 days' then
    raise exception 'ai_reserve_budget: invalid period start';
  end if;

  -- Per minute, for this feature: every request counts, including ones the
  -- server blocked.
  select count(*) into v_minute
    from public.ai_usage
   where user_id = p_user_id
     and feature = p_feature
     and created_at > v_now - interval '60 seconds';

  if v_minute >= p_per_minute then
    select created_at + interval '60 seconds' into v_retry
      from public.ai_usage
     where user_id = p_user_id
       and feature = p_feature
       and created_at > v_now - interval '60 seconds'
     order by created_at asc
     offset (v_minute - p_per_minute)
     limit 1;
    return jsonb_build_object(
      'allowed', false, 'reason', 'minute', 'retry_at', v_retry
    );
  end if;

  -- Per 24 hours, for this feature: requests that used (or were about to
  -- use) the AI. Blocked requests, and provider failures before any answer,
  -- don't use up a driver's day.
  select count(*) into v_day
    from public.ai_usage
   where user_id = p_user_id
     and feature = p_feature
     and created_at > v_now - interval '24 hours'
     and (
       status in ('reserved', 'succeeded', 'cancelled')
       or (status = 'error' and coalesce(output_tokens, 0) > 0)
     );

  if v_day >= p_per_day then
    select created_at + interval '24 hours' into v_retry
      from public.ai_usage
     where user_id = p_user_id
       and feature = p_feature
       and created_at > v_now - interval '24 hours'
       and (
         status in ('reserved', 'succeeded', 'cancelled')
         or (status = 'error' and coalesce(output_tokens, 0) > 0)
       )
     order by created_at asc
     offset (v_day - p_per_day)
     limit 1;
    return jsonb_build_object(
      'allowed', false, 'reason', 'day', 'retry_at', v_retry
    );
  end if;

  -- This month's spend, every feature together: what finished requests
  -- cost, and what running ones are holding.
  select coalesce(sum(coalesce(estimated_cost_usd, reserved_cost_usd, 0)), 0)
    into v_spent
    from public.ai_usage
   where user_id = p_user_id
     and created_at >= p_period_start;

  -- Only a request that fits whole is started, so nothing is ever cut off
  -- halfway for running out.
  if v_spent + p_reserve_usd > p_budget_usd then
    return jsonb_build_object(
      'allowed', false, 'reason', 'budget',
      'spent_usd', v_spent, 'budget_usd', p_budget_usd
    );
  end if;

  insert into public.ai_usage (
    user_id, created_at, plan, model, feature, status, reserved_cost_usd
  )
  values (
    p_user_id, v_now, p_plan, p_model, p_feature, 'reserved', p_reserve_usd
  )
  returning id into v_id;

  return jsonb_build_object(
    'allowed', true,
    'usage_id', v_id,
    'remaining_day', p_per_day - v_day - 1,
    'spent_usd', v_spent,
    'budget_usd', p_budget_usd
  );
end;
$$;

-- Only the server may run it. Supabase grants new functions to anon and
-- authenticated by default, so those grants are removed explicitly.
revoke all on function public.ai_reserve_budget(uuid, text, text, text, integer, integer, numeric, numeric, timestamptz)
  from public, anon, authenticated;
grant execute on function public.ai_reserve_budget(uuid, text, text, text, integer, integer, numeric, numeric, timestamptz)
  to service_role;


-- Undo (only if ever needed — not part of the migration):
--   drop function if exists public.ai_reserve_budget(uuid, text, text, text, integer, integer, numeric, numeric, timestamptz);
--   alter table public.ai_usage drop constraint if exists ai_usage_reserved_cost_check;
--   alter table public.ai_usage drop column if exists reserved_cost_usd;
--   alter table public.ai_usage drop constraint if exists ai_usage_feature_check;
--   alter table public.ai_usage drop column if exists feature;
