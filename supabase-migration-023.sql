-- Migration 023: Messages — announcements by email and in the app
--
-- Admin → Messages lets Sebastian write to drivers: an email to an audience
-- (Pro drivers, free users who opted in, own authority, leased, inactive),
-- and optionally the same news as a banner every signed-in driver sees.
--
-- 1. email_preferences       each driver's own switches. product_updates
--                            null means "the default for my plan" (on for
--                            Pro; for free users, their "Send me ProfitRig
--                            emails" box). weekly_summary is for the weekly
--                            email that comes next. Drivers read and change
--                            their own.
-- 2. message_settings        one row: the sender name, the reply-to address,
--                            and the business mailing address every bulk
--                            email must carry. Admin only.
-- 3. campaigns               each announcement sent: subject, text, who it
--                            went to, when. Admin only.
-- 4. campaign_recipients     who each one went to and what happened — sent,
--                            delivered, bounced, suppressed — and whether
--                            they unsubscribed from it. Admin only.
-- 5. announcements           the in-app banner: short text shown to signed-in
--                            drivers between two dates. Drivers can read only
--                            the ones showing now.
-- 6. announcement_dismissals who closed which banner, so it stays closed on
--                            every device. Drivers write their own.
--
-- ADDITIVE ONLY. Nothing existing changes. Safe to run twice.


-- 1. Email preferences ------------------------------------------------------

create table if not exists public.email_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  product_updates boolean,
  weekly_summary boolean,
  -- When they last unsubscribed from a ProfitRig email (from Postmark).
  unsubscribed_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.email_preferences enable row level security;

drop policy if exists "Drivers read their own email preferences" on public.email_preferences;
create policy "Drivers read their own email preferences"
  on public.email_preferences for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Drivers add their own email preferences" on public.email_preferences;
create policy "Drivers add their own email preferences"
  on public.email_preferences for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Drivers change their own email preferences" on public.email_preferences;
create policy "Drivers change their own email preferences"
  on public.email_preferences for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- 2. Sender settings (one row) ----------------------------------------------

create table if not exists public.message_settings (
  id smallint primary key default 1 check (id = 1),
  from_name text not null default 'Sebastian at ProfitRig',
  reply_to text,
  mailing_address text,
  updated_at timestamptz not null default now()
);

alter table public.message_settings enable row level security;
revoke all on public.message_settings from anon, authenticated;


-- 3. Campaigns --------------------------------------------------------------

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  subject text not null check (length(subject) between 1 and 150),
  body text not null check (length(body) between 1 and 20000),
  audience text not null
    check (audience in ('all', 'pro', 'free', 'own_authority', 'leased', 'inactive')),
  status text not null default 'sending' check (status in ('sending', 'sent', 'failed')),
  sent_at timestamptz,
  recipients integer not null default 0 check (recipients >= 0),
  error text
);

create index if not exists campaigns_created_idx on public.campaigns (created_at desc);

alter table public.campaigns enable row level security;
revoke all on public.campaigns from anon, authenticated;


-- 4. Who each campaign went to ----------------------------------------------

create table if not exists public.campaign_recipients (
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  email text not null,
  status text not null default 'queued'
    check (status in ('queued', 'sent', 'failed', 'suppressed', 'delivered', 'bounced')),
  postmark_message_id text,
  error text,
  unsubscribed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (campaign_id, user_id)
);

create index if not exists campaign_recipients_message_idx
  on public.campaign_recipients (postmark_message_id)
  where postmark_message_id is not null;

create index if not exists campaign_recipients_email_idx
  on public.campaign_recipients (lower(email));

alter table public.campaign_recipients enable row level security;
revoke all on public.campaign_recipients from anon, authenticated;


-- 5. The in-app banner ------------------------------------------------------

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  title text not null check (length(title) between 1 and 150),
  body text not null check (length(body) between 1 and 280),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  campaign_id uuid references public.campaigns (id) on delete set null,
  check (ends_at > starts_at)
);

alter table public.announcements enable row level security;

drop policy if exists "Signed-in drivers read the banner showing now" on public.announcements;
create policy "Signed-in drivers read the banner showing now"
  on public.announcements for select to authenticated
  using (starts_at <= now() and ends_at > now());

revoke insert, update, delete on public.announcements from anon, authenticated;


-- 6. Banners a driver closed ------------------------------------------------

create table if not exists public.announcement_dismissals (
  user_id uuid not null references auth.users (id) on delete cascade,
  announcement_id uuid not null references public.announcements (id) on delete cascade,
  dismissed_at timestamptz not null default now(),
  primary key (user_id, announcement_id)
);

alter table public.announcement_dismissals enable row level security;

drop policy if exists "Drivers read their own dismissals" on public.announcement_dismissals;
create policy "Drivers read their own dismissals"
  on public.announcement_dismissals for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Drivers close a banner for themselves" on public.announcement_dismissals;
create policy "Drivers close a banner for themselves"
  on public.announcement_dismissals for insert to authenticated
  with check (auth.uid() = user_id);


-- Undo (only if ever needed — not part of the migration):
--   drop table if exists public.announcement_dismissals;
--   drop table if exists public.announcements;
--   drop table if exists public.campaign_recipients;
--   drop table if exists public.campaigns;
--   drop table if exists public.message_settings;
--   drop table if exists public.email_preferences;
