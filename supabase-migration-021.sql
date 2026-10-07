-- Migration 021: Email-in — each driver's own address, and what arrived
--
-- A driver picks an address — dennis@in.profitrig.com — and anything sent or
-- forwarded to it with a rate con or ticket attached is read by the scanner
-- and waits on their Loads page as a DRAFT for them to check and save.
--
-- 1. email_in_addresses  one per driver: the name before the @. Unique, and
--                        held to the same rule the app checks (3–30 letters,
--                        numbers, dots, dashes). Changing it frees the old one
--                        at once. Drivers can READ their own; the server
--                        writes them, so the name rules can't be skipped.
-- 2. email_in_messages   every email that reached a driver's address: who
--                        sent it, the subject, and what happened, in one plain
--                        sentence — so a driver can see what arrived, and spot
--                        junk. A Gmail forwarding confirmation code is kept
--                        here to show them. Postmark's message id is unique,
--                        so a re-delivered email is never read twice.
-- 3. scans               learn where a document came from: the Scan button
--                        or email, which email, a fingerprint of the file (the
--                        same document emailed twice is read once), and
--                        whether the driver set an emailed draft aside as
--                        "not a load".
--
-- ADDITIVE ONLY. Nothing existing changes meaning: every scan so far was
-- uploaded, which is what the default says. Safe to run twice.


-- 1. Addresses --------------------------------------------------------------

create table if not exists public.email_in_addresses (
  user_id uuid primary key references auth.users (id) on delete cascade,
  local_part text not null unique
    check (
      local_part ~ '^[a-z0-9][a-z0-9.-]{1,28}[a-z0-9]$'
      and local_part !~ '[.-]{2}'
    ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.email_in_addresses enable row level security;

drop policy if exists "Drivers read their own address" on public.email_in_addresses;
create policy "Drivers read their own address"
  on public.email_in_addresses for select
  to authenticated
  using (auth.uid() = user_id);

revoke insert, update, delete on public.email_in_addresses from anon, authenticated;


-- 2. What arrived -----------------------------------------------------------

create table if not exists public.email_in_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  received_at timestamptz not null default now(),
  postmark_message_id text,
  from_email text,
  from_name text,
  subject text,
  -- scanned | duplicate | no_attachment | not_on_plan | over_limit |
  -- gmail_confirmation | failed
  outcome text not null
    check (outcome in ('scanned', 'duplicate', 'no_attachment', 'not_on_plan',
                       'over_limit', 'gmail_confirmation', 'failed')),
  -- The sentence the driver sees.
  detail text,
  -- Digits only: a forged "Gmail" email can show a wrong number, nothing more.
  gmail_code text check (gmail_code is null or gmail_code ~ '^[0-9]{6,12}$'),
  gmail_from text,
  documents_read integer not null default 0 check (documents_read >= 0)
);

create unique index if not exists email_in_messages_postmark_idx
  on public.email_in_messages (postmark_message_id)
  where postmark_message_id is not null;

create index if not exists email_in_messages_user_idx
  on public.email_in_messages (user_id, received_at desc);

alter table public.email_in_messages enable row level security;

drop policy if exists "Drivers read their own email" on public.email_in_messages;
create policy "Drivers read their own email"
  on public.email_in_messages for select
  to authenticated
  using (auth.uid() = user_id);

revoke insert, update, delete on public.email_in_messages from anon, authenticated;


-- 3. Where a scan came from -------------------------------------------------

alter table public.scans
  add column if not exists source text not null default 'upload';

alter table public.scans
  drop constraint if exists scans_source_check;

alter table public.scans
  add constraint scans_source_check check (source in ('upload', 'email'));

alter table public.scans
  add column if not exists email_message_id uuid
    references public.email_in_messages (id) on delete set null;

-- SHA-256 of the file, hex.
alter table public.scans
  add column if not exists content_sha256 text;

-- An emailed draft the driver said is not a load.
alter table public.scans
  add column if not exists dismissed_at timestamptz;

create index if not exists scans_user_sha_idx
  on public.scans (user_id, content_sha256)
  where content_sha256 is not null;

-- Emailed drafts still waiting for the driver.
create index if not exists scans_waiting_idx
  on public.scans (user_id, created_at desc)
  where source = 'email' and load_id is null and dismissed_at is null;


-- Undo (only if ever needed — not part of the migration):
--   drop index if exists public.scans_waiting_idx;
--   drop index if exists public.scans_user_sha_idx;
--   alter table public.scans drop column if exists dismissed_at;
--   alter table public.scans drop column if exists content_sha256;
--   alter table public.scans drop column if exists email_message_id;
--   alter table public.scans drop constraint if exists scans_source_check;
--   alter table public.scans drop column if exists source;
--   drop table if exists public.email_in_messages;
--   drop table if exists public.email_in_addresses;
