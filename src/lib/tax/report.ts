/**
 * Aggregations for the Tax Pack export. Reads ONLY actuals:
 *   - load.linehaul_pay, load.fuel_surcharge, load.accessorials  (gross revenue)
 *   - load.fuel_actual                                            (fuel cost)
 *   - load.tolls_actual                                           (tolls)
 *   - load.lumpers_actual                                         (lumpers)
 *   - loaded_miles + deadhead_miles                               (mileage)
 *   - expenses                                                    (other actuals)
 *   - capital_assets                                              (informational)
 *   - per_diem_summary + per_diem_rates                           (worksheet)
 *
 * It must NOT read driver_pay_per_mile, maintenance_per_mile, tires_per_mile,
 * def_per_mile, monthly_miles, allocated fixed-cost numbers, or
 * real_cpm_override. The management lens is for load decisions only.
 */

import type { Load } from "@/lib/loads";
import { categoryMeta } from "./categories";
import type { Expense } from "./types";

export type RevenueTotals = {
  linehaul: number;
  fuel_surcharge: number;
  accessorials: number;
  total: number;
};

export type LoadActualTotals = {
  fuelActualTotal: number; // sum of load.fuel_actual where not null
  fuelLoadsWithActual: number;
  fuelLoadsTotal: number;
  tollsActualTotal: number;
  lumpersActualTotal: number;
  loadedMiles: number;
  deadheadMiles: number;
  totalMiles: number;
};

export function aggregateRevenue(loads: Load[]): RevenueTotals {
  let linehaul = 0;
  let fsc = 0;
  let acc = 0;
  for (const l of loads) {
    linehaul += Number(l.linehaul_pay) || 0;
    fsc += Number(l.fuel_surcharge) || 0;
    acc += Number(l.accessorials) || 0;
  }
  return {
    linehaul,
    fuel_surcharge: fsc,
    accessorials: acc,
    total: linehaul + fsc + acc,
  };
}

export function aggregateLoadActuals(loads: Load[]): LoadActualTotals {
  let fuelTotal = 0;
  let fuelWith = 0;
  let tollsTotal = 0;
  let lumpersTotal = 0;
  let loadedMiles = 0;
  let deadheadMiles = 0;
  for (const l of loads) {
    if (l.fuel_actual != null) {
      fuelTotal += Number(l.fuel_actual) || 0;
      fuelWith += 1;
    }
    if (l.tolls_actual != null) tollsTotal += Number(l.tolls_actual) || 0;
    if (l.lumpers_actual != null)
      lumpersTotal += Number(l.lumpers_actual) || 0;
    loadedMiles += Number(l.loaded_miles) || 0;
    deadheadMiles += Number(l.deadhead_miles) || 0;
  }
  return {
    fuelActualTotal: fuelTotal,
    fuelLoadsWithActual: fuelWith,
    fuelLoadsTotal: loads.length,
    tollsActualTotal: tollsTotal,
    lumpersActualTotal: lumpersTotal,
    loadedMiles,
    deadheadMiles,
    totalMiles: loadedMiles + deadheadMiles,
  };
}

export type ScheduleCGroup = {
  line: string;
  label: string;
  amount: number;
  items: { description: string; amount: number }[];
};

/**
 * Group expense + load actuals into Schedule C-line buckets for the export.
 * Capital assets are NOT included — they're reported separately.
 */
export function buildScheduleCGroups(
  expenses: Expense[],
  loadActuals: LoadActualTotals
): ScheduleCGroup[] {
  const groups = new Map<
    string,
    { line: string; label: string; amount: number; items: ScheduleCGroup["items"] }
  >();

  function add(line: string, label: string, description: string, amount: number) {
    if (!groups.has(line)) groups.set(line, { line, label, amount: 0, items: [] });
    const g = groups.get(line)!;
    g.amount += amount;
    g.items.push({ description, amount });
  }

  // Load-derived actuals
  if (loadActuals.fuelActualTotal > 0) {
    add(
      "9",
      "Car & truck expenses — line 9 (or Supplies — 22)",
      `Fuel actuals from ${loadActuals.fuelLoadsWithActual} of ${loadActuals.fuelLoadsTotal} loads`,
      loadActuals.fuelActualTotal
    );
  }
  if (loadActuals.tollsActualTotal > 0) {
    add(
      "27a",
      "Other expenses — line 27a",
      "Tolls (from loads)",
      loadActuals.tollsActualTotal
    );
  }
  if (loadActuals.lumpersActualTotal > 0) {
    add(
      "27a",
      "Other expenses — line 27a",
      "Lumpers (from loads)",
      loadActuals.lumpersActualTotal
    );
  }

  // Expense rows
  for (const e of expenses) {
    const meta = categoryMeta(e.category);
    add(
      meta.scheduleCLine,
      meta.scheduleC,
      `${meta.label}${e.vendor ? ` — ${e.vendor}` : ""}`,
      Number(e.amount) || 0
    );
  }

  return [...groups.values()].sort((a, b) => a.line.localeCompare(b.line));
}

export const TAX_PACK_DISCLAIMER =
  "This is a summary of your recorded business activity to give to your tax professional. It is not tax advice and does not determine what is deductible. Your accountant decides final treatment and line placement.";

export function inYear(d: string, year: number): boolean {
  return d.startsWith(`${year}-`);
}
