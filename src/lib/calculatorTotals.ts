import type { CostProfile } from "@/app/actions";

/**
 * The Calculator tab's own arithmetic, lifted out of Calculator.tsx's
 * useMemo so it can be tested. The formulas are unchanged, line for line.
 *
 * Why it moved: the redesign rewrites Calculator.tsx's markup, and this is
 * the one place in the app where financial arithmetic lived inside a React
 * component with no test around it. A test can only prove the numbers
 * survive a visual rewrite if it runs the same code the screen runs.
 *
 * What did NOT change: the fixed-cost sum below is still the Calculator's
 * own copy. The other two — computeTotals in app/actions.ts and
 * sumFixedMonthly in lib/loads.ts — are untouched. Consolidating the three
 * is a separate job with its own tests, not part of a visual phase.
 */
export type CalculatorTotals = {
  fixed: number;
  fuelPerMile: number;
  variablePerMile: number;
  fixedPerMile: number;
  computedCPM: number;
  totalCPM: number;
  requiredRate: number;
  breakEven: number;
  projectedProfit: number;
};

export function computeCalculatorTotals(p: CostProfile): CalculatorTotals {
  const fixed =
    p.truck_payment +
    p.trailer_payment +
    p.insurance +
    p.eld_subscriptions +
    p.permits_irp_ifta +
    p.office_misc +
    p.load_board_per_month +
    p.other_monthly_bill;

  const fuelPerMile = p.mpg > 0 ? p.fuel_price_per_gallon / p.mpg : 0;
  const variablePerMile =
    fuelPerMile +
    p.maintenance_per_mile +
    p.tires_per_mile +
    p.def_per_mile +
    p.driver_pay_per_mile +
    p.tolls_misc_per_mile;

  const fixedPerMile = p.monthly_miles > 0 ? fixed / p.monthly_miles : 0;
  const computedCPM = fixedPerMile + variablePerMile;
  // Phase 0.2: when the user has tapped "Update my estimate", we display
  // and use the override instead of the freshly-computed total.
  const totalCPM =
    p.real_cpm_override != null && p.real_cpm_override > 0
      ? p.real_cpm_override
      : computedCPM;
  const requiredRate = totalCPM + p.desired_profit_per_mile;
  const breakEven = totalCPM * p.monthly_miles;
  const projectedProfit = p.desired_profit_per_mile * p.monthly_miles;

  return {
    fixed,
    fuelPerMile,
    variablePerMile,
    fixedPerMile,
    computedCPM,
    totalCPM,
    requiredRate,
    breakEven,
    projectedProfit,
  };
}
