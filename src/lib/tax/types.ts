/**
 * Phase 1 (Tax Pack) types.
 *
 * Everything under src/lib/tax/* deals exclusively with the TAX lens:
 * actual dollars only. These types must never carry management-lens
 * concepts (driver_pay_per_mile reserves, allocated fixed costs, etc.).
 */

export type EntityType = "sole_prop" | "smllc" | "s_corp";
export type TruckFinancing = "owned_financed" | "owned_outright" | "leased";

export type TaxProfile = {
  entity_type: EntityType | null;
  has_hired_driver: boolean;
  truck_financing: TruckFinancing | null;
};

export const EMPTY_TAX_PROFILE: TaxProfile = {
  entity_type: null,
  has_hired_driver: false,
  truck_financing: null,
};

export type ExpenseCategory =
  | "insurance_premiums"
  | "permits_licenses"
  | "eld_subscription"
  | "load_board"
  | "truck_loan_interest"
  | "lease_payments"
  | "tires"
  | "repairs_maintenance"
  | "factoring_fees"
  | "phone_data"
  | "tools_small_equipment"
  | "cdl_dot_medical_training"
  | "accountant_legal_fees"
  | "other";

export type Expense = {
  id?: string;
  expense_date: string; // YYYY-MM-DD
  category: ExpenseCategory;
  amount: number;
  vendor: string;
  note: string;
};

export function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export const EMPTY_EXPENSE: Expense = {
  expense_date: todayIso(),
  category: "other",
  amount: 0,
  vendor: "",
  note: "",
};

export type CapitalAsset = {
  id?: string;
  description: string;
  placed_in_service: string; // YYYY-MM-DD
  cost: number;
};

export const EMPTY_CAPITAL_ASSET: CapitalAsset = {
  description: "",
  placed_in_service: todayIso(),
  cost: 0,
};

export type PerDiemRate = {
  effective_date: string; // YYYY-MM-DD
  conus_rate: number;
  ooc_rate: number;
  notice: string;
};

export type PerDiemSummary = {
  tax_year: number;
  period_a_nights: number;
  period_b_nights: number;
};

export function emptyPerDiemSummary(year: number): PerDiemSummary {
  return { tax_year: year, period_a_nights: 0, period_b_nights: 0 };
}

/**
 * Drives whether "driver pay" appears in the Tax Pack and under which Schedule
 * C line. The management lens (driver_pay_per_mile etc.) NEVER flows into the
 * tax export — this purely controls whether to surface a wages/contract-labor
 * line item the user enters via an Expense, or to exclude the concept
 * entirely.
 *
 * Rules (see Phase 1 spec 1.2):
 *  - sole_prop or smllc, owner-driver only           -> owner_draw_excluded
 *  - sole_prop or smllc, with hired driver           -> wages_or_1099
 *  - s_corp owner takes W-2 wages                    -> owner_w2_wages
 */
export type DriverPayTreatment =
  | "owner_draw_excluded"
  | "wages_or_1099"
  | "owner_w2_wages";

export function driverPayTreatment(p: TaxProfile): DriverPayTreatment {
  if (p.entity_type === "s_corp") return "owner_w2_wages";
  if (p.has_hired_driver) return "wages_or_1099";
  return "owner_draw_excluded";
}

export function entityTypeLabel(t: EntityType | null): string {
  switch (t) {
    case "sole_prop":
      return "Sole proprietor";
    case "smllc":
      return "Single-member LLC";
    case "s_corp":
      return "S-corporation";
    default:
      return "Not set";
  }
}

export function truckFinancingLabel(t: TruckFinancing | null): string {
  switch (t) {
    case "owned_financed":
      return "Owned, financed";
    case "owned_outright":
      return "Owned outright";
    case "leased":
      return "Leased";
    default:
      return "Not set";
  }
}
