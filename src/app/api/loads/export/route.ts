import { createSupabaseServerClient } from "@/lib/supabase/server";
import { csvRow } from "@/lib/csv";
import {
  buildMtdContext,
  computeLoadEconomics,
  endOfWeek,
  isoDate,
  loadFromRow,
  loadMonthKey,
  monthRangeForWeek,
  monthStatsByLoad,
  parseDateParam,
  startOfWeek,
  type Load,
} from "@/lib/loads";
import { driverToday } from "@/lib/driverClock";
import { groupTrips, tripLabel } from "@/lib/partials";
import { fetchDriverSettings } from "@/lib/driverSettings";
import { fetchSubscription, isPro } from "@/lib/subscription";
import type { CostProfile } from "@/app/actions";
import {
  roadCategoryMeta,
  sumRoadExpenses,
  type RoadExpense,
} from "@/lib/roadExpenses";

const EMPTY_PROFILE: CostProfile = {
  truck_payment: 0,
  trailer_payment: 0,
  insurance: 0,
  eld_subscriptions: 0,
  permits_irp_ifta: 0,
  office_misc: 0,
  load_board_per_month: 0,
  other_monthly_bill: 0,
  other_label: "",
  monthly_miles: 0,
  mpg: 0,
  fuel_price_per_gallon: 0,
  maintenance_per_mile: 0,
  tires_per_mile: 0,
  def_per_mile: 0,
  driver_pay_per_mile: 0,
  tolls_misc_per_mile: 0,
  desired_profit_per_mile: 0,
  real_cpm_override: null,
};

const HEADERS = [
  "Date",
  "Broker",
  "Origin",
  "Destination",
  "Loaded Miles",
  "Deadhead Miles",
  "Total Miles",
  "Deadhead %",
  "Linehaul",
  "Fuel Surcharge",
  "Accessorials",
  "Load Pay",
  "Carrier %",
  "Carrier Keeps",
  "Your Revenue",
  "Fuel Cost",
  "Fuel Source",
  "Maintenance Reserve",
  "Tires",
  "DEF",
  "Driver Pay",
  "Allocated Fixed",
  "Tolls",
  "Lumpers",
  "Total Cost",
  "Profit",
  "RPM",
  "CPM",
  "Profit/Mile",
  "Notes",
  // Last, so a spreadsheet built on the earlier columns keeps its places.
  // A partial's row holds only the miles it ADDED to the trip, so its RPM
  // and CPM are per extra mile — the row names the load it rode with.
  "Partial Of",
];

function num(n: number, decimals = 2): string {
  return Number.isFinite(n) ? n.toFixed(decimals) : "";
}

function mapProfile(data: Record<string, unknown> | null): CostProfile {
  if (!data) return EMPTY_PROFILE;
  return {
    truck_payment: Number(data.truck_payment) || 0,
    trailer_payment: Number(data.trailer_payment) || 0,
    insurance: Number(data.insurance) || 0,
    eld_subscriptions: Number(data.eld_subscriptions) || 0,
    permits_irp_ifta: Number(data.permits_irp_ifta) || 0,
    office_misc: Number(data.office_misc) || 0,
    load_board_per_month: Number(data.load_board_per_month) || 0,
    other_monthly_bill: Number(data.other_monthly_bill) || 0,
    other_label: (data.other_label as string | null) ?? "",
    monthly_miles: Number(data.monthly_miles) || 0,
    mpg: Number(data.mpg) || 0,
    fuel_price_per_gallon: Number(data.fuel_price_per_gallon) || 0,
    maintenance_per_mile: Number(data.maintenance_per_mile) || 0,
    tires_per_mile: Number(data.tires_per_mile) || 0,
    def_per_mile: Number(data.def_per_mile) || 0,
    driver_pay_per_mile: Number(data.driver_pay_per_mile) || 0,
    tolls_misc_per_mile: Number(data.tolls_misc_per_mile) || 0,
    desired_profit_per_mile: Number(data.desired_profit_per_mile) || 0,
    real_cpm_override:
      data.real_cpm_override == null
        ? null
        : Number(data.real_cpm_override),
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const range = (url.searchParams.get("range") ?? "week").toLowerCase();
  const dateParam = url.searchParams.get("date");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }
  const sub = await fetchSubscription(supabase, user.id);
  if (!isPro(sub)) {
    return new Response("Upgrade to ProfitRig Pro to export.", {
      status: 402,
    });
  }

  // Resolve range on the driver's calendar — the server's is UTC.
  const { now } = await driverToday();
  const target = dateParam ? parseDateParam(dateParam) : now;
  let from: string;
  let to: string;
  let label: string;
  // Loads to fetch for pricing. For a week this is wider than the rows
  // exported: fixed costs are allocated per month, so a week priced from its
  // own loads alone disagreed with the Loads tab.
  let fetchFrom: string;
  let fetchTo: string;

  if (range === "month") {
    const y = target.getFullYear();
    const m = target.getMonth();
    from = isoDate(new Date(y, m, 1));
    to = isoDate(new Date(y, m + 1, 0));
    const monthName = target.toLocaleString("en-US", { month: "long" });
    label = `${monthName}-${y}`;
    fetchFrom = from;
    fetchTo = to;
  } else if (range === "all") {
    from = "1900-01-01";
    to = "2999-12-31";
    label = "All-Time";
    fetchFrom = from;
    fetchTo = to;
  } else {
    const { weekStart: weekStartsOn } = await fetchDriverSettings(
      supabase,
      user.id
    );
    const ws = startOfWeek(target, weekStartsOn);
    const we = endOfWeek(target, weekStartsOn);
    from = isoDate(ws);
    to = isoDate(we);
    label = `Week-${from}`;
    ({ from: fetchFrom, to: fetchTo } = monthRangeForWeek(ws, we));
  }

  const [costRes, loadsRes, roadExpensesRes] = await Promise.all([
    supabase
      .from("cost_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("loads")
      .select("*")
      .eq("user_id", user.id)
      .gte("load_date", fetchFrom)
      .lte("load_date", fetchTo)
      .order("load_date", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("road_expenses")
      .select("id,spent_on,category,amount,note")
      .eq("user_id", user.id)
      .gte("spent_on", from)
      .lte("spent_on", to)
      .order("spent_on", { ascending: true }),
  ]);

  const roadExpenses: RoadExpense[] = (roadExpensesRes.data ?? []).map((r) => ({
    id: r.id,
    spent_on: r.spent_on,
    category: r.category,
    amount: Number(r.amount) || 0,
    note: r.note ?? "",
  }));

  const profile = mapProfile(costRes.data as Record<string, unknown> | null);
  const fetched: Load[] = (loadsRes.data ?? []).map((r) =>
    loadFromRow(r as Record<string, unknown>)
  );
  // Rows cover only the requested range, but month stats use everything
  // fetched, so each load's fixed-cost share comes from its own whole month
  // — for a week, a month-spanning All Time export, or anything between.
  const loads = fetched.filter(
    (l) => l.load_date >= from && l.load_date <= to
  );
  const monthStats = monthStatsByLoad(fetched);
  // Each primary followed by its partials, and the load each partial rode
  // with named on its row. Totals below still add up every row exactly once.
  const trips = groupTrips(loads);
  const ordered = trips.flatMap((t) => [t.primary, ...t.partials]);
  const partialOfLabel = new Map<string, string>();
  for (const t of trips) {
    for (const p of t.partials) partialOfLabel.set(String(p.id), tripLabel(t.primary));
  }

  // Accumulators for totals row
  let tLoaded = 0;
  let tDH = 0;
  let tLinehaul = 0;
  let tFsc = 0;
  let tAccessorials = 0;
  let tLoadPay = 0;
  let tCarrierCut = 0;
  let tRevenue = 0;
  let tFuel = 0;
  let tMaint = 0;
  let tTires = 0;
  let tDef = 0;
  let tDriverPay = 0;
  let tFixed = 0;
  let tTolls = 0;
  let tLumpers = 0;
  let tCost = 0;

  const rows: string[] = [csvRow(HEADERS)];

  for (const load of ordered) {
    const ownMiles =
      Number(load.loaded_miles || 0) + Number(load.deadhead_miles || 0);
    const stats = monthStats.get(loadMonthKey(load.load_date));
    const e = computeLoadEconomics(
      load,
      profile,
      buildMtdContext(
        load.load_date,
        Math.max(0, (stats?.miles ?? 0) - ownMiles),
        stats?.firstDay ?? 1,
        now
      )
    );
    rows.push(
      csvRow([
        load.load_date,
        load.broker,
        load.origin,
        load.destination,
        load.loaded_miles,
        load.deadhead_miles,
        e.totalMiles,
        e.totalMiles > 0 ? `${e.deadheadPct.toFixed(1)}%` : "",
        num(load.linehaul_pay),
        num(load.fuel_surcharge),
        num(load.accessorials),
        num(e.loadPay),
        e.carrierPct > 0 ? `${Number(e.carrierPct.toFixed(2))}%` : "",
        num(e.carrierCut),
        num(e.revenue),
        num(e.fuelCost),
        e.fuelIsEstimated ? "Estimated" : "Actual",
        num(e.maintenanceCost),
        num(e.tiresCost),
        num(e.defCost),
        num(e.driverPayCost),
        num(e.allocatedFixedCost),
        num(e.tollsCost),
        num(e.lumpersCost),
        num(e.totalCost),
        num(e.profit),
        num(e.rpm),
        num(e.cpm),
        num(e.profitPerMile),
        load.notes,
        load.parent_load_id
          ? partialOfLabel.get(String(load.id)) ?? "a load outside this range"
          : "",
      ])
    );

    tLoaded += load.loaded_miles;
    tDH += load.deadhead_miles;
    tLinehaul += load.linehaul_pay;
    tFsc += load.fuel_surcharge;
    tAccessorials += load.accessorials;
    tLoadPay += e.loadPay;
    tCarrierCut += e.carrierCut;
    tRevenue += e.revenue;
    tFuel += e.fuelCost;
    tMaint += e.maintenanceCost;
    tTires += e.tiresCost;
    tDef += e.defCost;
    tDriverPay += e.driverPayCost;
    tFixed += e.allocatedFixedCost;
    tTolls += e.tollsCost;
    tLumpers += e.lumpersCost;
    tCost += e.totalCost;
  }

  if (loads.length > 0) {
    const tTotalMiles = tLoaded + tDH;
    const tProfit = tRevenue - tCost;
    rows.push("");
    rows.push(
      csvRow([
        "TOTALS",
        `${loads.length} load${loads.length === 1 ? "" : "s"}`,
        "",
        "",
        tLoaded,
        tDH,
        tTotalMiles,
        tTotalMiles > 0
          ? `${((tDH / tTotalMiles) * 100).toFixed(1)}%`
          : "",
        num(tLinehaul),
        num(tFsc),
        num(tAccessorials),
        num(tLoadPay),
        "",
        num(tCarrierCut),
        num(tRevenue),
        num(tFuel),
        "",
        num(tMaint),
        num(tTires),
        num(tDef),
        num(tDriverPay),
        num(tFixed),
        num(tTolls),
        num(tLumpers),
        num(tCost),
        num(tProfit),
        num(tTotalMiles > 0 ? tRevenue / tTotalMiles : 0),
        num(tTotalMiles > 0 ? tCost / tTotalMiles : 0),
        num(tTotalMiles > 0 ? tProfit / tTotalMiles : 0),
        "",
      ])
    );
  }

  // Other expenses — not tied to any load, so they get their own block
  // rather than a column on the per-load rows above.
  if (roadExpenses.length > 0) {
    const roadTotal = sumRoadExpenses(roadExpenses);
    rows.push("");
    rows.push(csvRow(["OTHER EXPENSES (not tied to a load)"]));
    rows.push(csvRow(["Date", "What", "Note", "Amount", "In tax report?"]));
    for (const r of roadExpenses) {
      const meta = roadCategoryMeta(r.category);
      rows.push(
        csvRow([
          r.spent_on,
          meta.label,
          r.note,
          num(r.amount),
          meta.taxCategory == null ? "No — per diem covers meals" : "Yes",
        ])
      );
    }
    rows.push(
      csvRow(["OTHER EXPENSES TOTAL", "", "", num(roadTotal), ""])
    );

    const grandCost = tCost + roadTotal;
    const grandProfit = tRevenue - grandCost;
    rows.push("");
    rows.push(
      csvRow([
        "NET AFTER OTHER EXPENSES",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        num(tRevenue),
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        num(grandCost),
        num(grandProfit),
      ])
    );
  }

  // Add UTF-8 BOM so Excel detects encoding correctly when opened directly.
  const csv = "﻿" + rows.join("\r\n");
  const filename = `ProfitRig-Loads-${label}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
