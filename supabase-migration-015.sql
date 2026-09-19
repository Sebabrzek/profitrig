-- Migration 015: Ask ProfitRig guardrails — usage records and the limit check
--
-- ADDITIVE ONLY. Safe to run while the current live chat keeps working: the
-- live code only ever writes user_id, role and content to support_chats, and
-- that stays allowed. Run this BEFORE testing the guardrails preview.
-- Migration 016 (run only after the guardrails code is merged) will close
-- driver writes to support_chats completely.
--
-- 1. ai_usage — one row per Ask ProfitRig request that reached the limit
--    check: who, when, which model, tokens, estimated cost, status. Drivers
--    can neither read nor write it; the server writes it with the
--    service-role key and Admin will read it the same way.
-- 2. support_chats.trusted — true only on rows the new server code writes.
--    Only trusted rows are ever sent back to the AI as conversation history,
--    so nothing a driver wrote directly can pose as an earlier AI answer.
--    Drivers lose the right to set this column (and every column except
--    user_id, role, content).
-- 3. ai_reserve_request() — the rate limit. Locks per driver, counts their
--    rolling 60-second / 24-hour / 30-day usage, and records the request only
--    if every limit allows it. Two simultaneous requests from one driver are
--    handled one after the other, so neither can slip past the count.
--    Only the server (service role) can run it.


-- 1. Usage records ---------------------------------------------------------

create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  plan text not null check (plan in ('pro', 'free')),
  model text not null,
  -- reserved   counted, AI call in progress (or the server stopped mid-way)
  -- succeeded  answered
  -- cancelled  the driver closed the chat while it was answering
  -- error      the AI provider failed
  -- blocked    refused by the server before any AI call (costs nothing)
  status text not null default 'reserved'
    check (status in ('reserved', 'succeeded', 'cancelled', 'error', 'blocked')),
  input_tokens integer check (input_tokens >= 0),
  output_tokens integer check (output_tokens >= 0),
  cache_creation_input_tokens integer check (cache_creation_input_tokens >= 0),
  cache_read_input_tokens integer check (cache_read_input_tokens >= 0),
  -- Stored at the time of the request, so a later price change never
  -- rewrites what an old request cost.
  estimated_cost_usd numeric(12, 6) check (estimated_cost_usd >= 0),
  -- True when token counts were estimated (e.g. a cancelled answer).
  usage_estimated boolean not null default false,
  error_code text,
  user_message_id uuid references public.support_chats (id) on delete set null,
  assistant_message_id uuid references public.support_chats (id) on delete set null
);

create index if not exists ai_usage_user_created_idx
  on public.ai_usage (user_id, created_at desc);

create index if not exists ai_usage_created_idx
  on public.ai_usage (created_at desc);

alter table public.ai_usage enable row level security;
-- No policies on purpose: drivers get no access at all. The service role
-- bypasses RLS. Table privileges are removed too, as a second lock.
revoke all on public.ai_usage from anon, authenticated;


-- 2. Trusted chat rows -----------------------------------------------------

alter table public.support_chats
  add column if not exists trusted boolean not null default false;

-- Drivers may still insert their own rows (the live chat does, until 016),
-- but only these three columns. They can no longer mark a row trusted.
revoke insert on public.support_chats from anon, authenticated;
grant insert (user_id, role, content) on public.support_chats to authenticated;


-- 3. The limit check -------------------------------------------------------

create or replace function public.ai_reserve_request(
  p_user_id uuid,
  p_plan text,
  p_model text,
  p_per_minute integer,
  p_per_day integer,
  p_per_month integer
) returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_now timestamptz;
  v_minute integer;
  v_day integer;
  v_month integer;
  v_retry timestamptz;
  v_id uuid;
begin
  if p_user_id is null
     or p_plan is null or p_plan not in ('pro', 'free')
     or p_model is null
     or p_per_minute is null or p_per_minute < 1
     or p_per_day is null or p_per_day < 1
     or p_per_month is null or p_per_month < 1 then
    raise exception 'ai_reserve_request: invalid arguments';
  end if;

  -- One reservation at a time per driver. A second simultaneous request
  -- waits here until the first has been recorded, then counts it.
  perform pg_advisory_xact_lock(
    hashtextextended('ai_usage:' || p_user_id::text, 0)
  );
  v_now := clock_timestamp();

  -- Per minute: every request counts, including ones the server blocked.
  select count(*) into v_minute
    from public.ai_usage
   where user_id = p_user_id
     and created_at > v_now - interval '60 seconds';

  if v_minute >= p_per_minute then
    select created_at + interval '60 seconds' into v_retry
      from public.ai_usage
     where user_id = p_user_id
       and created_at > v_now - interval '60 seconds'
     order by created_at asc
     offset (v_minute - p_per_minute)
     limit 1;
    return jsonb_build_object(
      'allowed', false, 'reason', 'minute', 'retry_at', v_retry
    );
  end if;

  -- Per 24 hours and per 30 days: questions that used (or were about to
  -- use) the AI. Blocked requests, and provider failures before any answer
  -- was produced, don't use up a driver's day or month.
  select
    count(*) filter (where created_at > v_now - interval '24 hours'),
    count(*)
    into v_day, v_month
    from public.ai_usage
   where user_id = p_user_id
     and created_at > v_now - interval '30 days'
     and (
       status in ('reserved', 'succeeded', 'cancelled')
       or (status = 'error' and coalesce(output_tokens, 0) > 0)
     );

  if v_day >= p_per_day then
    select created_at + interval '24 hours' into v_retry
      from public.ai_usage
     where user_id = p_user_id
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

  if v_month >= p_per_month then
    select created_at + interval '30 days' into v_retry
      from public.ai_usage
     where user_id = p_user_id
       and created_at > v_now - interval '30 days'
       and (
         status in ('reserved', 'succeeded', 'cancelled')
         or (status = 'error' and coalesce(output_tokens, 0) > 0)
       )
     order by created_at asc
     offset (v_month - p_per_month)
     limit 1;
    return jsonb_build_object(
      'allowed', false, 'reason', 'month', 'retry_at', v_retry
    );
  end if;

  insert into public.ai_usage (user_id, created_at, plan, model, status)
  values (p_user_id, v_now, p_plan, p_model, 'reserved')
  returning id into v_id;

  return jsonb_build_object(
    'allowed', true,
    'usage_id', v_id,
    'remaining_day', p_per_day - v_day - 1,
    'remaining_month', p_per_month - v_month - 1
  );
end;
$$;

-- Only the server may run it. Supabase grants new functions to anon and
-- authenticated by default, so those grants are removed explicitly.
revoke all on function public.ai_reserve_request(uuid, text, text, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.ai_reserve_request(uuid, text, text, integer, integer, integer)
  to service_role;


-- Undo (only if ever needed — not part of the migration):
--   drop function if exists public.ai_reserve_request(uuid, text, text, integer, integer, integer);
--   drop table if exists public.ai_usage;
--   revoke insert (user_id, role, content) on public.support_chats from authenticated;
--   grant insert on public.support_chats to authenticated;
--   alter table public.support_chats drop column if exists trusted;
