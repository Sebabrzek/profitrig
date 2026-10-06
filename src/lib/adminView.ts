/**
 * What the Admin page shows about one driver, so Sebastian can sit with a
 * driver's numbers — and catch entry mistakes — without their password.
 *
 * READ-ONLY and DISPLAY-ONLY. Nothing here introduces a formula: a week is
 * priced by aggregateWeek and a load by computeLoadEconomics, exactly as the
 * driver's own Loads tab prices them, so Admin can never show a driver a
 * different number than they see themselves.
 *
 * The checks themselves live in lib/checks, because drivers see them too.
 */
import type { CostProfile } from "@/app/actions";
import {
  aggregateWeek,
  isoDate,
  monthStatsByLoad,
  startOfWeek,
  type Load,
  type WeekStart,
  type WeekTotals,
} from "./loads";
import { isPartial } from "./partials";
import { sumRoadExpenses, type RoadExpense } from "./roadExpenses";

export type AdminWeek = {
  /** YYYY-MM-DD, the first day of the week in the DRIVER's own week setting. */
  weekStart: string;
  loads: Load[];
  partials: number;
  roadExpenses: RoadExpense[];
  totals: WeekTotals;
};

const dateOf = (iso: string) => new Date(`${iso}T12:00:00`);
const weekKey = (iso: string, weekStartsOn: WeekStart) =>
  isoDate(startOfWeek(dateOf(iso), weekStartsOn));

/**
 * Every week the driver has anything in, newest first, each priced by the
 * week's own arithmetic with fixed costs spread over each load's whole month
 * — the same inputs the Loads tab hands aggregateWeek.
 */
export function adminWeeks(
  loads: Load[],
  roadExpenses: RoadExpense[],
  profile: CostProfile,
  weekStartsOn: WeekStart,
  now: Date
): AdminWeek[] {
  const months = monthStatsByLoad(loads);
  const byWeek = new Map<string, { loads: Load[]; road: RoadExpense[] }>();
  const slot = (k: string) => {
    let s = byWeek.get(k);
    if (!s) byWeek.set(k, (s = { loads: [], road: [] }));
    return s;
  };
  for (const l of loads) if (l.load_date) slot(weekKey(l.load_date, weekStartsOn)).loads.push(l);
  for (const r of roadExpenses) if (r.spent_on) slot(weekKey(r.spent_on, weekStartsOn)).road.push(r);

  return [...byWeek.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([weekStart, s]) => ({
      weekStart,
      loads: s.loads,
      partials: s.loads.filter(isPartial).length,
      roadExpenses: s.road,
      totals: aggregateWeek(s.loads, profile, months, sumRoadExpenses(s.road), now),
    }));
}

/**
 * A note to a driver about what is worth a look, for Sebastian to send from
 * his OWN email — ProfitRig stores and sends nothing. He edits it
 * before it goes; this only saves him typing it.
 */
export function driverNote({
  firstName,
  weekLabel,
  items,
  from,
}: {
  firstName: string;
  /** "Sep 21 – 27", or null when there is no week in view. */
  weekLabel: string | null;
  items: { where?: string; text: string }[];
  from: string;
}): { subject: string; body: string } {
  const hi = `Hi ${firstName.trim() || "there"} —`;
  const MAX_ITEMS = 8;
  const shown = items.slice(0, MAX_ITEMS).map((i) => `• ${i.where ? `${i.where}: ` : ""}${i.text}`);
  const more = items.length > MAX_ITEMS ? [`…and ${items.length - MAX_ITEMS} more.`] : [];
  const lead = items.length
    ? `I was going over your numbers${weekLabel ? ` for the week of ${weekLabel}` : ""} and a few things are worth a look:`
    : `I was going over your numbers${weekLabel ? ` for the week of ${weekLabel}` : ""} and wanted to check in.`;
  return {
    subject: `Your ProfitRig numbers${weekLabel ? ` — week of ${weekLabel}` : ""}`,
    body: [hi, "", lead, ...(items.length ? ["", ...shown, ...more] : []), "", `— ${from}`].join("\n"),
  };
}

/** Opens the reviewer's own mail app. */
export function mailtoHref(to: string, subject: string, body: string): string {
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Opens a Gmail draft in the browser, for anyone who lives in Gmail. */
export function gmailHref(to: string, subject: string, body: string): string {
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
