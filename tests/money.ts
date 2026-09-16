/**
 * Regression tests for the money math.
 *
 * Run with: npm test
 *
 * Every check here exists because something was wrong in production, or
 * because a rule must never quietly change:
 *
 *   1. Fixed costs were divided by miles-to-date, so a driver six days into
 *      the month carried a whole month of truck payment. A profitable week
 *      showed as -$3,250.
 *   2. The run-rate window started on the 1st, so a driver who signed up on
 *      the 20th looked like they barely drove — on their very first load.
 *   3. Tolls fell back to zero while fuel fell back to an estimate, so the
 *      Loads tab and the calculator disagreed about what a mile costs.
 *   4. Meals must never reach the tax report (the per-diem worksheet already
 *      reports them) and estimates must never be reported as receipts.
 *   5. "Today" came from the UTC server, so a Sunday-evening load in
 *      California defaulted to Monday and landed in the wrong week.
 *   6. Weeks were fixed to Monday–Sunday while carrier settlements can run
 *      Sunday–Saturday, so a Sunday load could never match its paycheck.
 *   7. A past week re-priced silently — +$1,034 on the Friday, −$660 two
 *      weeks later — when the driver stopped logging. The week CSV also
 *      priced a week from that week's loads alone and disagreed with the tab.
 *
 * Numbers below come from a real user's saved profile, so a regression here
 * is a regression someone would actually notice.
 */

import {
  aggregateWeek,
  buildMtdContext,
  computeLoadEconomics,
  describeMonthAllocation,
  endOfWeek,
  formatWeekLabel,
  isoDate,
  monthRangeForWeek,
  monthStatsByLoad,
  parseDateParam,
  parseWeekStart,
  startOfWeek,
  todayIsoIn,
  type Load,
} from "../src/lib/loads";
import {
  roadExpensesByTaxCategory,
  sumRoadExpenses,
  sumUntaxedRoadExpenses,
  type RoadExpense,
} from "../src/lib/roadExpenses";
import {
  aggregateLoadActuals,
  buildScheduleCGroups,
} from "../src/lib/tax/report";
import type { CostProfile } from "../src/app/actions";

let failures = 0;
let checks = 0;
function check(name: string, ok: boolean, detail = "") {
  checks++;
  if (!ok) failures++;
  console.log(
    `  ${ok ? "\x1b[32mPASS\x1b[0m" : "\x1b[31mFAIL\x1b[0m"}  ${name}` +
      (detail ? `  \x1b[2m— ${detail}\x1b[0m` : "")
  );
}
function section(title: string) {
  console.log(`\n\x1b[1m${title}\x1b[0m`);
}

// ─────────────────────────────────────────────────────────────────────
// Shared fixtures — a real driver's numbers
// ─────────────────────────────────────────────────────────────────────

const profile: CostProfile = {
  truck_payment: 1275,
  trailer_payment: 1191.66,
  insurance: 1296,
  eld_subscriptions: 100,
  permits_irp_ifta: 166.66,
  office_misc: 400,
  load_board_per_month: 0,
  other_monthly_bill: 625,
  other_label: "",
  monthly_miles: 10000,
  mpg: 6.5,
  fuel_price_per_gallon: 4.0,
  maintenance_per_mile: 0.2,
  tires_per_mile: 0.05,
  def_per_mile: 0.03,
  driver_pay_per_mile: 0.7,
  tolls_misc_per_mile: 0.0,
  desired_profit_per_mile: 0.5,
  real_cpm_override: null,
};

function load(over: Partial<Load> = {}): Load {
  return {
    load_date: "2026-08-06",
    broker: "",
    origin: "",
    destination: "",
    loaded_miles: 500,
    deadhead_miles: 50,
    linehaul_pay: 1500,
    fuel_surcharge: 0,
    accessorials: 0,
    fuel_actual: null,
    tolls_actual: null,
    lumpers_actual: null,
    notes: "",
    ...over,
  };
}

/** The reported week: three loads, Aug 4-6, logging began Aug 4. */
const week: Load[] = [
  load({ load_date: "2026-08-06", broker: "Landstar", loaded_miles: 219, deadhead_miles: 152, linehaul_pay: 1280 }),
  load({ load_date: "2026-08-05", broker: "Chr", loaded_miles: 312, deadhead_miles: 83, linehaul_pay: 1440 }),
  load({ load_date: "2026-08-04", broker: "Sureway", loaded_miles: 532, deadhead_miles: 16, linehaul_pay: 1120 }),
];
const weekStats = monthStatsByLoad(week);

function priceWeek(now: Date) {
  let revenue = 0;
  let cost = 0;
  const perLoad: { broker: string; profit: number; cpm: number }[] = [];
  for (const l of week) {
    const own = l.loaded_miles + l.deadhead_miles;
    const s = weekStats.get(l.load_date.slice(0, 7))!;
    const e = computeLoadEconomics(
      l,
      profile,
      buildMtdContext(l.load_date, Math.max(0, s.miles - own), s.firstDay, now)
    );
    revenue += e.revenue;
    cost += e.totalCost;
    perLoad.push({ broker: l.broker, profit: e.profit, cpm: e.cpm });
  }
  return { profit: revenue - cost, perLoad };
}

// ─────────────────────────────────────────────────────────────────────
section("Fixed-cost allocation — the reported week");
// ─────────────────────────────────────────────────────────────────────

const reported = priceWeek(new Date(2026, 7, 6));
check("week is not a false loss", reported.profit > 0, `$${reported.profit.toFixed(0)}`);
check("lands near the true +$1,074", Math.abs(reported.profit - 1074) < 60, `$${reported.profit.toFixed(0)}`);
check("cost per mile is sane, not the $5.40 users saw", reported.perLoad.every((l) => l.cpm < 2.5));
check(
  "the genuinely weak $2.04/mi load still reads weak",
  reported.perLoad.find((l) => l.broker === "Sureway")!.profit < 100
);

// ─────────────────────────────────────────────────────────────────────
section("Fixed-cost allocation — mid-month signup");
// ─────────────────────────────────────────────────────────────────────

const aug26 = new Date(2026, 7, 26);
const lateJoiner = load({ load_date: "2026-08-25" });
const joinedOn20th = computeLoadEconomics(
  lateJoiner, profile, buildMtdContext(lateJoiner.load_date, 650, 20, aug26)
);
const windowFromFirst = computeLoadEconomics(
  lateJoiner, profile, buildMtdContext(lateJoiner.load_date, 650, 1, aug26)
);

check("a driver who joined on the 20th sees a profit, not a loss", joinedOn20th.profit > 0, `$${joinedOn20th.profit.toFixed(0)}`);
check("their cost per mile is plausible", joinedOn20th.cpm < 3.0, `$${joinedOn20th.cpm.toFixed(2)}/mi`);
check("measuring from the 1st would still be wrong", windowFromFirst.cpm > joinedOn20th.cpm + 1.5);
check(
  "someone who really did drive all month still sees a bad month",
  windowFromFirst.cpm > 4,
  `$${windowFromFirst.cpm.toFixed(2)}/mi`
);

// ─────────────────────────────────────────────────────────────────────
section("Fixed-cost allocation — guards");
// ─────────────────────────────────────────────────────────────────────

check(
  "under 7 observed days falls back to the driver's own estimate",
  computeLoadEconomics(lateJoiner, profile, buildMtdContext(lateJoiner.load_date, 650, 24, aug26))
    .allocationBasis === "monthly_estimate"
);
const closedMonth = computeLoadEconomics(
  week[0], profile, buildMtdContext(week[0].load_date, 943, 1, new Date(2026, 8, 15))
);
check(
  "a closed month logged from day 1 uses its real miles, unprojected",
  closedMonth.allocationBasis === "actual_mtd" && Math.abs(closedMonth.allocationBasisMiles - 1314) < 1,
  `${closedMonth.allocationBasisMiles.toFixed(0)} mi`
);
check(
  "a future-dated load falls back rather than dividing by a sliver",
  computeLoadEconomics(load({ load_date: "2026-12-10" }), profile,
    buildMtdContext("2026-12-10", 0, 10, aug26)).allocationBasis === "monthly_estimate"
);
check(
  "first-logged-day can never be later than the load itself",
  buildMtdContext("2026-08-04", 0, 25, new Date(2026, 7, 26)).observedDays === 23
);
const stats = monthStatsByLoad(week).get("2026-08")!;
check("month stats report the earliest logged day", stats.firstDay === 4, `day ${stats.firstDay}`);
check("month stats sum the miles", stats.miles === 1314, `${stats.miles} mi`);
check(
  "aggregateWeek agrees with the per-load sum",
  Math.abs(aggregateWeek(week, profile, weekStats, 0).profit - priceWeek(new Date()).profit) < 1
);

// ─────────────────────────────────────────────────────────────────────
section("Calculator and Loads must agree on what a mile costs");
// ─────────────────────────────────────────────────────────────────────

/** The calculator's cost per mile, mirroring Calculator.tsx. */
function calculatorCPM(p: CostProfile): number {
  const fixed =
    p.truck_payment + p.trailer_payment + p.insurance + p.eld_subscriptions +
    p.permits_irp_ifta + p.office_misc + p.load_board_per_month + p.other_monthly_bill;
  const fuelPerMile = p.mpg > 0 ? p.fuel_price_per_gallon / p.mpg : 0;
  return (p.monthly_miles > 0 ? fixed / p.monthly_miles : 0) +
    fuelPerMile + p.maintenance_per_mile + p.tires_per_mile + p.def_per_mile +
    p.driver_pay_per_mile + p.tolls_misc_per_mile;
}

const withTolls: CostProfile = { ...profile, tolls_misc_per_mile: 0.05 };
const earlyCtx = buildMtdContext("2026-08-06", 943, 4, new Date(2026, 7, 6));
const blank = computeLoadEconomics(load(), withTolls, earlyCtx);

check(
  "a load with nothing entered costs exactly what the calculator says",
  Math.abs(blank.cpm - calculatorCPM(withTolls)) < 0.0001,
  `$${blank.cpm.toFixed(4)} vs $${calculatorCPM(withTolls).toFixed(4)}`
);
check("blank tolls are flagged as estimated", blank.tollsIsEstimated);
check("blank fuel is flagged as estimated", blank.fuelIsEstimated);

const zeroTolls = computeLoadEconomics(load({ tolls_actual: 0 }), withTolls, earlyCtx);
check("an explicit $0 toll is respected, not overwritten", zeroTolls.tollsCost === 0);
check("an explicit $0 is not flagged as an estimate", zeroTolls.tollsIsEstimated === false);

const realTolls = computeLoadEconomics(load({ tolls_actual: 84.5 }), withTolls, earlyCtx);
check("a real toll receipt beats the estimate", realTolls.tollsCost === 84.5);
const realFuel = computeLoadEconomics(load({ fuel_actual: 210 }), withTolls, earlyCtx);
check("a real fuel receipt beats the estimate", realFuel.fuelCost === 210 && !realFuel.fuelIsEstimated);

// ─────────────────────────────────────────────────────────────────────
section("On-the-road expenses");
// ─────────────────────────────────────────────────────────────────────

const roadWeek: RoadExpense[] = [
  { spent_on: "2026-08-03", category: "meals", amount: 42.5, note: "lunch" },
  { spent_on: "2026-08-04", category: "meals", amount: 19.75, note: "" },
  { spent_on: "2026-08-04", category: "truck_wash", amount: 40, note: "" },
  { spent_on: "2026-08-05", category: "supplies", amount: 28.3, note: "gloves" },
  { spent_on: "2026-08-06", category: "repair", amount: 310, note: "mud flap" },
  { spent_on: "2026-08-06", category: "parking", amount: 15, note: "" },
];

check("the week's total includes food", sumRoadExpenses(roadWeek) === 455.55);
check("food subtotal is reported separately", sumUntaxedRoadExpenses(roadWeek) === 62.25);

const byTax = roadExpensesByTaxCategory(roadWeek);
check(
  "the tax rollup drops the $62.25 of food",
  [...byTax.values()].reduce((s, v) => s + v.amount, 0) === 393.3
);
check("truck wash + repair roll into repairs", byTax.get("repairs_maintenance")?.amount === 350);
check("supplies map to tools & small equipment", byTax.get("tools_small_equipment")?.amount === 28.3);

const withoutRoad = aggregateWeek(week, profile, weekStats, 0);
const withRoad = aggregateWeek(week, profile, weekStats, sumRoadExpenses(roadWeek));
check("load cost is untouched by road expenses", withRoad.loadCost === withoutRoad.loadCost);
check(
  "week profit drops by the full amount, food included",
  Number((withoutRoad.profit - withRoad.profit).toFixed(2)) === 455.55
);
check("a negative road total cannot be injected", aggregateWeek(week, profile, weekStats, -999).roadExpenses === 0);

// ─────────────────────────────────────────────────────────────────────
section("The tax lens reports receipts only");
// ─────────────────────────────────────────────────────────────────────

const noReceipts = aggregateLoadActuals([load(), load({ load_date: "2026-08-05" })]);
check("estimated tolls report as $0 to the accountant", noReceipts.tollsActualTotal === 0);
check("estimated fuel reports as $0 to the accountant", noReceipts.fuelActualTotal === 0);
check(
  "a real toll receipt IS reported",
  aggregateLoadActuals([load({ tolls_actual: 63.25 })]).tollsActualTotal === 63.25
);

const groups = buildScheduleCGroups([], noReceipts, roadWeek);
const groupsJson = JSON.stringify(groups).toLowerCase();
check("no food or meal wording reaches Schedule C", !/food|meal/.test(groupsJson));
check("no toll line appears when no toll was entered", !groupsJson.includes("toll"));
check(
  "Schedule C total equals the non-food road expenses",
  Math.abs(groups.reduce((s, g) => s + g.amount, 0) - 393.3) < 0.001
);

// ─────────────────────────────────────────────────────────────────────
section("Weeks start on the day the driver's pay week starts");
// ─────────────────────────────────────────────────────────────────────

// 13 Sep 2026 is a Sunday. Real D. Lewis settlements run Sunday → Saturday.
const sunday13 = parseDateParam("2026-09-13");
check(
  "the default week is unchanged: that Sunday closes Mon 7 → Sun 13",
  isoDate(startOfWeek(sunday13)) === "2026-09-07" && isoDate(endOfWeek(sunday13)) === "2026-09-13"
);
check(
  "a Sunday week opens on that Sunday: Sun 13 → Sat 19",
  isoDate(startOfWeek(sunday13, "sunday")) === "2026-09-13" &&
    isoDate(endOfWeek(sunday13, "sunday")) === "2026-09-19"
);
check(
  "every day maps back to its week's first day, in both kinds of week",
  ["13", "14", "15", "16", "17", "18", "19"].every(
    (d) => isoDate(startOfWeek(parseDateParam(`2026-09-${d}`), "sunday")) === "2026-09-13"
  ) &&
    ["14", "15", "16", "17", "18", "19", "20"].every(
      (d) => isoDate(startOfWeek(parseDateParam(`2026-09-${d}`))) === "2026-09-14"
    )
);
const sundayWeekLabel = formatWeekLabel(startOfWeek(sunday13, "sunday"));
check("a Sunday week's label ends on Saturday", sundayWeekLabel === "Sep 13–19, 2026", sundayWeekLabel);
const flipKeepsWeek = (iso: string) => {
  const d = parseDateParam(iso);
  const dayBeforeMondayWeek = startOfWeek(d, "monday");
  dayBeforeMondayWeek.setDate(dayBeforeMondayWeek.getDate() - 1);
  return isoDate(startOfWeek(d, "sunday")) === isoDate(dayBeforeMondayWeek);
};
check(
  "the Prev/Next mid-week day keeps the same week on screen when the setting flips",
  flipKeepsWeek("2026-09-16") && flipKeepsWeek("2026-09-17")
);
check("…which a week's first day would not: a Sunday jumps a whole week", !flipKeepsWeek("2026-09-13"));
check(
  "anything but exactly \"sunday\" is a Monday week",
  parseWeekStart(null) === "monday" && parseWeekStart("Sunday") === "monday" && parseWeekStart("sunday") === "sunday"
);

// ─────────────────────────────────────────────────────────────────────
section("Today is the driver's day, not the server's");
// ─────────────────────────────────────────────────────────────────────

// Sunday 13 Sep, 8:30pm in California — already Monday in UTC.
const sundayEvening = new Date(Date.parse("2026-09-13T20:30:00-07:00"));
check(
  "a California driver's Sunday evening is still Sunday",
  todayIsoIn("America/Los_Angeles", sundayEvening) === "2026-09-13"
);
check("the UTC server calls it Monday — the old bug", todayIsoIn("UTC", sundayEvening) === "2026-09-14");
check("a New York driver at 11:30pm is still on Sunday", todayIsoIn("America/New_York", sundayEvening) === "2026-09-13");
check(
  "so a new load lands in the week that Sunday belongs to",
  isoDate(startOfWeek(parseDateParam(todayIsoIn("America/Los_Angeles", sundayEvening)))) === "2026-09-07"
);
check(
  "a made-up time zone falls back instead of crashing",
  todayIsoIn("Mars/Olympus_Mons", sundayEvening) === isoDate(sundayEvening)
);
check("no time zone at all falls back too", todayIsoIn(undefined, sundayEvening) === isoDate(sundayEvening));

// ─────────────────────────────────────────────────────────────────────
section("A driver who starts mid-week");
// ─────────────────────────────────────────────────────────────────────

const trip = (d: string) => load({ load_date: d, loaded_miles: 500, deadhead_miles: 50, linehaul_pay: 1500 });
const firstFixedMonthly =
  profile.truck_payment + profile.trailer_payment + profile.insurance + profile.eld_subscriptions +
  profile.permits_irp_ifta + profile.office_misc + profile.load_board_per_month + profile.other_monthly_bill;
const sepPriced = (loads: Load[], now: Date) => {
  const s = monthStatsByLoad(loads).get("2026-09")!;
  return (l: Load) =>
    computeLoadEconomics(l, profile, buildMtdContext(l.load_date, s.miles - l.loaded_miles - l.deadhead_miles, s.firstDay, now));
};

// Signs up Wednesday 16 Sep and logs Wed–Fri.
const midWeek = [trip("2026-09-16"), trip("2026-09-17"), trip("2026-09-18")];
const midStats = monthStatsByLoad(midWeek);
const fridayNight = new Date(2026, 8, 18, 20);
const firstWeek = aggregateWeek(midWeek, profile, midStats, 0, fridayNight);
const firstWeekFixed = midWeek.map(sepPriced(midWeek, fridayNight)).reduce((s, e) => s + e.allocatedFixedCost, 0);

check(
  "their first days are priced at their own monthly-miles estimate",
  describeMonthAllocation("2026-09", midStats.get("2026-09")!, profile, fridayNight).basis === "monthly_estimate"
);
check(
  "their fixed cost per mile matches the calculator exactly",
  Math.abs(firstWeekFixed / 1650 - firstFixedMonthly / profile.monthly_miles) < 0.0001,
  `$${(firstWeekFixed / 1650).toFixed(4)}/mi`
);
check("a normal first week shows a profit", firstWeek.profit > 0, `$${firstWeek.profit.toFixed(0)}`);

// ─────────────────────────────────────────────────────────────────────
section("A past week's profit moves — and the week says why");
// ─────────────────────────────────────────────────────────────────────

const sep30 = new Date(2026, 8, 30, 20);
const stoppedWeek = aggregateWeek(midWeek, profile, midStats, 0, sep30);
const stoppedNote = describeMonthAllocation("2026-09", midStats.get("2026-09")!, profile, sep30);
const keptLogging = [...midWeek, ...["21", "22", "23", "24", "25", "28", "29", "30"].map((d) => trip(`2026-09-${d}`))];
const keptStats = monthStatsByLoad(keptLogging);
const keptWeek = aggregateWeek(midWeek, profile, keptStats, 0, sep30);
const keptNote = describeMonthAllocation("2026-09", keptStats.get("2026-09")!, profile, sep30);

check(
  "the same three loads swing from profit to loss when logging stops",
  firstWeek.profit > 0 && stoppedWeek.profit < 0,
  `$${firstWeek.profit.toFixed(0)} → $${stoppedWeek.profit.toFixed(0)}`
);
check(
  "…and the note explains it: real pace, well under the estimate",
  stoppedNote.basis === "actual_mtd" && stoppedNote.lowPace && Math.round(stoppedNote.basisMiles) === 3300,
  `${Math.round(stoppedNote.basisMiles)} mi/month`
);
check("a driver who kept logging gets no warning", keptNote.basis === "actual_mtd" && !keptNote.lowPace);
check("and their week stays profitable", keptWeek.profit > 0, `$${keptWeek.profit.toFixed(0)}`);
check("an open month is never called settled", !stoppedNote.final && !keptNote.final);
check(
  "once the month is over its share is settled",
  describeMonthAllocation("2026-09", keptStats.get("2026-09")!, profile, new Date(2026, 9, 5)).final
);
check(
  "the note reads the exact rule that priced the loads",
  keptNote.basisMiles === sepPriced(keptLogging, sep30)(midWeek[0]).allocationBasisMiles
);

// ─────────────────────────────────────────────────────────────────────
section("The week CSV prices a week the way the Loads tab does");
// ─────────────────────────────────────────────────────────────────────

// The same Wed–Fri week, for a driver who also hauled on the 1st–3rd.
const monthOfLoads = [trip("2026-09-01"), trip("2026-09-02"), trip("2026-09-03"), ...midWeek];
const pricedFromWeekOnly = aggregateWeek(midWeek, profile, monthStatsByLoad(midWeek), 0, fridayNight);
const pricedFromMonth = aggregateWeek(midWeek, profile, monthStatsByLoad(monthOfLoads), 0, fridayNight);
check(
  "pricing a week from its own loads alone gives a different profit",
  Math.abs(pricedFromWeekOnly.profit - pricedFromMonth.profit) > 100,
  `$${pricedFromWeekOnly.profit.toFixed(0)} vs $${pricedFromMonth.profit.toFixed(0)}`
);
const midRange = monthRangeForWeek(
  startOfWeek(parseDateParam("2026-09-16")),
  endOfWeek(parseDateParam("2026-09-16"))
);
check("the fetch range is the whole month around the week", midRange.from === "2026-09-01" && midRange.to === "2026-09-30");
const edgeRange = monthRangeForWeek(
  startOfWeek(parseDateParam("2026-09-30"), "sunday"),
  endOfWeek(parseDateParam("2026-09-30"), "sunday")
);
check(
  "a week running into October fetches both months",
  edgeRange.from === "2026-09-01" && edgeRange.to === "2026-10-31",
  `${edgeRange.from} → ${edgeRange.to}`
);
check(
  "loads fetched with that range price the week exactly like the tab",
  aggregateWeek(
    midWeek,
    profile,
    monthStatsByLoad(monthOfLoads.filter((l) => l.load_date >= midRange.from && l.load_date <= midRange.to)),
    0,
    fridayNight
  ).profit === pricedFromMonth.profit
);

// ─────────────────────────────────────────────────────────────────────

console.log(
  failures === 0
    ? `\n\x1b[32m${checks} checks passed.\x1b[0m\n`
    : `\n\x1b[31m${failures} of ${checks} checks FAILED.\x1b[0m\n`
);
process.exit(failures === 0 ? 0 : 1);
