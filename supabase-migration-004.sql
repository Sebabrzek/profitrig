-- ProfitRig migration 004: in-app feedback inbox.
-- Run this once in: Supabase Dashboard -> SQL Editor -> New Query -> Run.
-- Safe to re-run.

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  message text not null check (length(trim(message)) > 0 and length(message) <= 5000),
  created_at timestamptz not null default now()
);

create index if not exists feedback_created_at_idx
  on public.feedback (created_at desc);

alter table public.feedback enable row level security;

-- Signed-in users can submit their own feedback. They cannot read it back
-- (admin reads via Supabase dashboard / service_role).
drop policy if exists "Signed-in users can submit feedback" on public.feedback;
create policy "Signed-in users can submit feedback"
  on public.feedback for insert
  with check (auth.uid() = user_id);
