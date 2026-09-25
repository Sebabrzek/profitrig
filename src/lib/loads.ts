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
  /**
   * Percent of this load's pay the carrier keeps, for a driver leased to a
   * carrier. Stored on the load itself, so when a carrier changes the split
   * (D. Lewis went 18% → 20% inside one month) past weeks keep the split
   * they were actually paid at. null means never set: the driver keeps 100%.
   */
  carrier_pct: number | null;
  notes: string;
  /**
   * The primary load this one rode with, when it is a partial; null for an
   * ordinary load. A partial records what it ADDED to the trip — its full
   * pay, but only its extra miles, stored as deadhead — so every total that
   * adds rows up is already right. See lib/partials and migration 017.
   * Optional so the many places that build a Load by hand need not name it.
   */
  parent_load_id?: string | null;
};

/**
 * A Load from a row of the `loads` table. Every screen that reads loads goes
 * through this, so a new column — like carrier_pct — cannot be forgotten on
 * one screen and silently priced as 100% there.
 */
export function loadFromRow(r: Record<string, unknown>): Load {
  const num = (v: unknown) => Number(v) || 0;
  // A value that is present but not a usable number is treated as absent,
  // not as zero. Absent means "estimate this one", which is what a blank
  // field has always meant; zero would assert the load truly cost nothing
  // and understate its cost. Without the finite check a malformed figure
  // reached the arithmetic as NaN and turned a load's whole total, and the
  // week's, into NaN.
  const optional = (v: unknown) => {
    if (v == null) return null;
    // Blank text is absent, not zero: JavaScript reads "" as 0, which would
    // claim the load truly cost nothing and overstate its profit.
    if (typeof v === "string" && v.trim() === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  return {
    id: (r.id as string | undefined) ?? undefined,
    load_date: String(r.load_date ?? ""),
    broker: (r.broker as string | null) ?? "",
    origin: (r.origin as string | null) ?? "",
    destination: (r.destination as string | null) ?? "",
    loaded_miles: num(r.loaded_miles),
    deadhead_miles: num(r.deadhead_miles),
    linehaul_pay: num(r.linehaul_pay),
    fuel_surcharge: num(r.fuel_surcharge),
    accessorials: num(r.accessorials),
    fuel_actual: optional(r.fuel_actual),
    tolls_actual: optional(r.tolls_actual),
    lumpers_actual: optional(r.lumpers_actual),
    carrier_pct: optional(r.carrier_pct),
    notes: (r.notes as string | null) ?? "",
    // Absent before migration 017 runs, and null on every ordinary load.
    parent_load_id:
      typeof r.parent_load_id === "string" && r.parent_load_id
        ? r.parent_load_id
        : null,
  };
}

/**
 * A carrier percentage the math can trust.
 *
 * A percentage that is not a usable number at all — missing, blank, NaN,
 * text — counts as 0: no split was recorded, so the driver keeps the load.
 * That is the independent driver's case and it is the only safe reading of
 * "we don't know".
 *
 * Everything else is clamped into 0–100 rather than discarded. A value at or
 * above 100 used to fall back to 0, which handed the driver the WHOLE load
 * instead of none of it — an out-of-range percentage overstating revenue, the
 * one direction that makes a losing load look acceptable. It is now capped at
 * 100, which zeroes the driver's share instead. A negative percentage is
 * floored at 0 for the same reason: a negative cut would pay the driver more
 * than the load did.
 *
 * Note the save paths are stricter still and reject anything at or above 100
 * (app/actions.ts, LoadForm) — this is the last line, for rows that reach the
 * math some other way.
 */
export function effectiveCarrierPct(pct: unknown): number {
  const n = Number(pct);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n > 100 ? 100 : n;
}

export const EMPTY_LOAD: Load = {
  // Filled per request from the driver's own calendar (todayIsoIn). Calling
  // todayIso() here froze the date at module load, so a warm server kept
  // handing out the day it booted.
  load_date: "",
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
  carrier_pct: null,
  notes: "",
  parent_load_id: null,
};

export function todayIso(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Cookie holding the browser's IANA time zone. Set by TimeZoneCookie. */
export const TZ_COOKIE = "pr_tz";

/**
 * Today, YYYY-MM-DD, on the DRIVER's calendar. Pages render on a UTC server,
 * so a load entered at 8:30pm Sunday in California defaulted to Monday and
 * landed in next week. Falls back to this runtime's clock when the zone is
 * missing or not a real IANA zone — the cookie is user-controlled.
 */
export function todayIsoIn(
  timeZone: string | null | undefined,
  now: Date = new Date()
): string {
  if (timeZone) {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(now);
      const part = (type: string) => parts.find((p) => p.type === type)?.value;
      const y = part("year");
      const m = part("month");
      const d = part("day");
      if (y && m && d) return `${y}-${m}-${d}`;
    } catch {
      // Unknown time zone — fall through to the runtime clock.
    }
  }
  return isoDate(now);
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

/** A real pace under this share of the driver's own estimate is worth saying out loud. */
export const LOW_PACE_RATIO = 0.75;

export type MonthAllocationNote = {
  monthKey: string;
  basis: AllocationBasis;
  /** The month is over: its allocation is settled and will not move again. */
  final: boolean;
  /** The month of miles fixed bills are spread over — real pace or the estimate. */
  basisMiles: number;
  estimateMiles: number;
  /** Real pace well under the estimate: unlogged loads, or genuine downtime. */
  lowPace: boolean;
};

/**
 * Why a month's loads carry the fixed-cost share they do, and whether it can
 * still move. While a month is open its bills are spread over the miles
 * logged so far, so a driver who stops logging watches an old profitable
 * week turn into a loss with nothing about that week changing. This is what
 * the Loads tab shows so that never happens silently.
 */
export function describeMonthAllocation(
  monthKey: string,
  stats: MonthStats,
  p: CostProfile,
  now: Date = new Date()
): MonthAllocationNote {
  const firstDate = `${monthKey}-${String(stats.firstDay).padStart(2, "0")}`;
  const ctx = buildMtdContext(firstDate, stats.miles, stats.firstDay, now);
  // Every load in a month resolves to the same basis (its own miles plus the
  // rest of the month's), so asking with zero extra miles reads the month.
  const { basis, basisMiles } = resolveAllocationBasis(p, ctx, 0);
  return {
    monthKey,
    basis,
    final: monthKey < monthKeyOf(now),
    basisMiles,
    estimateMiles: p.monthly_miles,
    lowPace:
      basis === "actual_mtd" &&
      p.monthly_miles > 0 &&
      basisMiles < p.monthly_miles * LOW_PACE_RATIO,
  };
}

export type LoadEconomics = {
  totalMiles: number;
  deadheadPct: number;
  /** What the load paid: linehaul + fuel surcharge + accessorials. */
  loadPay: number;
  /** The carrier's percentage actually applied (0 for an independent). */
  carrierPct: number;
  /** Dollars the carrier keeps from this load. */
  carrierCut: number;
  /** What the DRIVER keeps: load pay minus the carrier's cut. Profit, rate
   *  per mile, and every total are built on this. */
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

export type AllocationResolution = {
  basis: AllocationBasis;
  /** The month of miles fixed bills are spread over. */
  basisMiles: number;
};

/**
 * Which month of miles fixed bills are spread over. The only place this rule
 * lives: load pricing and the Loads tab's explanation both read it, so the
 * explanation can never describe a different rule than the one that priced
 * the load.
 */
export function resolveAllocationBasis(
  p: CostProfile,
  mtd: MtdContext | undefined,
  loadMiles: number
): AllocationResolution {
  // Use real mileage where it exists, so a genuinely slow month shows a
  // fairer per-load share. See MtdContext for why miles-to-date alone is not
  // a month's mileage.
  if (mtd) {
    const mtdMiles = Math.max(0, mtd.otherMonthMiles) + loadMiles;

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
      return { basis: "actual_mtd", basisMiles };
    }
  }
  return { basis: "monthly_estimate", basisMiles: p.monthly_miles };
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

  const loadPay =
    Number(load.linehaul_pay || 0) +
    Number(load.fuel_surcharge || 0) +
    Number(load.accessorials || 0);

  // A leased driver's revenue is their share, not the load. Counting the
  // whole load overstated every leased driver's profit — the dangerous
  // direction, since it makes a losing load look acceptable. Multiplying
  // before dividing keeps real splits exact: $1,940 at 20% is $388, not
  // $388.00000000000006.
  const carrierPct = effectiveCarrierPct(load.carrier_pct);
  const carrierCut = (loadPay * carrierPct) / 100;
  const revenue = loadPay - carrierCut;

  const computedFuel =
    p.mpg > 0 ? (totalMiles / p.mpg) * p.fuel_price_per_gallon : 0;
  const fuelIsEstimated = load.fuel_actual == null;
  const fuelCost = fuelIsEstimated ? computedFuel : Number(load.fuel_actual);

  const maintenanceCost = totalMiles * p.maintenance_per_mile;
  const tiresCost = totalMiles * p.tires_per_mile;
  const defCost = totalMiles * p.def_per_mile;
  const driverPayCost = totalMiles * p.driver_pay_per_mile;

  const totalFixed = sumFixedMonthly(p);

  // Allocate fixed costs across a MONTH of miles — see resolveAllocationBasis.
  const { basis: allocationBasis, basisMiles: allocationBasisMiles } =
    resolveAllocationBasis(p, mtd, totalMiles);
  const allocatedFixedCost =
    allocationBasisMiles > 0
      ? totalMiles * (totalFixed / allocationBasisMiles)
      : 0;

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
    loadPay,
    carrierPct,
    carrierCut,
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

/**
 * The day a driver's week starts on. Carrier settlements disagree — some pay
 * Monday–Sunday, others Sunday–Saturday — and a Sunday load has to land in
 * the same week as the settlement that pays for it.
 */
export type WeekStart = "monday" | "sunday";

/** Anything but exactly "sunday" is a Monday week, the long-standing default. */
export function parseWeekStart(v: unknown): WeekStart {
  return v === "sunday" ? "sunday" : "monday";
}

export function startOfWeek(d: Date, weekStart: WeekStart = "monday"): Date {
  const x = new Date(d);
  const first = weekStart === "sunday" ? 0 : 1; // getDay(): 0=Sun … 6=Sat
  x.setDate(x.getDate() - ((x.getDay() - first + 7) % 7));
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfWeek(d: Date, weekStart: WeekStart = "monday"): Date {
  const end = startOfWeek(d, weekStart);
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

/**
 * The loads to fetch when pricing a week: every day of each month the week
 * touches. Fixed costs are allocated per month, so pricing a week from that
 * week's loads alone gives a different profit than the Loads tab. The Loads
 * tab and the week CSV both use this so they cannot drift apart again.
 */
export function monthRangeForWeek(
  weekStart: Date,
  weekEnd: Date
): { from: string; to: string } {
  return {
    from: isoDate(startOfMonth(weekStart)),
    to: isoDate(endOfMonth(weekEnd)),
  };
}

export function isoDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function formatWeekLabel(start: Date): string {
  // `start` is already the week's first day, whichever day that is.
  // Re-deriving it with endOfWeek's Monday default would shift a Sunday week.
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
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
  /** What the week's loads paid, before any carrier's cut. */
  loadPay: number;
  /** What carriers kept from the week's loads. */
  carrierCut: number;
  /** What the driver kept: loadPay − carrierCut. */
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
  roadExpenseTotal = 0,
  /**
   * Today on the driver's calendar. Omitted, it is this runtime's clock —
   * UTC on the server — so pages should pass the driver's own date.
   */
  now?: Date
): WeekTotals {
  let loadedMiles = 0;
  let deadheadMiles = 0;
  let loadPay = 0;
  let carrierCut = 0;
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
            stats.firstDay,
            now
          )
        : undefined
    );
    loadedMiles += Number(l.loaded_miles || 0);
    deadheadMiles += Number(l.deadhead_miles || 0);
    loadPay += e.loadPay;
    carrierCut += e.carrierCut;
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
    loadPay,
    carrierCut,
    revenue,
    loadCost: totalCost,
    roadExpenses,
    totalCost: combinedCost,
    profit: revenue - combinedCost,
    rpm: totalMiles > 0 ? revenue / totalMiles : 0,
    cpm: totalMiles > 0 ? combinedCost / totalMiles : 0,
  };
}
