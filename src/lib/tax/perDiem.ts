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
 * Suggest a nights-away count from the user's logged loads in a given tax
 * year. A naive heuristic: each load is one night away if it spans regions
 * (we don't know origin/destination distance precisely here, so we use
 * loaded_miles >= 250 as a "this was an overnight" threshold).
 *
 * Pure suggestion; the user can override on the per-diem worksheet.
 */
export type LoadDateMiles = { load_date: string; loaded_miles: number };

export function suggestNightsFromLoads(
  loads: LoadDateMiles[],
  taxYear: number
): { periodANights: number; periodBNights: number } {
  let a = 0;
  let b = 0;
  for (const l of loads) {
    if (!l.load_date.startsWith(String(taxYear))) continue;
    if ((l.loaded_miles ?? 0) < 250) continue; // skip same-day local runs
    const m = parseInt(l.load_date.slice(5, 7), 10);
    if (m >= 10) b += 1;
    else a += 1;
  }
  return { periodANights: a, periodBNights: b };
}
