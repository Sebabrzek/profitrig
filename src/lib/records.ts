/**
 * What ProfitRig's records say — the words and numbers on a load, a fuel
 * week, a road expense — kept apart from how they are drawn, so every
 * record's presentation is tested (npm test).
 *
 * DISPLAY ONLY. Every number here arrives already calculated (lib/loads,
 * lib/fuel); these functions only format it with lib/format.
 */
import { formatMoney, formatRate, outcomeOf } from "./format";
import type { FuelEntry } from "./fuel";
import type { PayCheck, WeekRateCheck } from "./breakEven";

/** 20 → "20%", 17.5 → "17.5%" — the same label the Loads page uses. */
function pctLabel(n: number): string {
  return `${Number(n.toFixed(2))}%`;
}

/** The subset of a load's economics a record shows (computeLoadEconomics). */
export type LoadRecordEconomics = {
  totalMiles: number;
  deadheadPct: number;
  revenue: number;
  carrierPct: number;
  loadPay: number;
  rpm: number;
  totalCost: number;
  cpm: number;
  profit: number;
};

export function loadRecordFigures(e: LoadRecordEconomics) {
  return {
    miles: e.totalMiles.toLocaleString(),
    deadhead: `${e.deadheadPct.toFixed(0)}% deadhead`,
    revenue: formatMoney(e.revenue),
    /** A leased driver's share, as the list has always shown it. */
    share:
      e.carrierPct > 0
        ? `${pctLabel(100 - e.carrierPct)} of ${formatMoney(e.loadPay)}`
        : null,
    rate: formatRate(e.rpm, { unit: "mi" }),
    cost: formatMoney(e.totalCost),
    costRate: formatRate(e.cpm, { unit: "mi" }),
    /** "+$987.33", "−$142" or "$0" — a break-even load is neither. */
    profit: formatMoney(e.profit, { signed: true }),
    outcome: outcomeOf(e.profit),
  };
}

/**
 * A partial as it sits under its primary. Its numbers are MARGINAL — what
 * it added to the trip — so they are said as additions ("+40 mi", "adds
 * +$612") and never laid out in the ledger's Revenue / Cost / Profit
 * columns, where they would read as a load's own rate.
 */
export function partialRecordFigures(e: LoadRecordEconomics) {
  return {
    extraMiles: `+${e.totalMiles.toLocaleString()} mi`,
    pay: formatMoney(e.revenue),
    share:
      e.carrierPct > 0
        ? `${pctLabel(100 - e.carrierPct)} of ${formatMoney(e.loadPay)}`
        : null,
    adds: formatMoney(e.profit, { signed: true }),
    outcome: outcomeOf(e.profit),
  };
}

/** A whole trip — a primary and its partials — as one line of totals. */
export type TripLineTotals = {
  totalMiles: number;
  revenue: number;
  rpm: number;
  profit: number;
};

export function tripLineFigures(t: TripLineTotals, partials: number) {
  return {
    label: partials === 1 ? "Trip with 1 partial" : `Trip with ${partials} partials`,
    miles: `${t.totalMiles.toLocaleString()} mi`,
    revenue: formatMoney(t.revenue),
    rate: formatRate(t.rpm, { unit: "mi" }),
    profit: formatMoney(t.profit, { signed: true }),
    outcome: outcomeOf(t.profit),
  };
}

/**
 * A fuel week's reading and state. A measured week shows its MPG as a
 * reading; a state (starting point, check, odometer) is said in words.
 */
export function fuelEntryPresentation(entry: Pick<FuelEntry, "status" | "mpg">): {
  /** "6.6" — shown with its "MPG" unit. */
  mpg: string | null;
  state: { label: string; tone: "neutral" | "loss"; title?: string } | null;
} {
  const mpg = entry.mpg == null ? null : entry.mpg.toFixed(1);
  switch (entry.status) {
    case "ok":
      return { mpg, state: null };
    case "check":
      return {
        mpg,
        state: {
          label: "Check",
          tone: "loss",
          title:
            "No semi gets this MPG. Check the odometer and gallons — or it was a partial fill, which evens out in your average.",
        },
      };
    case "baseline":
      return { mpg: null, state: { label: "Starting point", tone: "neutral" } };
    case "odometer":
      return { mpg: null, state: { label: "Odometer too low", tone: "loss" } };
  }
}

/** "Delete Food / meals, $18.40, 9/15" — which expense, not just "expense". */
export function roadExpenseDeleteLabel(
  category: string,
  amount: number,
  dateLabel: string
): string {
  return `Delete ${category}, ${formatMoney(amount)}, ${dateLabel}`;
}

/**
 * A load's break-even and target, as words (lib/breakEven). Amounts are what
 * the LOAD must pay; the verdict starts from what it pays, so a driver reads
 * it the way they'd talk to a broker: "Pays $1,600 — covers your costs,
 * $180 under your target."
 */
export function payCheckFigures(c: PayCheck) {
  const gap = formatMoney(c.gap);
  const pays = `Pays ${formatMoney(c.pays)}`;
  let verdict: string | null = null;
  switch (c.verdict) {
    case "meets_target":
      verdict = c.gap > 0.004 ? `${pays} — meets your target, with ${gap} to spare.` : `${pays} — right on your target.`;
      break;
    case "under_target":
      verdict = `${pays} — covers your costs, ${gap} under your target.`;
      break;
    case "covers_costs":
      verdict = c.gap > 0.004 ? `${pays} — covers your costs, with ${gap} to spare.` : `${pays} — exactly break-even.`;
      break;
    case "loses":
      verdict = `${pays} — ${gap} short of break-even. This load loses money.`;
      break;
  }
  return {
    breakEven: formatMoney(c.breakEven),
    /** Null when the driver has no profit per mile set: target = break-even. */
    target: c.hasTarget ? formatMoney(c.target) : null,
    verdict,
    /** For the verdict's tone: a loss is said as one (with words, not only colour). */
    outcome: c.verdict === "loses" ? ("loss" as const) : c.verdict === "meets_target" ? ("profit" as const) : undefined,
  };
}

/** A per-mile gap the way drivers say it: "18¢" under a dollar, "$1.05" from one up. */
export function perMileGap(n: number): string {
  const c = Math.round(Math.abs(n) * 100) || 0;
  return c < 100 ? `${c}¢` : formatRate(Math.abs(n));
}

/** A week's break-even and target per mile, and how its average rate did. */
export function weekRateFigures(w: WeekRateCheck) {
  const avg = `You averaged ${formatRate(w.rate, { unit: "mi" })}`;
  const gap = `${perMileGap(w.gap)} a mile`;
  const exact = w.gap < 0.005;
  let verdict: string;
  switch (w.verdict) {
    case "meets_target":
      verdict = exact ? `${avg} — right on your target.` : `${avg} — ${gap} over your target.`;
      break;
    case "under_target":
      verdict = `${avg} — ${gap} under your target.`;
      break;
    case "covers_costs":
      verdict = exact ? `${avg} — exactly break-even.` : `${avg} — ${gap} over break-even.`;
      break;
    case "loses":
      verdict = `${avg} — ${gap} below break-even.`;
      break;
  }
  return {
    breakEven: formatRate(w.breakEven),
    target: w.hasTarget ? formatRate(w.target) : null,
    verdict,
    outcome: w.verdict === "loses" ? ("loss" as const) : w.verdict === "meets_target" ? ("profit" as const) : undefined,
  };
}
