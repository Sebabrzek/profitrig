import type { PerDiemRate, PerDiemSummary } from "./types";

/**
 * DOT 80% rule: a transportation worker subject to DOT hours-of-service can
 * deduct 80% of qualifying per-diem meal/incidental allowances (vs. the 50%
 * rule that applies to most other taxpayers). Source: IRC §274(n)(3).
 */
export const PERDIEM_DEDUCTIBLE_PCT = 0.8;

export type PerDiemPeriodResult = {
  label: string;
  start: string;
  end: string;
  nights: number;
  rate: number;
  notice: string;
  gross: number; // nights * rate
  deductible: number; // gross * 0.80
};

export type PerDiemComputation = {
  periods: PerDiemPeriodResult[];
  totalNights: number;
  totalGross: number;
  totalDeductible: number;
};

/**
 * Two-period split per Phase 1 spec 1.5: a tax year that spans Oct 1
 * straddles the IRS Notice change-over. Period A uses the rate effective
 * the prior Oct 1; Period B uses the rate effective this tax_year's Oct 1.
 *
 * Uses CONUS rate only for Phase 1; OOC nights aren't tracked yet.
 */
export function computePerDiem(
  summary: PerDiemSummary,
  rates: PerDiemRate[],
  taxYear: number
): PerDiemComputation {
  const sorted = [...rates].sort((a, b) =>
    a.effective_date.localeCompare(b.effective_date)
  );

  const periodAEnd = `${taxYear}-09-30`;
  const periodBStart = `${taxYear}-10-01`;

  // Rate effective on Jan 1 of taxYear == latest rate with effective_date
  // strictly before Jan 1 of taxYear.
  const periodARate =
    sorted
      .filter((r) => r.effective_date < `${taxYear}-01-01`)
      .slice(-1)[0] ?? null;

  // Rate effective on Oct 1 of taxYear.
  const periodBRate =
    sorted.find((r) => r.effective_date === periodBStart) ??
    sorted.filter((r) => r.effective_date <= periodBStart).slice(-1)[0] ??
    null;

  const periods: PerDiemPeriodResult[] = [];

  if (periodARate) {
    const gross = summary.period_a_nights * periodARate.conus_rate;
    periods.push({
      label: `Jan 1 – Sep 30, ${taxYear}`,
      start: `${taxYear}-01-01`,
      end: periodAEnd,
      nights: summary.period_a_nights,
      rate: periodARate.conus_rate,
      notice: periodARate.notice ?? "",
      gross,
      deductible: gross * PERDIEM_DEDUCTIBLE_PCT,
    });
  }

  if (periodBRate) {
    const gross = summary.period_b_nights * periodBRate.conus_rate;
    periods.push({
      label: `Oct 1 – Dec 31, ${taxYear}`,
      start: periodBStart,
      end: `${taxYear}-12-31`,
      nights: summary.period_b_nights,
      rate: periodBRate.conus_rate,
      notice: periodBRate.notice ?? "",
      gross,
      deductible: gross * PERDIEM_DEDUCTIBLE_PCT,
    });
  }

  return {
    periods,
    totalNights: periods.reduce((s, p) => s + p.nights, 0),
    totalGross: periods.reduce((s, p) => s + p.gross, 0),
    totalDeductible: periods.reduce((s, p) => s + p.deductible, 0),
  };
}

/**
 * A starting figure for nights away, from the loads the driver has logged.
 * Pure suggestion — the driver confirms or overrides it on the worksheet.
 *
 * It used to count one night per LOAD with 250+ loaded miles. That counted
 * loads, not nights: a two-day haul suggested one night, and two long loads
 * on the same day suggested two. Now it counts DAYS ON THE ROAD:
 *
 *   - A trip is a load plus the extra miles of any partials riding with it
 *     (a partial never starts a trip of its own; its detour lengthens its
 *     primary's).
 *   - A trip is a road trip if its load has 250+ loaded miles — the same
 *     threshold as before, so a local run still counts no night.
 *   - A road trip keeps the truck out for one day per ROAD_MILES_PER_DAY of
 *     its total miles, at least one, starting on its load date.
 *   - Each calendar day covered by any road trip counts once, so loads on
 *     the same or overlapping days are not counted twice.
 *   - Only days inside the tax year count, split at Oct 1 as before. A trip
 *     that starts in late December of the year before can still put nights
 *     into January, so callers should pass those loads too.
 *
 * It is deliberately conservative: days spent waiting between loads are not
 * counted, so it can understate nights but should not overstate them. An
 * overstated deduction is the risky direction with the IRS.
 */
/** Hours-of-service allow 11 hours of driving a day; at a ~50 mph average
 *  that is about 550 miles. */
export const ROAD_MILES_PER_DAY = 550;
/** Below this many loaded miles a load is a local run: home that night. */
export const ROAD_TRIP_LOADED_MILES = 250;

export type LoadDateMiles = {
  id?: string;
  load_date: string;
  loaded_miles: number;
  deadhead_miles?: number;
  /** Set on a partial: its miles are extra miles on this load's trip. */
  parent_load_id?: string | null;
};

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

export function suggestNightsFromLoads(
  loads: LoadDateMiles[],
  taxYear: number
): { periodANights: number; periodBNights: number } {
  const miles = (l: LoadDateMiles) =>
    Math.max(0, Number(l.loaded_miles) || 0) +
    Math.max(0, Number(l.deadhead_miles) || 0);

  // Each partial's extra miles, added to the trip of the load it rode with.
  const extraFor = new Map<string, number>();
  for (const l of loads) {
    if (l.parent_load_id) {
      extraFor.set(l.parent_load_id, (extraFor.get(l.parent_load_id) ?? 0) + miles(l));
    }
  }

  const days = new Set<string>();
  for (const l of loads) {
    if (l.parent_load_id) continue; // part of its primary's trip
    if ((Number(l.loaded_miles) || 0) < ROAD_TRIP_LOADED_MILES) continue;
    const tripMiles = miles(l) + (l.id ? extraFor.get(l.id) ?? 0 : 0);
    const span = Math.max(1, Math.ceil(tripMiles / ROAD_MILES_PER_DAY));
    // Noon UTC, so adding days can never slip across a date line.
    const start = new Date(`${l.load_date}T12:00:00Z`);
    if (Number.isNaN(start.getTime())) continue;
    for (let i = 0; i < span; i++) {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + i);
      days.add(dayKey(d));
    }
  }

  let a = 0;
  let b = 0;
  const year = String(taxYear);
  for (const k of days) {
    if (!k.startsWith(year)) continue;
    if (parseInt(k.slice(5, 7), 10) >= 10) b += 1;
    else a += 1;
  }
  return { periodANights: a, periodBNights: b };
}
