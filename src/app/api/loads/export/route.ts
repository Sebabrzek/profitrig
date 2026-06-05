import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  computeLoadEconomics,
  endOfWeek,
  isoDate,
  loadMonthKey,
  monthlyMilesByLoad,
  parseDateParam,
  startOfWeek,
  type Load,
} from "@/lib/loads";
import { fetchSubscription, isPro } from "@/lib/subscription";
import type { CostProfile } from "@/app/actions";

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
  "Total Revenue",
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
];

function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function csvRow(values: unknown[]): string {
  return values.map(csvEscape).join(",");
}

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

function mapLoad(r: Record<string, unknown>): Load {
  return {
    id: r.id as string,
    load_date: r.load_date as string,
    broker: (r.broker as string | null) ?? "",
    origin: (r.origin as string | null) ?? "",
    destination: (r.destination as string | null) ?? "",
    loaded_miles: Number(r.loaded_miles) || 0,
    deadhead_miles: Number(r.deadhead_miles) || 0,
    linehaul_pay: Number(r.linehaul_pay) || 0,
    fuel_surcharge: Number(r.fuel_surcharge) || 0,
    accessorials: Number(r.accessorials) || 0,
    fuel_actual: r.fuel_actual == null ? null : Number(r.fuel_actual),
    tolls_actual: r.tolls_actual == null ? null : Number(r.tolls_actual),
    lumpers_actual:
      r.lumpers_actual == null ? null : Number(r.lumpers_actual),
    notes: (r.notes as string | null) ?? "",
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

  // Resolve range
  const target = parseDateParam(dateParam);
  let from: string;
  let to: string;
  let label: string;

  if (range === "month") {
    const y = target.getFullYear();
    const m = target.getMonth();
    from = isoDate(new Date(y, m, 1));
    to = isoDate(new Date(y, m + 1, 0));
    const monthName = target.toLocaleString("en-US", { month: "long" });
    label = `${monthName}-${y}`;
  } else if (range === "all") {
    from = "1900-01-01";
    to = "2999-12-31";
    label = "All-Time";
  } else {
    const ws = startOfWeek(target);
    const we = endOfWeek(target);
    from = isoDate(ws);
    to = isoDate(we);
    label = `Week-${from}`;
  }

  const [costRes, loadsRes] = await Promise.all([
    supabase
      .from("cost_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("loads")
      .select("*")
      .eq("user_id", user.id)
      .gte("load_date", from)
      .lte("load_date", to)
      .order("load_date", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  const profile = mapProfile(costRes.data as Record<string, unknown> | null);
  const loads: Load[] = (loadsRes.data ?? []).map((r) =>
    mapLoad(r as Record<string, unknown>)
  );
  // For ranges that span months (the All Time export, or any custom range
  // wider than a single month), allocate fixed costs per-load using each
  // load's own month total, not the whole export range.
  const monthMiles = monthlyMilesByLoad(loads);

  // Accumulators for totals row
  let tLoaded = 0;
  let tDH = 0;
  let tLinehaul = 0;
  let tFsc = 0;
  let tAccessorials = 0;
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

  for (const load of loads) {
    const ownMiles =
      Number(load.loaded_miles || 0) + Number(load.deadhead_miles || 0);
    const monthKey = loadMonthKey(load.load_date);
    const otherMonthMiles = Math.max(
      0,
      (monthMiles.get(monthKey) ?? 0) - ownMiles
    );
    const e = computeLoadEconomics(load, profile, { otherMonthMiles });
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
      ])
    );

    tLoaded += load.loaded_miles;
    tDH += load.deadhead_miles;
    tLinehaul += load.linehaul_pay;
    tFsc += load.fuel_surcharge;
    tAccessorials += load.accessorials;
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
