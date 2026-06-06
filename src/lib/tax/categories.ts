import type { ExpenseCategory } from "./types";

/**
 * Spec 1.7 — suggested Schedule C mapping. Marked everywhere in UI as
 * "CPA-confirmable" because final line placement is the accountant's call.
 */
export type CategoryMeta = {
  key: ExpenseCategory;
  label: string;
  scheduleC: string;
  scheduleCLine: string;
  hint?: string;
};

export const CATEGORIES: CategoryMeta[] = [
  {
    key: "insurance_premiums",
    label: "Insurance premiums",
    scheduleC: "Insurance (other than health) — line 15",
    scheduleCLine: "15",
    hint: "Truck/cargo/liability/physical-damage/bobtail. Health insurance is its own line on Form 1040, not here.",
  },
  {
    key: "permits_licenses",
    label: "Permits / licenses / IFTA / IRP / 2290 (HVUT)",
    scheduleC: "Taxes & licenses — line 23",
    scheduleCLine: "23",
    hint: "Includes the annual HVUT (Form 2290) for trucks 55,000 lbs+.",
  },
  {
    key: "eld_subscription",
    label: "ELD subscription",
    scheduleC: "Other expenses — line 27a",
    scheduleCLine: "27a",
  },
  {
    key: "load_board",
    label: "Load board subscription",
    scheduleC: "Other expenses — line 27a",
    scheduleCLine: "27a",
    hint: "DAT, Truckstop, 123Loadboard, etc.",
  },
  {
    key: "truck_loan_interest",
    label: "Truck loan interest (annual)",
    scheduleC: "Interest — Other — line 16b",
    scheduleCLine: "16b",
    hint: "INTEREST only — pull from your lender's year-end statement. The principal is recovered via depreciation / §179 on the asset, not here.",
  },
  {
    key: "lease_payments",
    label: "Lease payments",
    scheduleC: "Rent or lease — vehicles, machinery, equip — line 20a",
    scheduleCLine: "20a",
    hint: "Only if the truck is leased (not financed). For financed trucks the payment is not a deduction.",
  },
  {
    key: "tires",
    label: "Tires",
    scheduleC: "Supplies — line 22",
    scheduleCLine: "22",
  },
  {
    key: "repairs_maintenance",
    label: "Repairs & maintenance",
    scheduleC: "Repairs & maintenance — line 21",
    scheduleCLine: "21",
  },
  {
    key: "factoring_fees",
    label: "Factoring fees",
    scheduleC: "Other expenses — line 27a (CPA may use Commissions & fees — line 10)",
    scheduleCLine: "27a",
    hint: "Commonly forgotten — pull these from your factor's monthly statements.",
  },
  {
    key: "phone_data",
    label: "Phone / data",
    scheduleC: "Other expenses — line 27a",
    scheduleCLine: "27a",
  },
  {
    key: "tools_small_equipment",
    label: "Tools & small equipment",
    scheduleC: "Supplies — line 22",
    scheduleCLine: "22",
  },
  {
    key: "cdl_dot_medical_training",
    label: "CDL / DOT medical / training",
    scheduleC: "Other expenses — line 27a",
    scheduleCLine: "27a",
  },
  {
    key: "accountant_legal_fees",
    label: "Accountant / legal fees",
    scheduleC: "Legal & professional services — line 17",
    scheduleCLine: "17",
  },
  {
    key: "other",
    label: "Other",
    scheduleC: "Other expenses — line 27a",
    scheduleCLine: "27a",
    hint: "Use the note field to explain. Your CPA will place it.",
  },
];

export function categoryMeta(key: ExpenseCategory): CategoryMeta {
  return (
    CATEGORIES.find((c) => c.key === key) ??
    CATEGORIES[CATEGORIES.length - 1]
  );
}

// Schedule C suggestions for load-derived actuals (loads/load.fuel_actual,
// load.tolls_actual, load.lumpers_actual).
export const LOAD_ACTUAL_CATEGORIES = {
  fuel: {
    label: "Fuel + DEF (from loads)",
    scheduleC: "Car & truck expenses — line 9 (or Supplies — line 22)",
    scheduleCLine: "9",
  },
  tolls: {
    label: "Tolls (from loads)",
    scheduleC: "Other expenses — line 27a",
    scheduleCLine: "27a",
  },
  lumpers: {
    label: "Lumpers (from loads)",
    scheduleC: "Other expenses — line 27a",
    scheduleCLine: "27a",
  },
};

export type CategoryTotalsByLine = Map<string, { line: string; label: string; amount: number }>;
