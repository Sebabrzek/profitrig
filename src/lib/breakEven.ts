/**
 * "Is this load worth it?" — break-even and target, for a load and a week.
 *
 * BREAK-EVEN is exactly the cost ProfitRig already shows: for a load, its
 * fuel, tolls, lumpers, per-mile reserves, driver pay and share of the
 * month's fixed bills (computeLoadEconomics); for the Calculator's quick
 * check, the Calculator's cost per mile on every mile. TARGET is that cost
 * plus the profit per mile the driver asked for on the Calculator, on every
 * mile — loaded and deadhead — just as the Calculator's minimum target rate
 * is worked out.
 *
 * A load's break-even and target are said as what the LOAD must pay — the
 * number on a rate con, the number a broker is talked up from. For a leased
 * driver that is grossed up by the carrier's cut, so their share covers it.
 * A week's are said per mile, in the same terms as the week's average rate.
 *
 * Pure arithmetic over figures that are already calculated. Nothing here
 * changes a load's or a week's profit, cost or revenue.
 */

/** Compared to the cent, as profit and loss are (lib/format outcomeOf). */
const cents = (n: number) => Math.round(n * 100) || 0;

export type PayVerdict =
  /** It pays the target or more. */
  | "meets_target"
  /** It covers the cost but falls short of the target. */
  | "under_target"
  /** It covers the cost, and the driver has no profit target set. */
  | "covers_costs"
  /** It pays less than it costs: the load loses money. */
  | "loses";

export type PayCheck = {
  /** What the load must pay to cover its cost. */
  breakEven: number;
  /** What it must pay to also earn the driver's profit per mile. */
  target: number;
  /** False when the driver's profit per mile is 0 — then target = break-even. */
  hasTarget: boolean;
  /** What it pays. */
  pays: number;
  /** Null until there is a pay to judge. */
  verdict: PayVerdict | null;
  /**
   * How far from the line that decides the verdict, always ≥ 0: over the
   * target, under the target, over break-even (no target), or short of
   * break-even.
   */
  gap: number;
};

/**
 * One load, or one quick check: its cost and miles, the driver's profit per
 * mile, the carrier's % (0 for an independent), and what it pays. Null when
 * there is nothing to judge yet (no miles) or the carrier keeps everything.
 */
export function payCheck({
  cost,
  miles,
  desiredProfitPerMile,
  carrierPct,
  pays,
}: {
  cost: number;
  miles: number;
  desiredProfitPerMile: number;
  carrierPct: number;
  pays: number;
}): PayCheck | null {
  if (!(miles > 0) || !Number.isFinite(cost) || cost < 0) return null;
  const pct = Number.isFinite(carrierPct) && carrierPct > 0 ? carrierPct : 0;
  const share = 1 - pct / 100;
  if (share <= 0) return null;
  const perMile = Number.isFinite(desiredProfitPerMile) && desiredProfitPerMile > 0 ? desiredProfitPerMile : 0;
  // Multiply before dividing, as the carrier cut itself is worked out.
  const breakEven = (cost * 100) / (100 - pct);
  const target = ((cost + perMile * miles) * 100) / (100 - pct);
  const hasTarget = cents(target) > cents(breakEven);
  const paid = Number.isFinite(pays) && pays > 0 ? pays : 0;

  let verdict: PayVerdict | null = null;
  let gap = 0;
  if (paid > 0) {
    if (cents(paid) < cents(breakEven)) {
      verdict = "loses";
      gap = breakEven - paid;
    } else if (!hasTarget) {
      verdict = "covers_costs";
      gap = paid - breakEven;
    } else if (cents(paid) < cents(target)) {
      verdict = "under_target";
      gap = target - paid;
    } else {
      verdict = "meets_target";
      gap = paid - target;
    }
  }
  return { breakEven, target, hasTarget, pays: paid, verdict, gap: Math.max(0, gap) };
}

export type WeekRateCheck = {
  /** Cost per mile this week: the average rate that would break even. */
  breakEven: number;
  /** Break-even plus the driver's profit per mile. */
  target: number;
  hasTarget: boolean;
  /** What the week averaged per mile (the week's own avg rate). */
  rate: number;
  verdict: PayVerdict;
  /** Per mile, always ≥ 0, as in PayCheck. */
  gap: number;
};

/**
 * A week, per mile. Break-even is the week's own cost per mile — loads and
 * that week's other expenses — and the rate is its average revenue per mile,
 * both exactly as the week shows them. Null for a week with no miles.
 */
export function weekRateCheck(
  week: { totalMiles: number; rpm: number; cpm: number },
  desiredProfitPerMile: number
): WeekRateCheck | null {
  if (!(week.totalMiles > 0)) return null;
  const perMile = Number.isFinite(desiredProfitPerMile) && desiredProfitPerMile > 0 ? desiredProfitPerMile : 0;
  const breakEven = week.cpm;
  const target = week.cpm + perMile;
  const hasTarget = cents(target) > cents(breakEven);
  const rate = week.rpm;
  let verdict: PayVerdict;
  let gap: number;
  if (cents(rate) < cents(breakEven)) {
    verdict = "loses";
    gap = breakEven - rate;
  } else if (!hasTarget) {
    verdict = "covers_costs";
    gap = rate - breakEven;
  } else if (cents(rate) < cents(target)) {
    verdict = "under_target";
    gap = target - rate;
  } else {
    verdict = "meets_target";
    gap = rate - target;
  }
  return { breakEven, target, hasTarget, rate, verdict, gap: Math.max(0, gap) };
}
