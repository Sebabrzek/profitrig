import type { ExpenseCategory } from "./tax/types";

/**
 * On-the-road expenses: money spent during the week that isn't tied to a
 * single load. Entered on the Loads tab, grouped by week.
 *
 * TWO-LENS NOTE — this file deliberately carries the bridge between the two
 * lenses, and the bridge is only safe because every road expense is an
 * ACTUAL dollar amount (a real receipt), never an estimate or allocation:
 *
 *   management lens → the whole week's total comes off that week's profit
 *   tax lens        → each row maps to a tax category via `taxCategory`
 *
 * `taxCategory: null` means "never export this to the tax report." Today
 * that is meals only: the per-diem worksheet already accounts for meals
 * using the IRS standard allowance, so exporting food receipts as well
 * would report meals to the accountant twice.
 */

export type RoadExpenseCategory =
  | "meals"
  | "truck_wash"
  | "supplies"
  | "repair"
  | "parking"
  | "shower_laundry"
  | "scale"
  | "motel"
  | "other";

export type RoadExpense = {
  id?: string;
  spent_on: string; // YYYY-MM-DD
  category: RoadExpenseCategory;
  amount: number;
  note: string;
};

export type RoadCategoryMeta = {
  key: RoadExpenseCategory;
  label: string;
  /** Short label for the quick-pick chip. */
  chip: string;
  /** Tax category this maps to, or null to keep it out of the tax report. */
  taxCategory: ExpenseCategory | null;
  /** Shown under the chip list when selected. */
  hint?: string;
};

export const ROAD_CATEGORIES: RoadCategoryMeta[] = [
  {
    key: "meals",
    label: "Food / meals",
    chip: "Food",
    taxCategory: null,
    hint: "Counted in your weekly profit. Meals are not sent to the tax report — your per-diem worksheet already covers them.",
  },
  {
    key: "truck_wash",
    label: "Truck wash",
    chip: "Truck wash",
    taxCategory: "repairs_maintenance",
  },
  {
    key: "supplies",
    label: "Supplies",
    chip: "Supplies",
    taxCategory: "tools_small_equipment",
    hint: "Gloves, straps, washer fluid, bungees, tarps.",
  },
  {
    key: "repair",
    label: "Repair / part",
    chip: "Repair",
    taxCategory: "repairs_maintenance",
    hint: "Roadside repair, a part, a shop visit.",
  },
  {
    key: "parking",
    label: "Parking / overnight",
    chip: "Parking",
    taxCategory: "other",
  },
  {
    key: "shower_laundry",
    label: "Shower / laundry",
    chip: "Shower",
    taxCategory: "other",
  },
  {
    key: "scale",
    label: "Scale / weigh",
    chip: "Scale",
    taxCategory: "other",
  },
  {
    key: "motel",
    label: "Motel / hotel",
    chip: "Motel",
    taxCategory: "other",
  },
  {
    key: "other",
    label: "Other",
    chip: "Other",
    taxCategory: "other",
    hint: "Use the note so you remember what it was.",
  },
];

export function roadCategoryMeta(
  key: RoadExpenseCategory | string
): RoadCategoryMeta {
  return (
    ROAD_CATEGORIES.find((c) => c.key === key) ??
    ROAD_CATEGORIES[ROAD_CATEGORIES.length - 1]
  );
}

export function isRoadCategory(v: string): v is RoadExpenseCategory {
  return ROAD_CATEGORIES.some((c) => c.key === v);
}

/** Total of every road expense in the list (management lens). */
export function sumRoadExpenses(rows: RoadExpense[]): number {
  return rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
}

/** Total of only the rows that are excluded from the tax report. */
export function sumUntaxedRoadExpenses(rows: RoadExpense[]): number {
  return rows.reduce(
    (sum, r) =>
      roadCategoryMeta(r.category).taxCategory == null
        ? sum + (Number(r.amount) || 0)
        : sum,
    0
  );
}

/**
 * Roll road expenses up by tax category for the year-end report. Rows whose
 * category maps to null (meals) are dropped here — that exclusion is the
 * whole reason this function exists rather than callers reading rows directly.
 */
export function roadExpensesByTaxCategory(
  rows: RoadExpense[]
): Map<ExpenseCategory, { amount: number; count: number }> {
  const out = new Map<ExpenseCategory, { amount: number; count: number }>();
  for (const r of rows) {
    const taxCategory = roadCategoryMeta(r.category).taxCategory;
    if (taxCategory == null) continue;
    const prev = out.get(taxCategory) ?? { amount: 0, count: 0 };
    out.set(taxCategory, {
      amount: prev.amount + (Number(r.amount) || 0),
      count: prev.count + 1,
    });
  }
  return out;
}

/** Filter rows to an inclusive YYYY-MM-DD date range. */
export function roadExpensesInRange(
  rows: RoadExpense[],
  startIso: string,
  endIso: string
): RoadExpense[] {
  return rows.filter((r) => r.spent_on >= startIso && r.spent_on <= endIso);
}
