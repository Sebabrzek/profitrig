-- Migration 010: AI support chat ("Ask ProfitRig")
-- Stores chat transcripts per user. One row per message.
-- Run this in the Supabase SQL editor BEFORE deploying the chat feature.

create table if not exists public.support_chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists support_chats_user_created_idx
  on public.support_chats (user_id, created_at desc);

create index if not exists support_chats_created_idx
  on public.support_chats (created_at desc);

alter table public.support_chats enable row level security;

-- Owner can read their own chat history
drop policy if exists "support_chats_select_own" on public.support_chats;
create policy "support_chats_select_own"
  on public.support_chats for select
  using (auth.uid() = user_id);

-- Owner can insert their own messages (both user + assistant rows are
-- inserted by the API route acting as the signed-in user)
drop policy if exists "support_chats_insert_own" on public.support_chats;
create policy "support_chats_insert_own"
  on public.support_chats for insert
  with check (auth.uid() = user_id);

-- No update/delete policies: transcripts are append-only for users.
-- Admin reads happen through the service_role key (bypasses RLS).
