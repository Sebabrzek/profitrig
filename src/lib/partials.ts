/**
 * Partial loads: a second load riding in the same trailer as one already
 * booked, the primary.
 *
 * THE RULE: a partial records what it ADDED to the trip, not what it is.
 * Its pay is real money and is recorded in full. Its miles are only the
 * extra miles the truck drove because of it — the drive to pick it up, and
 * anything past the primary's delivery — stored as deadhead, with no loaded
 * miles of its own. If a partial carried its own city-to-city mileage, the
 * truck would be charged for road it never drove, twice over on the shared
 * stretch, and the month's inflated miles would quietly understate the
 * fixed-cost share of every other load in it.
 *
 * Because a partial's row holds only real extra miles, every total that adds
 * rows up — the week, the month, the Tax tab, both exports — is already
 * right, and nothing downstream has to know partials exist. What this module
 * adds is presentation: grouping partials under their primary, and pricing a
 * trip. A partial's numbers on their own are MARGINAL — "$900 for 40 extra
 * miles" — and are always labelled that way, never ranked or shown as a
 * load's rate.
 *
 * Migration 017 enforces the same rules in the database: own primary only,
 * one level, at most two, no loaded miles, the primary's date.
 */
import type { CostProfile } from "@/app/actions";
import { adminEmails } from "./admin";
import { aggregateWeek, type Load, type MonthStats, type WeekTotals } from "./loads";

/** The most partials one primary can carry. Also enforced by migration 017. */
export const MAX_PARTIALS = 2;

/**
 * Who can add partials while they are being tried out. Admins always can;
 * anyone else is named in PARTIAL_LOADS_EMAILS, a comma-separated list in
 * the same shape as ADMIN_EMAILS. Everyone else sees no change at all.
 */
export function partialLoadsEmails(): string[] {
  return (process.env.PARTIAL_LOADS_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function partialsEnabledFor(email: string | null | undefined): boolean {
  if (!email) return false;
  const e = email.toLowerCase();
  return adminEmails().includes(e) || partialLoadsEmails().includes(e);
}

export function isPartial(load: Pick<Load, "parent_load_id">): boolean {
  return Boolean(load.parent_load_id);
}

/**
 * A load made safe to save as a partial of `primary`: the database's rules
 * (no loaded miles, the primary's date) applied before it gets there, plus
 * the app's own — fuel and tolls are always the estimate for its extra
 * miles, so the same road can never be paid for twice by a real trip fuel
 * figure entered on both the primary and the partial.
 */
export function asPartial(
  load: Load,
  primary: Pick<Load, "id" | "load_date">
): Load {
  const extra = Math.max(
    0,
    (Number(load.loaded_miles) || 0) + (Number(load.deadhead_miles) || 0)
  );
  return {
    ...load,
    parent_load_id: primary.id ?? null,
    load_date: primary.load_date,
    loaded_miles: 0,
    deadhead_miles: extra,
    fuel_actual: null,
    tolls_actual: null,
  };
}

/** The extra miles a partial added, which is all the miles it holds. */
export function partialExtraMiles(load: Load): number {
  return (Number(load.loaded_miles) || 0) + (Number(load.deadhead_miles) || 0);
}

export type Trip = {
  primary: Load;
  partials: Load[];
};

/**
 * The loads, grouped into trips in the order their primaries appear, each
 * primary's partials oldest first.
 *
 * DISPLAY ONLY — totals are never taken from this; they come from the rows.
 * A partial whose primary is not in the list (it should not happen, since a
 * partial always carries its primary's date) is still returned, as a trip of
 * its own, so nothing on screen can silently disappear.
 */
export function groupTrips(loads: Load[]): Trip[] {
  const primaryIds = new Set(
    loads.filter((l) => !isPartial(l) && l.id).map((l) => l.id as string)
  );
  const partialsOf = new Map<string, Load[]>();
  for (const l of loads) {
    if (isPartial(l) && primaryIds.has(l.parent_load_id as string)) {
      const list = partialsOf.get(l.parent_load_id as string) ?? [];
      list.push(l);
      partialsOf.set(l.parent_load_id as string, list);
    }
  }
  const trips: Trip[] = [];
  for (const l of loads) {
    if (isPartial(l) && primaryIds.has(l.parent_load_id as string)) continue;
    // Partials keep the order of the list they came from, so they read the
    // same way as everything around them: newest first on the Loads page,
    // oldest first in an export.
    trips.push({ primary: l, partials: l.id ? partialsOf.get(l.id) ?? [] : [] });
  }
  return trips;
}

/**
 * What a whole trip made: every row priced exactly as the week prices it,
 * then summed — literally the week's own arithmetic over just these rows —
 * so a trip can never disagree with the week it sits in.
 */
export function tripTotals(
  trip: Trip,
  profile: CostProfile,
  months?: Map<string, MonthStats>,
  now?: Date
): WeekTotals {
  return aggregateWeek(
    [trip.primary, ...trip.partials],
    profile,
    months,
    0,
    now
  );
}

/** "Landstar · Laredo, TX → Memphis, TN" — how a partial names its primary. */
export function tripLabel(
  load: Pick<Load, "broker" | "origin" | "destination">
): string {
  const who = load.broker.trim() || "your load";
  const route =
    load.origin.trim() || load.destination.trim()
      ? ` · ${load.origin.trim() || "—"} → ${load.destination.trim() || "—"}`
      : "";
  return `${who}${route}`;
}

export function countPartials(loads: Load[]): number {
  return loads.filter(isPartial).length;
}
