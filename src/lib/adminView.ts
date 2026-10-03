/**
 * What the Admin page shows about one driver, so Sebastian can sit with a
 * driver's numbers — and catch entry mistakes — without their password.
 *
 * READ-ONLY and DISPLAY-ONLY. Nothing here introduces a formula: a week is
 * priced by aggregateWeek and a load by computeLoadEconomics, exactly as the
 * driver's own Loads tab prices them, so Admin can never show a driver a
 * different number than they see themselves.
 *
 * The checks are prompts, not verdicts. Each one is a pattern that has
 * produced a wrong number before, or would — a load typed as 104 miles
 * instead of 1,040, a partial given its whole trip as "extra miles", the same
 * load saved twice. They say "worth a look", and a driver may well be right.
 */
import type { CostProfile } from "@/app/actions";
import type { CalculatorTotals } from "./calculatorTotals";
import {
  aggregateWeek,
  isoDate,
  monthStatsByLoad,
  startOfWeek,
  type Load,
  type LoadEconomics,
  type WeekStart,
  type WeekTotals,
} from "./loads";
import { isPartial, partialExtraMiles } from "./partials";
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
 * Loads that look like the same freight saved twice: within a day of each
 * other, the same pay, and the same broker or the same destination. A
 * partial and the load it rides with are never paired — they are meant to
 * look alike.
 */
export function findLookalikes(loads: Load[]): Map<string, string> {
  const out = new Map<string, string>();
  const pay = (l: Load) =>
    (Number(l.linehaul_pay) || 0) + (Number(l.fuel_surcharge) || 0) + (Number(l.accessorials) || 0);
  const same = (a: string, b: string) => a.trim() !== "" && a.trim().toLowerCase() === b.trim().toLowerCase();
  for (let i = 0; i < loads.length; i++) {
    for (let j = i + 1; j < loads.length; j++) {
      const a = loads[i], b = loads[j];
      if (!a.id || !b.id) continue;
      if (a.parent_load_id === b.id || b.parent_load_id === a.id) continue;
      const days = Math.abs(dateOf(a.load_date).getTime() - dateOf(b.load_date).getTime()) / 86_400_000;
      if (days > 1 || pay(a) <= 0 || pay(a) !== pay(b)) continue;
      if (same(a.broker, b.broker) || same(a.destination, b.destination)) {
        out.set(a.id, b.id);
        out.set(b.id, a.id);
      }
    }
  }
  return out;
}

export type LoadCheckContext = {
  /** What fuel would cost on this load's miles at the driver's MPG. */
  fuelEstimate: number;
  /** The primary's total miles, when this load is a partial. */
  primaryMiles?: number;
  /** Another load that looks like this one, if any. */
  lookalike?: boolean;
  /** Today on the reviewer's calendar, YYYY-MM-DD. */
  today: string;
};

/** Patterns worth a second look on one load. Empty when nothing stands out. */
export function loadChecks(load: Load, e: LoadEconomics, ctx: LoadCheckContext): string[] {
  const out: string[] = [];
  const partial = isPartial(load);
  const loaded = Number(load.loaded_miles) || 0;
  const deadhead = Number(load.deadhead_miles) || 0;

  if (e.loadPay <= 0) out.push("No pay entered");
  if (!partial && e.totalMiles === 0) out.push("No miles entered");
  if (!partial && loaded > 0 && deadhead > loaded) out.push("More deadhead than loaded miles");
  if (!partial && e.totalMiles > 0 && e.loadPay > 0) {
    const rate = e.loadPay / e.totalMiles;
    if (rate < 1 || rate > 8) out.push(`Pay works out to $${rate.toFixed(2)}/mi — check the miles or the pay`);
  }
  if (partial) {
    const extra = partialExtraMiles(load);
    const base = ctx.primaryMiles ?? 0;
    if (extra > Math.max(150, 0.25 * base)) {
      out.push(`${extra.toLocaleString("en-US")} extra miles — confirm that's the detour, not the partial's whole trip`);
    }
  }
  if (load.fuel_actual != null && ctx.fuelEstimate > 0) {
    const ratio = load.fuel_actual / ctx.fuelEstimate;
    if (ratio < 0.3 || ratio > 3) {
      out.push(`Fuel entered is ${Math.round(ratio * 100)}% of what these miles burn at their MPG`);
    }
  }
  const lumpers = Number(load.lumpers_actual) || 0;
  if (lumpers > 0 && e.loadPay > 0 && lumpers > 0.5 * e.loadPay) out.push("Lumpers are more than half the pay");
  if (load.load_date > ctx.today) out.push("Dated in the future");
  if (ctx.lookalike) out.push("Looks like another load — possibly saved twice");
  return out;
}

/**
 * Patterns worth a second look in the Calculator inputs. `fuelLogMpg` is the
 * average from their Fuel tab, when they keep one: the Calculator's MPG
 * prices fuel on every load, so it should agree with what the truck gets.
 */
export function profileChecks(
  p: CostProfile,
  t: CalculatorTotals,
  fuelLogMpg?: number | null
): string[] {
  const out: string[] = [];
  if (p.monthly_miles <= 0) out.push("Monthly miles not set — every fixed cost per mile depends on it");
  else if (p.monthly_miles < 2000 || p.monthly_miles > 20000) out.push(`${p.monthly_miles.toLocaleString("en-US")} monthly miles is unusual for a truck`);
  if (p.mpg <= 0) out.push("MPG not set — fuel is costed at $0");
  else if (p.mpg < 4 || p.mpg > 10) out.push(`${p.mpg} MPG is unusual for a semi`);
  if (p.fuel_price_per_gallon <= 0) out.push("Fuel price not set — fuel is costed at $0");
  else if (p.fuel_price_per_gallon < 2 || p.fuel_price_per_gallon > 7) out.push(`$${p.fuel_price_per_gallon}/gal is an unusual diesel price`);
  if (p.mpg > 0 && fuelLogMpg != null && fuelLogMpg > 0 && Math.abs(p.mpg - fuelLogMpg) / fuelLogMpg > 0.1) {
    out.push(`Calculator says ${p.mpg} MPG; their fuel log averages ${fuelLogMpg.toFixed(1)}`);
  }
  if (p.insurance <= 0) out.push("Insurance is $0");
  if (p.real_cpm_override != null && p.real_cpm_override > 0 && t.computedCPM > 0) {
    const diff = (p.real_cpm_override - t.computedCPM) / t.computedCPM;
    if (Math.abs(diff) > 0.25) {
      out.push(`Their manual cost per mile is ${Math.round(Math.abs(diff) * 100)}% ${diff > 0 ? "above" : "below"} what their own inputs calculate`);
    }
  }
  return out;
}
