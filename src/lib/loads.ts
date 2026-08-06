import type { CostProfile } from "@/app/actions";

export type Load = {
  id?: string;
  load_date: string; // YYYY-MM-DD
  broker: string;
  origin: string;
  destination: string;
  loaded_miles: number;
  deadhead_miles: number;
  linehaul_pay: number;
  fuel_surcharge: number;
  accessorials: number;
  fuel_actual: number | null;
  tolls_actual: number | null;
  lumpers_actual: number | null;
  notes: string;
};

export const EMPTY_LOAD: Load = {
  load_date: todayIso(),
  broker: "",
  origin: "",
  destination: "",
  loaded_miles: 0,
  deadhead_miles: 0,
  linehaul_pay: 0,
  fuel_surcharge: 0,
  accessorials: 0,
  fuel_actual: null,
  tolls_actual: null,
  lumpers_actual: null,
  notes: "",
};

export function todayIso(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export type AllocationBasis = "actual_mtd" | "monthly_estimate";

export type MtdContext = {
  /**
   * Sum of total_miles (loaded + deadhead) for every OTHER load in the same
   * calendar month as this load. This load's own miles are added during the
   * compute step so the live form can flex its own input.
   */
  otherMonthMiles: number;
};

export const MTD_FALLBACK_THRESHOLD_MILES = 1000;

export type LoadEconomics = {
  totalMiles: number;
  deadheadPct: number;
  revenue: number;
  fuelCost: number;
  fuelIsEstimated: boolean;
  maintenanceCost: number;
  tiresCost: number;
  defCost: number;
  driverPayCost: number;
  allocatedFixedCost: number;
  allocationBasis: AllocationBasis;
  allocationBasisMiles: number;
  tollsCost: number;
  lumpersCost: number;
  totalCost: number;
  profit: number;
  rpm: number;
  cpm: number;
  profitPerMile: number;
};

function sumFixedMonthly(p: CostProfile): number {
  return (
    p.truck_payment +
    p.trailer_payment +
    p.insurance +
    p.eld_subscriptions +
    p.permits_irp_ifta +
    p.office_misc +
    p.load_board_per_month +
    p.other_monthly_bill
  );
}

export function computeLoadEconomics(
  load: Load,
  p: CostProfile,
  mtd?: MtdContext
): LoadEconomics {
  const totalMiles =
    Number(load.loaded_miles || 0) + Number(load.deadhead_miles || 0);
  const deadheadPct =
    totalMiles > 0 ? (Number(load.deadhead_miles || 0) / totalMiles) * 100 : 0;

  const revenue =
    Number(load.linehaul_pay || 0) +
    Number(load.fuel_surcharge || 0) +
    Number(load.accessorials || 0);

  const computedFuel =
    p.mpg > 0 ? (totalMiles / p.mpg) * p.fuel_price_per_gallon : 0;
  const fuelIsEstimated = load.fuel_actual == null;
  const fuelCost = fuelIsEstimated ? computedFuel : Number(load.fuel_actual);

  const maintenanceCost = totalMiles * p.maintenance_per_mile;
  const tiresCost = totalMiles * p.tires_per_mile;
  const defCost = totalMiles * p.def_per_mile;
  const driverPayCost = totalMiles * p.driver_pay_per_mile;

  const totalFixed = sumFixedMonthly(p);

  // Phase 0.1: allocate fixed costs by the ACTUAL miles logged that month
  // (so a slow month gives a fairer per-load share). Falls back to the saved
  // Monthly Miles assumption when there isn't enough data yet.
  let allocationBasis: AllocationBasis = "monthly_estimate";
  let allocationBasisMiles = p.monthly_miles;
  let allocatedFixedCost = 0;

  if (mtd) {
    const mtdMiles = Math.max(0, mtd.otherMonthMiles) + totalMiles;
    if (mtdMiles >= MTD_FALLBACK_THRESHOLD_MILES) {
      allocationBasis = "actual_mtd";
      allocationBasisMiles = mtdMiles;
      allocatedFixedCost =
        totalFixed > 0 && mtdMiles > 0
          ? (totalFixed / mtdMiles) * totalMiles
          : 0;
    }
  }

  if (allocationBasis === "monthly_estimate") {
    allocatedFixedCost =
      p.monthly_miles > 0 ? totalMiles * (totalFixed / p.monthly_miles) : 0;
  }

  const tollsCost = load.tolls_actual != null ? Number(load.tolls_actual) : 0;
  const lumpersCost =
    load.lumpers_actual != null ? Number(load.lumpers_actual) : 0;

  const totalCost =
    fuelCost +
    maintenanceCost +
    tiresCost +
    defCost +
    driverPayCost +
    allocatedFixedCost +
    tollsCost +
    lumpersCost;

  const profit = revenue - totalCost;
  const rpm = totalMiles > 0 ? revenue / totalMiles : 0;
  const cpm = totalMiles > 0 ? totalCost / totalMiles : 0;
  const profitPerMile = totalMiles > 0 ? profit / totalMiles : 0;

  return {
    totalMiles,
    deadheadPct,
    revenue,
    fuelCost,
    fuelIsEstimated,
    maintenanceCost,
    tiresCost,
    defCost,
    driverPayCost,
    allocatedFixedCost,
    allocationBasis,
    allocationBasisMiles,
    tollsCost,
    lumpersCost,
    totalCost,
    profit,
    rpm,
    cpm,
    profitPerMile,
  };
}

// Returns "YYYY-MM" for the load's date. Used for grouping loads into
// calendar-month buckets for MTD computation.
export function loadMonthKey(loadDate: string): string {
  // load_date is always YYYY-MM-DD per the Load type.
  return loadDate.slice(0, 7);
}

// Build a map of yearMonth -> sum of (loaded + deadhead) miles, given a
// list of loads. Used to feed MtdContext into computeLoadEconomics.
export function monthlyMilesByLoad(loads: Load[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const l of loads) {
    const key = loadMonthKey(l.load_date);
    const miles = Number(l.loaded_miles || 0) + Number(l.deadhead_miles || 0);
    m.set(key, (m.get(key) ?? 0) + miles);
  }
  return m;
}

// Week boundaries — Monday is the start of the week (matches most trucking
// settlement periods).
export function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfWeek(d: Date): Date {
  const start = startOfWeek(d);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

export function startOfMonth(d: Date): Date {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfMonth(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function isoDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function formatWeekLabel(start: Date): string {
  const end = endOfWeek(start);
  const sm = start.toLocaleString("en-US", { month: "short" });
  const em = end.toLocaleString("en-US", { month: "short" });
  const year = end.getFullYear();
  if (start.getMonth() === end.getMonth()) {
    return `${sm} ${start.getDate()}–${end.getDate()}, ${year}`;
  }
  return `${sm} ${start.getDate()} – ${em} ${end.getDate()}, ${year}`;
}

export function parseDateParam(
  dateStr: string | null | undefined
): Date {
  if (!dateStr) return new Date();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) return new Date();
  return new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    12,
    0,
    0
  );
}

export type WeekTotals = {
  loads: number;
  loadedMiles: number;
  deadheadMiles: number;
  totalMiles: number;
  deadheadPct: number;
  revenue: number;
  /** Cost from the loads themselves (fuel, per-mile, allocated fixed). */
  loadCost: number;
  /** On-the-road expenses dated inside this week, not tied to any load. */
  roadExpenses: number;
  /** loadCost + roadExpenses — what the week actually cost. */
  totalCost: number;
  profit: number;
  rpm: number;
  cpm: number;
};

export function aggregateWeek(
  loads: Load[],
  profile: CostProfile,
  monthMiles?: Map<string, number>,
  /**
   * Total of road expenses dated inside this week. Kept as a plain number so
   * this module stays free of the road-expense types — the caller has already
   * filtered to the week.
   */
  roadExpenseTotal = 0
): WeekTotals {
  let loadedMiles = 0;
  let deadheadMiles = 0;
  let revenue = 0;
  let totalCost = 0;

  for (const l of loads) {
    const monthKey = loadMonthKey(l.load_date);
    const ownMiles =
      Number(l.loaded_miles || 0) + Number(l.deadhead_miles || 0);
    const otherMonthMiles =
      monthMiles != null
        ? Math.max(0, (monthMiles.get(monthKey) ?? 0) - ownMiles)
        : 0;
    const e = computeLoadEconomics(
      l,
      profile,
      monthMiles ? { otherMonthMiles } : undefined
    );
    loadedMiles += Number(l.loaded_miles || 0);
    deadheadMiles += Number(l.deadhead_miles || 0);
    revenue += e.revenue;
    totalCost += e.totalCost;
  }

  const totalMiles = loadedMiles + deadheadMiles;
  const roadExpenses = Math.max(0, Number(roadExpenseTotal) || 0);
  const combinedCost = totalCost + roadExpenses;
  return {
    loads: loads.length,
    loadedMiles,
    deadheadMiles,
    totalMiles,
    deadheadPct: totalMiles > 0 ? (deadheadMiles / totalMiles) * 100 : 0,
    revenue,
    loadCost: totalCost,
    roadExpenses,
    totalCost: combinedCost,
    profit: revenue - combinedCost,
    rpm: totalMiles > 0 ? revenue / totalMiles : 0,
    cpm: totalMiles > 0 ? combinedCost / totalMiles : 0,
  };
}
