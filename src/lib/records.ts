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
