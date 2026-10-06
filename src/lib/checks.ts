/**
 * Loads worth a second look — shown to the driver as alerts (Loads page and
 * load form) and to Sebastian on Admin, in the same words.
 *
 * Each check is a pattern that has produced a wrong number before, or would:
 * a load typed as 104 miles instead of 1,040, a partial given its whole trip
 * as "extra miles", the same freight saved twice. They are prompts, not
 * verdicts — "worth a look" — and a driver may well be right, which is why
 * each can be marked "this is right".
 *
 * A mark is stored as the alert's EXACT wording (loads.dismissed_checks,
 * migration 018). The wording carries the figure — "$9.40/mi", "600 extra
 * miles" — so if the driver changes the miles or the pay, the wording
 * changes, the mark no longer matches, and the alert comes back. A stale
 * "this is right" can never hide a new problem.
 */
import type { CostProfile } from "@/app/actions";
import type { CalculatorTotals } from "./calculatorTotals";
import type { Load, LoadEconomics } from "./loads";
import { isPartial, partialExtraMiles } from "./partials";

const dateOf = (iso: string) => new Date(`${iso}T12:00:00`);

/**
 * The one alert that needs the driver's OTHER loads to work out, so the load
 * form — which sees a single load — keeps any mark on it rather than drop it.
 */
export const LOOKALIKE_CHECK = "Looks like another load — possibly saved twice";

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
      out.push(`Fuel entered is ${Math.round(ratio * 100)}% of what these miles burn at the Calculator's MPG`);
    }
  }
  const lumpers = Number(load.lumpers_actual) || 0;
  if (lumpers > 0 && e.loadPay > 0 && lumpers > 0.5 * e.loadPay) out.push("Lumpers are more than half the pay");
  if (load.load_date > ctx.today) out.push("Dated in the future");
  if (ctx.lookalike) out.push(LOOKALIKE_CHECK);
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
    out.push(`The Calculator uses ${p.mpg} MPG; the fuel log averages ${fuelLogMpg.toFixed(1)}`);
  }
  if (p.insurance <= 0) out.push("Insurance is $0");
  if (p.real_cpm_override != null && p.real_cpm_override > 0 && t.computedCPM > 0) {
    const diff = (p.real_cpm_override - t.computedCPM) / t.computedCPM;
    if (Math.abs(diff) > 0.25) {
      out.push(`The manual cost per mile is ${Math.round(Math.abs(diff) * 100)}% ${diff > 0 ? "above" : "below"} what the Calculator inputs work out to`);
    }
  }
  return out;
}

/** The most marks one load keeps; also enforced by migration 018. */
export const MAX_DISMISSED_CHECKS = 20;

/**
 * Split a load's alerts into the ones still open and the ones the driver
 * has marked right — by exact wording, so a changed figure reopens it.
 */
export function openChecks(
  checks: string[],
  dismissed: readonly string[] | null | undefined
): { open: string[]; confirmed: string[] } {
  const marked = new Set(dismissed ?? []);
  return {
    open: checks.filter((c) => !marked.has(c)),
    confirmed: checks.filter((c) => marked.has(c)),
  };
}

/**
 * The marks worth keeping when a load is saved: only ones that still match
 * an alert, short, and no more than the column allows. Anything else — a
 * mark whose figure has since changed, or junk from a crafted request — is
 * dropped.
 */
export function keepDismissals(
  dismissed: readonly unknown[] | null | undefined,
  stillFiring: readonly string[] | null
): string[] {
  const firing = stillFiring ? new Set(stillFiring) : null;
  const out: string[] = [];
  for (const d of dismissed ?? []) {
    if (typeof d !== "string" || d.length === 0 || d.length > 300) continue;
    if (firing && !firing.has(d)) continue;
    if (!out.includes(d)) out.push(d);
    if (out.length >= MAX_DISMISSED_CHECKS) break;
  }
  return out;
}
