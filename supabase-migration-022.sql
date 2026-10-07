-- Migration 022: Invoicing — business details, invoices, and their paperwork
--
-- A driver with their own authority bills a broker (or their factoring
-- company) for a load: an invoice made from the load, downloaded as a PDF
-- with the rate con and signed BOL behind it, and tracked until it's paid.
--
-- 1. invoice_settings   one per driver: the company the invoice is from —
--                       company only, never a person — MC number, address,
--                       payment terms, the next invoice number, and the
--                       factoring company to remit to, if any.
-- 2. invoices           each invoice, numbered per driver (never reused),
--                       with a SNAPSHOT of the business details it was issued
--                       with, so changing an address later never rewrites an
--                       old invoice. Its own amounts: editing an invoice never
--                       changes the load it came from. Due date and total are
--                       worked out by the database, so they always agree.
--                       Invoices are cancelled, never deleted, so a number is
--                       never reused.
-- 3. invoice_documents  paperwork attached to an invoice — a photo or PDF of
--                       the signed BOL/POD — stored in the private "scans"
--                       bucket. Drivers READ their own; the server writes.
--
-- ADDITIVE ONLY. Nothing existing changes. Drivers read and write their own
-- settings and invoices (row-level security); nobody sees anyone else's.
-- Safe to run twice.


-- 1. Business details -------------------------------------------------------

create table if not exists public.invoice_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  company_name text not null check (length(company_name) between 1 and 120),
  mc_number text check (mc_number is null or mc_number ~ '^[0-9]{0,10}$'),
  address_line text,
  city text,
  state text check (state is null or state ~ '^([A-Z]{2})?$'),
  zip text,
  phone text,
  email text,
  net_days integer not null default 30 check (net_days between 0 and 180),
  next_number integer not null default 1001 check (next_number between 1 and 99999999),
  factor_name text,
  factor_address text,
  updated_at timestamptz not null default now()
);

alter table public.invoice_settings enable row level security;

drop policy if exists "Drivers read their own invoice settings" on public.invoice_settings;
create policy "Drivers read their own invoice settings"
  on public.invoice_settings for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Drivers add their own invoice settings" on public.invoice_settings;
create policy "Drivers add their own invoice settings"
  on public.invoice_settings for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Drivers change their own invoice settings" on public.invoice_settings;
create policy "Drivers change their own invoice settings"
  on public.invoice_settings for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- 2. Invoices ---------------------------------------------------------------

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  load_id uuid references public.loads (id) on delete set null,
  number integer not null check (number between 1 and 99999999),
  status text not null default 'open' check (status in ('open', 'paid', 'void')),
  invoice_date date not null,
  net_days integer not null check (net_days between 0 and 180),
  due_date date generated always as (invoice_date + net_days) stored,
  paid_at date,

  bill_to_name text not null check (length(bill_to_name) between 1 and 120),
  bill_to_email text,
  bill_to_address text,
  broker_load_number text,
  pickup_date date,
  origin text,
  destination text,

  linehaul numeric(12, 2) not null default 0 check (linehaul >= 0 and linehaul <= 1000000),
  fuel_surcharge numeric(12, 2) not null default 0 check (fuel_surcharge >= 0 and fuel_surcharge <= 1000000),
  accessorials numeric(12, 2) not null default 0 check (accessorials >= 0 and accessorials <= 1000000),
  total numeric(12, 2) generated always as (linehaul + fuel_surcharge + accessorials) stored,
  notes text,

  -- Who it's from, as it was when issued.
  from_company text not null,
  from_mc text,
  from_address text,
  from_phone text,
  from_email text,
  remit_to text not null,

  -- Set when ProfitRig emails it (invoicing step 2).
  sent_at timestamptz,
  sent_to text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, number),
  check (status <> 'paid' or paid_at is not null)
);

create index if not exists invoices_user_date_idx
  on public.invoices (user_id, invoice_date desc);

create index if not exists invoices_load_idx
  on public.invoices (load_id)
  where load_id is not null;

alter table public.invoices enable row level security;

drop policy if exists "Drivers read their own invoices" on public.invoices;
create policy "Drivers read their own invoices"
  on public.invoices for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Drivers add their own invoices" on public.invoices;
create policy "Drivers add their own invoices"
  on public.invoices for insert to authenticated
  with check (
    auth.uid() = user_id
    -- Only for one of their own loads.
    and (load_id is null or exists (
      select 1 from public.loads l where l.id = load_id and l.user_id = auth.uid()
    ))
  );

drop policy if exists "Drivers change their own invoices" on public.invoices;
create policy "Drivers change their own invoices"
  on public.invoices for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Cancelled, never deleted: an invoice number is never reused.
revoke delete on public.invoices from anon, authenticated;


-- 3. Paperwork --------------------------------------------------------------

create table if not exists public.invoice_documents (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null default 'bol' check (kind in ('bol', 'other')),
  storage_path text not null,
  mime_type text not null
    check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  byte_size integer not null check (byte_size > 0 and byte_size <= 5242880),
  created_at timestamptz not null default now()
);

create index if not exists invoice_documents_invoice_idx
  on public.invoice_documents (invoice_id);

alter table public.invoice_documents enable row level security;

drop policy if exists "Drivers read their own invoice paperwork" on public.invoice_documents;
create policy "Drivers read their own invoice paperwork"
  on public.invoice_documents for select to authenticated
  using (auth.uid() = user_id);

revoke insert, update, delete on public.invoice_documents from anon, authenticated;


-- Undo (only if ever needed — not part of the migration). Empty the
-- invoices/ folders in the scans bucket first; they are drivers' records.
--   drop table if exists public.invoice_documents;
--   drop table if exists public.invoices;
--   drop table if exists public.invoice_settings;
