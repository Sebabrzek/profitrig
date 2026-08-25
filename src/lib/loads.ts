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
  /**
   * How many days of this month we have actually WATCHED — from the
   * driver's first logged load of the month through today (or through
   * month end once the month is over).
   *
   * Two different mistakes made this necessary, and both produced the same
   * symptom: a wildly inflated fixed-cost share and a fake catastrophic
   * loss.
   *   1. Using miles-to-date as a month's mileage. On Aug 6 a driver has
   *      six days of miles but owes a full month of truck payment.
   *   2. Counting elapsed days from the 1st. A driver who signed up on the
   *      20th has not been logging since the 1st, so their run rate looked
   *      7x worse than it was — on their very first load.
   *
   * Watching-days is the honest denominator for a run rate. Build this with
   * `buildMtdContext`; never assemble it by hand.
   */
  observedDays: number;
  daysInMonth: number;
};

export const MTD_FALLBACK_THRESHOLD_MILES = 1000;

/**
 * We must have watched a driver for at least this many days before trusting
 * their run rate. Below it we use their own monthly-miles estimate, because
 * a couple of days of driving says nothing about how the month will end.
 */
export const MTD_MIN_OBSERVED_DAYS = 7;

function monthKeyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Build the allocation context for a load. Every caller must go through this
 * so that the Loads tab, the load form, the calculator's real-CPM insight,
 * and the CSV export all allocate fixed costs identically.
 */
export function buildMtdContext(
  loadDate: string,
  otherMonthMiles: number,
  /**
   * Day-of-month (1-31) of the earliest load this driver has logged in the
   * load's calendar month. Required, not optional: defaulting it to 1 would
   * silently reintroduce the mid-month-signup bug at any call site that
   * forgot to pass it, and that bug is invisible until a user complains.
   */
  firstLoggedDay: number,
  now: Date = new Date()
): MtdContext {
  const monthKey = loadMonthKey(loadDate);
  const [year, month] = monthKey.split("-").map(Number);
  // Day 0 of the next month === last day of this one.
  const daysInMonth = new Date(year, month, 0).getDate();
  const nowKey = monthKeyOf(now);

  // The load being priced is itself part of the month, so it can only pull
  // the observation window earlier — never later than its own date.
  const loadDay = Number(loadDate.slice(8, 10)) || 1;
  const startDay = Math.min(
    Math.max(1, Math.round(firstLoggedDay) || loadDay),
    loadDay
  );

  let throughDay: number;
  if (monthKey < nowKey) {
    throughDay = daysInMonth; // month is over — we saw all of it we ever will
  } else if (monthKey > nowKey) {
    throughDay = 0; // future-dated load — nothing observed yet
  } else {
    throughDay = now.getDate();
  }

  return {
    otherMonthMiles,
    observedDays: Math.max(0, throughDay - startDay + 1),
    daysInMonth,
  };
}

export type MonthStats = {
  /** Total loaded + deadhead miles logged in this calendar month. */
  miles: number;
  /** Day-of-month of the earliest load logged in this calendar month. */
  firstDay: number;
};

/**
 * Summarize what we know about each calendar month the loads touch. Miles
 * and first-logged-day travel together so a caller cannot supply one
 * without the other — the pair is what makes the run rate meaningful.
 */
export function monthStatsByLoad(loads: Load[]): Map<string, MonthStats> {
  const m = new Map<string, MonthStats>();
  for (const l of loads) {
    const key = loadMonthKey(l.load_date);
    const miles =
      (Number(l.loaded_miles) || 0) + (Number(l.deadhead_miles) || 0);
    const day = Number(l.load_date.slice(8, 10)) || 1;
    const prev = m.get(key);
    if (prev) {
      prev.miles += miles;
      prev.firstDay = Math.min(prev.firstDay, day);
    } else {
      m.set(key, { miles, firstDay: day });
    }
  }
  return m;
}

export type LoadEconomics = {
  totalMiles: number;
  deadheadPct: number;
  revenue: number;
  fuelCost: number;
  fuelIsEstimated: boolean;
  tollsIsEstimated: boolean;
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

  // Allocate fixed costs across a MONTH of miles, using real mileage where
  // it exists so a genuinely slow month shows a fairer per-load share. See
  // MtdContext for why miles-to-date alone is not a month's mileage.
  let allocationBasis: AllocationBasis = "monthly_estimate";
  let allocationBasisMiles = p.monthly_miles;
  let allocatedFixedCost = 0;

  if (mtd) {
    const mtdMiles = Math.max(0, mtd.otherMonthMiles) + totalMiles;

    // Fixed bills are monthly, so they must be spread over a MONTH of miles.
    // We rarely have a whole month, so scale what we watched up to one.
    let basisMiles: number;
    if (mtd.observedDays >= mtd.daysInMonth) {
      // Watched the whole month — its mileage is the real thing.
      basisMiles = mtdMiles;
    } else if (mtd.observedDays >= MTD_MIN_OBSERVED_DAYS) {
      basisMiles = (mtdMiles * mtd.daysInMonth) / mtd.observedDays;
    } else {
      // Watched too little to read a run rate — use the saved estimate.
      basisMiles = 0;
    }

    if (basisMiles >= MTD_FALLBACK_THRESHOLD_MILES) {
      allocationBasis = "actual_mtd";
      allocationBasisMiles = basisMiles;
      allocatedFixedCost =
        totalFixed > 0 ? (totalFixed / basisMiles) * totalMiles : 0;
    }
  }

  if (allocationBasis === "monthly_estimate") {
    allocatedFixedCost =
      p.monthly_miles > 0 ? totalMiles * (totalFixed / p.monthly_miles) : 0;
  }

  // Mirror the fuel rule: an actual wins, otherwise fall back to the saved
  // per-mile estimate. Dropping to zero here quietly understated every load
  // by the driver's tolls/scales/misc rate and made per-load cost disagree
  // with the calculator's cost per mile. An explicit 0 still means "no tolls
  // on this run" and is respected — only a blank field estimates.
  const tollsIsEstimated = load.tolls_actual == null;
  const tollsCost = tollsIsEstimated
    ? totalMiles * p.tolls_misc_per_mile
    : Number(load.tolls_actual);
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
    tollsIsEstimated,
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
  months?: Map<string, MonthStats>,
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
    const stats = months?.get(loadMonthKey(l.load_date));
    const ownMiles =
      Number(l.loaded_miles || 0) + Number(l.deadhead_miles || 0);
    const e = computeLoadEconomics(
      l,
      profile,
      stats
        ? buildMtdContext(
            l.load_date,
            Math.max(0, stats.miles - ownMiles),
            stats.firstDay
          )
        : undefined
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
