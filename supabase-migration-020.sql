-- Migration 020: Scanning — the documents drivers scan, and where they live
--
-- A driver photographs a rate con or load ticket (or picks a PDF), ProfitRig
-- reads it and fills in a DRAFT load, and the driver checks it and saves.
-- The original is kept with the load: for the IRS, and for any argument
-- with a broker about what was agreed.
--
-- 1. scans          one row per document scanned: whose, which file, what
--                   the AI read, what it cost (ai_usage), and the load it
--                   became once the driver saved it. Drivers can READ their
--                   own rows; only the server writes them.
-- 2. storage bucket "scans" — PRIVATE. No storage policies on purpose: no
--                   driver can list, read or write files directly. The
--                   server stores each file under the driver's own folder
--                   and hands out a link that expires in a minute, only to
--                   that driver (or the admin).
--
-- ADDITIVE ONLY. Nothing existing changes. Until this runs, the Scan button
-- says scanning isn't switched on yet, before anything is spent.
-- Safe to run twice.


-- 1. Scans ------------------------------------------------------------------

create table if not exists public.scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- <user_id>/<scan id>.<ext> inside the "scans" bucket.
  storage_path text not null,
  mime_type text not null
    check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  byte_size integer not null check (byte_size > 0 and byte_size <= 5242880),
  -- pending  stored, being read
  -- read     the AI answered; `extracted` holds what it read
  -- failed   it could not be read (the AI refused, ran out, or errored)
  status text not null default 'pending'
    check (status in ('pending', 'read', 'failed')),
  -- rate_confirmation | load_ticket | bill_of_lading | other, as the AI saw it
  document_type text,
  -- Exactly what the AI returned, before ProfitRig cleaned it.
  extracted jsonb,
  -- The AI request this scan used, with its tokens and cost.
  usage_id uuid references public.ai_usage (id) on delete set null,
  -- The load the driver saved from it. Deleting the load keeps the scan.
  load_id uuid references public.loads (id) on delete set null
);

create index if not exists scans_user_created_idx
  on public.scans (user_id, created_at desc);

create index if not exists scans_load_idx
  on public.scans (load_id)
  where load_id is not null;

alter table public.scans enable row level security;

drop policy if exists "Drivers read their own scans" on public.scans;
create policy "Drivers read their own scans"
  on public.scans for select
  to authenticated
  using (auth.uid() = user_id);

-- Reading is all a driver may do. Writes come only from the server.
revoke insert, update, delete on public.scans from anon, authenticated;


-- 2. Where the files live ---------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'scans',
  'scans',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;


-- Undo (only if ever needed — not part of the migration). Empty the bucket
-- in Storage first; the files are drivers' records.
--   delete from storage.buckets where id = 'scans';
--   drop table if exists public.scans;
