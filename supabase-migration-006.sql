-- ProfitRig migration 006: Stripe subscriptions for ProfitRig Pro.
-- Run this once in: Supabase Dashboard -> SQL Editor -> New Query -> Run.
-- Safe to re-run.

create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text,
  status text not null default 'inactive',
  -- One of: inactive, trialing, active, past_due, canceled, incomplete
  plan text, -- 'monthly' | 'yearly' | null
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscriptions_status_idx
  on public.subscriptions (status);
create index if not exists subscriptions_customer_idx
  on public.subscriptions (stripe_customer_id);

alter table public.subscriptions enable row level security;

-- Users can read their own subscription row.
drop policy if exists "Owners can view own subscription" on public.subscriptions;
create policy "Owners can view own subscription"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- Writes happen only via service_role (Stripe webhook). No anon policies.
