-- Migration 017: Partial loads
--
-- A partial is a second load that rides in the same trailer as a load
-- already booked — the primary. It is stored as an ordinary row in
-- public.loads with parent_load_id pointing at its primary.
--
-- The one rule everything else follows from: A PARTIAL RECORDS WHAT IT
-- ADDED TO THE TRIP, NOT WHAT IT IS. Its pay is real money and is recorded
-- in full. Its miles are only the extra miles the truck drove because of it
-- — the drive to pick it up, and anything past the primary's delivery — and
-- they are stored as deadhead. If a partial carried its own city-to-city
-- mileage, the truck would be charged for miles it never drove: fuel twice
-- on the shared road, and a month of inflated miles that quietly understates
-- the fixed-cost share of every other load that month.
--
-- Because the extra miles are the only miles on the row, every total that
-- simply adds rows up — the week, the month, the Tax tab, both exports —
-- is already correct. Nothing downstream has to know about partials to
-- avoid double counting.
--
-- What this enforces, in the database rather than only in the app:
-- 1. A partial's primary exists and belongs to the same driver. The foreign
--    key alone would accept ANY load id, including another driver's.
-- 2. A partial's primary is not itself a partial (one level only), and a
--    load that has partials cannot become one.
-- 3. At most two partials per primary. The primary row is locked while it
--    is checked, so two partials saved at the same moment cannot both slip
--    in as the second.
-- 4. A partial has no loaded miles. Its extra miles are deadhead. This also
--    keeps per diem honest: the per-diem suggestion counts a night for a
--    load with 250+ loaded miles, and a partial is not a night on the road.
-- 5. A partial takes its primary's date, and follows it if the primary's
--    date is changed later, so a trip is never split across two weeks.
-- 6. Deleting a primary deletes its partials. A partial left behind would
--    hold only its extra miles and read as a nonsense standalone load.
--
-- ADDITIVE ONLY. Existing loads are untouched: every one starts with a null
-- parent_load_id, which is exactly what a load with no primary is. Safe to
-- run twice. The app tolerates this column being missing — Add Partial
-- simply does not appear until it exists.

-- 1. The link from a partial to its primary.
alter table public.loads
  add column if not exists parent_load_id uuid
  references public.loads (id) on delete cascade;

alter table public.loads
  drop constraint if exists loads_not_own_parent;

alter table public.loads
  add constraint loads_not_own_parent
  check (parent_load_id is null or parent_load_id <> id);

create index if not exists loads_parent_load_id_idx
  on public.loads (parent_load_id)
  where parent_load_id is not null;

-- 2. The rules a partial must satisfy, checked on every insert and update.
create or replace function public.loads_partial_rules()
returns trigger
language plpgsql
as $$
declare
  parent record;
  siblings integer;
begin
  if new.parent_load_id is null then
    return new;
  end if;

  -- Locked, so a concurrent partial on the same primary waits its turn and
  -- then counts this one.
  select id, user_id, load_date, parent_load_id
    into parent
    from public.loads
   where id = new.parent_load_id
     for update;

  if not found or parent.user_id <> new.user_id then
    raise exception 'A partial must belong to one of your own loads.'
      using errcode = 'check_violation';
  end if;

  if parent.parent_load_id is not null then
    raise exception 'A partial cannot be added to another partial.'
      using errcode = 'check_violation';
  end if;

  if exists (select 1 from public.loads where parent_load_id = new.id) then
    raise exception 'A load that has partials cannot become a partial.'
      using errcode = 'check_violation';
  end if;

  select count(*)
    into siblings
    from public.loads
   where parent_load_id = new.parent_load_id
     and id <> new.id;

  if siblings >= 2 then
    raise exception 'A load can carry at most two partials.'
      using errcode = 'check_violation';
  end if;

  if coalesce(new.loaded_miles, 0) <> 0 then
    raise exception 'A partial records its extra miles as deadhead, not loaded miles.'
      using errcode = 'check_violation';
  end if;

  -- The trip's date, not a date of its own.
  new.load_date := parent.load_date;
  return new;
end;
$$;

drop trigger if exists loads_partial_rules on public.loads;
create trigger loads_partial_rules
  before insert or update on public.loads
  for each row execute function public.loads_partial_rules();

-- 3. When a primary's date changes, its partials move with it.
create or replace function public.loads_partials_follow_date()
returns trigger
language plpgsql
as $$
begin
  if new.load_date is distinct from old.load_date then
    update public.loads
       set load_date = new.load_date,
           updated_at = now()
     where parent_load_id = new.id;
  end if;
  return null;
end;
$$;

drop trigger if exists loads_partials_follow_date on public.loads;
create trigger loads_partials_follow_date
  after update of load_date on public.loads
  for each row
  when (new.parent_load_id is null)
  execute function public.loads_partials_follow_date();


-- Undo. Partials hold only their extra miles, so before undoing, delete
-- them or fold their pay into their primary by hand — left as ordinary
-- loads they would be priced as tiny standalone trips.
--   drop trigger if exists loads_partials_follow_date on public.loads;
--   drop function if exists public.loads_partials_follow_date();
--   drop trigger if exists loads_partial_rules on public.loads;
--   drop function if exists public.loads_partial_rules();
--   drop index if exists public.loads_parent_load_id_idx;
--   alter table public.loads drop constraint if exists loads_not_own_parent;
--   alter table public.loads drop column if exists parent_load_id;
