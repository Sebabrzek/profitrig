import type { CostProfile } from "@/app/actions";

/**
 * A CostProfile from a row of the `cost_profiles` table, read the way every
 * screen reads it: a figure that is missing or not a number counts as 0, and
 * an override that is missing stays null ("no override").
 *
 * Added for the Admin page, which used to carry its own copy of the cost-per-
 * mile formula — line for line the Calculator's, but with nothing to keep it
 * so. Admin now reads a profile through here and prices it with
 * computeCalculatorTotals, the same function the Calculator runs, so the two
 * cannot drift.
 */
export function costProfileFromRow(r: Record<string, unknown>): CostProfile {
  const n = (k: string) => Number(r[k]) || 0;
  return {
    truck_payment: n("truck_payment"),
    trailer_payment: n("trailer_payment"),
    insurance: n("insurance"),
    eld_subscriptions: n("eld_subscriptions"),
    permits_irp_ifta: n("permits_irp_ifta"),
    office_misc: n("office_misc"),
    load_board_per_month: n("load_board_per_month"),
    other_monthly_bill: n("other_monthly_bill"),
    other_label: typeof r.other_label === "string" ? r.other_label : "",
    monthly_miles: n("monthly_miles"),
    mpg: n("mpg"),
    fuel_price_per_gallon: n("fuel_price_per_gallon"),
    maintenance_per_mile: n("maintenance_per_mile"),
    tires_per_mile: n("tires_per_mile"),
    def_per_mile: n("def_per_mile"),
    driver_pay_per_mile: n("driver_pay_per_mile"),
    tolls_misc_per_mile: n("tolls_misc_per_mile"),
    desired_profit_per_mile: n("desired_profit_per_mile"),
    real_cpm_override:
      r.real_cpm_override == null ? null : Number(r.real_cpm_override),
  };
}
