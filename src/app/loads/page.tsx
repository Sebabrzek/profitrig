import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Wordmark } from "@/components/Wordmark";
import { HeaderNav } from "@/components/HeaderNav";
import { isAdminEmail } from "@/lib/admin";
import { fetchSubscription, isPro } from "@/lib/subscription";
import { BottomNav } from "@/components/BottomNav";
import { type CostProfile } from "../actions";
import {
  type Load,
  aggregateWeek,
  computeLoadEconomics,
  endOfMonth,
  endOfWeek,
  formatWeekLabel,
  isoDate,
  loadMonthKey,
  monthlyMilesByLoad,
  parseDateParam,
  startOfMonth,
  startOfWeek,
} from "@/lib/loads";

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

function money(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function moneyCents(n: number) {
  return `$${n.toFixed(2)}`;
}

function profileIsConfigured(p: CostProfile): boolean {
  return p.monthly_miles > 0 && (p.mpg > 0 || p.maintenance_per_mile > 0);
}

export default async function LoadsPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null; // middleware redirects to /login

  const sub = await fetchSubscription(supabase, user.id);
  if (!isPro(sub)) redirect("/upgrade");

  // Resolve target week
  const targetDate = parseDateParam(params.week);
  const weekStart = startOfWeek(targetDate);
  const weekEnd = endOfWeek(targetDate);
  const prevWeek = new Date(weekStart);
  prevWeek.setDate(prevWeek.getDate() - 7);
  const nextWeek = new Date(weekStart);
  nextWeek.setDate(nextWeek.getDate() + 7);

  // Fetch broader month range so we can compute MTD-based fixed-cost
  // allocation for every load in the displayed week, even when a week
  // crosses a month boundary.
  const monthFromCandidate = startOfMonth(weekStart);
  const monthToCandidate = endOfMonth(weekEnd);
  const monthFrom =
    monthFromCandidate < startOfMonth(weekEnd)
      ? monthFromCandidate
      : startOfMonth(weekEnd);
  const monthTo =
    monthToCandidate > endOfMonth(weekStart)
      ? monthToCandidate
      : endOfMonth(weekStart);

  const [costRes, monthLoadsRes] = await Promise.all([
    supabase
      .from("cost_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("loads")
      .select("*")
      .eq("user_id", user.id)
      .gte("load_date", isoDate(monthFrom))
      .lte("load_date", isoDate(monthTo))
      .order("load_date", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  // Synthetic "loadsRes" filtered to the displayed week.
  const loadsRes = {
    data: (monthLoadsRes.data ?? []).filter((r) => {
      return r.load_date >= isoDate(weekStart) && r.load_date <= isoDate(weekEnd);
    }),
  };

  const profile: CostProfile = costRes.data
    ? {
        truck_payment: Number(costRes.data.truck_payment) || 0,
        trailer_payment: Number(costRes.data.trailer_payment) || 0,
        insurance: Number(costRes.data.insurance) || 0,
        eld_subscriptions: Number(costRes.data.eld_subscriptions) || 0,
        permits_irp_ifta: Number(costRes.data.permits_irp_ifta) || 0,
        office_misc: Number(costRes.data.office_misc) || 0,
        load_board_per_month: Number(costRes.data.load_board_per_month) || 0,
        other_monthly_bill: Number(costRes.data.other_monthly_bill) || 0,
        other_label: costRes.data.other_label ?? "",
        monthly_miles: Number(costRes.data.monthly_miles) || 0,
        mpg: Number(costRes.data.mpg) || 0,
        fuel_price_per_gallon: Number(costRes.data.fuel_price_per_gallon) || 0,
        maintenance_per_mile: Number(costRes.data.maintenance_per_mile) || 0,
        tires_per_mile: Number(costRes.data.tires_per_mile) || 0,
        def_per_mile: Number(costRes.data.def_per_mile) || 0,
        driver_pay_per_mile: Number(costRes.data.driver_pay_per_mile) || 0,
        tolls_misc_per_mile: Number(costRes.data.tolls_misc_per_mile) || 0,
        desired_profit_per_mile:
          Number(costRes.data.desired_profit_per_mile) || 0,
        real_cpm_override:
          costRes.data.real_cpm_override == null
            ? null
            : Number(costRes.data.real_cpm_override),
      }
    : EMPTY_PROFILE;

  const loads: Load[] = (loadsRes.data ?? []).map((r) => ({
    id: r.id,
    load_date: r.load_date,
    broker: r.broker ?? "",
    origin: r.origin ?? "",
    destination: r.destination ?? "",
    loaded_miles: Number(r.loaded_miles) || 0,
    deadhead_miles: Number(r.deadhead_miles) || 0,
    linehaul_pay: Number(r.linehaul_pay) || 0,
    fuel_surcharge: Number(r.fuel_surcharge) || 0,
    accessorials: Number(r.accessorials) || 0,
    fuel_actual: r.fuel_actual == null ? null : Number(r.fuel_actual),
    tolls_actual: r.tolls_actual == null ? null : Number(r.tolls_actual),
    lumpers_actual: r.lumpers_actual == null ? null : Number(r.lumpers_actual),
    notes: r.notes ?? "",
  }));

  // Build map of YYYY-MM -> total miles using ALL loads in the broader
  // month range, so each load's allocation reflects its full month.
  const monthLoads: Load[] = (monthLoadsRes.data ?? []).map((r) => ({
    id: r.id,
    load_date: r.load_date,
    broker: r.broker ?? "",
    origin: r.origin ?? "",
    destination: r.destination ?? "",
    loaded_miles: Number(r.loaded_miles) || 0,
    deadhead_miles: Number(r.deadhead_miles) || 0,
    linehaul_pay: 0,
    fuel_surcharge: 0,
    accessorials: 0,
    fuel_actual: null,
    tolls_actual: null,
    lumpers_actual: null,
    notes: "",
  }));
  const monthMiles = monthlyMilesByLoad(monthLoads);

  const totals = aggregateWeek(loads, profile, monthMiles);
  const isConfigured = profileIsConfigured(profile);

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 bg-white border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Wordmark size="md" />
          <HeaderNav
            variant="loads"
            email={user.email ?? ""}
            isAdmin={isAdminEmail(user.email)}
            isPro
          />
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4 pb-28 md:pb-8">
        {!isConfigured && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 mb-4">
            <p className="font-bold text-sm">Set up your cost per mile first</p>
            <p className="text-xs text-foreground/80 mt-1">
              The load tracker uses your saved monthly costs and per-mile rates
              from the calculator. Open the calculator, fill it in, hit Save,
              then come back here.
            </p>
            <Link
              href="/"
              className="mt-3 inline-flex items-center justify-center h-10 px-4 rounded-xl bg-brand hover:bg-brand-dark text-white font-semibold text-sm"
            >
              Open Calculator
            </Link>
          </div>
        )}

        {/* Week navigator */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <Link
            href={`/loads?week=${isoDate(prevWeek)}`}
            className="h-10 px-3 rounded-xl border border-border bg-white text-sm font-semibold hover:bg-gray-50"
          >
            ← Prev
          </Link>
          <div className="flex-1 text-center">
            <p className="text-xs text-muted uppercase tracking-wider font-semibold">
              Week of
            </p>
            <p className="text-sm font-bold">{formatWeekLabel(weekStart)}</p>
          </div>
          <Link
            href={`/loads?week=${isoDate(nextWeek)}`}
            className="h-10 px-3 rounded-xl border border-border bg-white text-sm font-semibold hover:bg-gray-50"
          >
            Next →
          </Link>
        </div>

        {/* Weekly summary */}
        <div
          className={`rounded-2xl p-5 mb-4 shadow-sm text-white ${
            totals.profit >= 0
              ? "bg-gradient-to-br from-brand to-brand-dark"
              : "bg-gradient-to-br from-red-500 to-red-700"
          }`}
        >
          <p className="text-xs uppercase tracking-wider opacity-80 font-semibold">
            Week profit
          </p>
          <p className="text-5xl font-black mt-1 leading-none">
            {money(totals.profit)}
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
            <div className="bg-white/15 rounded-xl p-3">
              <p className="opacity-80 text-xs">Revenue</p>
              <p className="text-base font-bold">{money(totals.revenue)}</p>
            </div>
            <div className="bg-white/15 rounded-xl p-3">
              <p className="opacity-80 text-xs">Costs</p>
              <p className="text-base font-bold">{money(totals.totalCost)}</p>
            </div>
            <div className="bg-white/15 rounded-xl p-3">
              <p className="opacity-80 text-xs">Loads</p>
              <p className="text-base font-bold">{totals.loads}</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div className="bg-white/15 rounded-xl p-3">
              <p className="opacity-80 text-xs">Total miles</p>
              <p className="text-base font-bold">
                {totals.totalMiles.toLocaleString()}
              </p>
              <p className="text-xs opacity-80">
                {totals.loadedMiles.toLocaleString()} loaded •{" "}
                {totals.deadheadMiles.toLocaleString()} deadhead
                {totals.totalMiles > 0
                  ? ` (${totals.deadheadPct.toFixed(0)}%)`
                  : ""}
              </p>
            </div>
            <div className="bg-white/15 rounded-xl p-3">
              <p className="opacity-80 text-xs">Avg rate / mile</p>
              <p className="text-base font-bold">{moneyCents(totals.rpm)}</p>
              <p className="text-xs opacity-80">
                cost {moneyCents(totals.cpm)}
              </p>
            </div>
          </div>
        </div>

        {/* Add load CTA */}
        <Link
          href={`/loads/new?date=${isoDate(targetDate)}`}
          className={`flex items-center justify-center h-14 rounded-2xl text-base font-bold mb-4 transition ${
            isConfigured
              ? "bg-brand hover:bg-brand-dark text-white"
              : "bg-gray-200 text-muted cursor-not-allowed pointer-events-none"
          }`}
        >
          + Add a Load
        </Link>

        {/* Export to Sheets/Excel */}
        {isConfigured && (
          <section className="bg-white border border-border rounded-2xl p-4 mb-4">
            <h3 className="text-sm font-bold mb-1">
              Export to Sheets / Excel
            </h3>
            <p className="text-xs text-muted mb-3">
              Download a CSV with every load + auto-totals. Opens in Google
              Sheets, Excel, or Numbers.
            </p>
            <div className="flex flex-wrap gap-2">
              <a
                href={`/api/loads/export?range=week&date=${isoDate(targetDate)}`}
                className="inline-flex items-center justify-center h-10 px-4 rounded-xl border border-border bg-white text-sm font-semibold hover:border-brand hover:text-brand-dark"
              >
                This Week
              </a>
              <a
                href={`/api/loads/export?range=month&date=${isoDate(targetDate)}`}
                className="inline-flex items-center justify-center h-10 px-4 rounded-xl border border-border bg-white text-sm font-semibold hover:border-brand hover:text-brand-dark"
              >
                This Month
              </a>
              <a
                href={`/api/loads/export?range=all`}
                className="inline-flex items-center justify-center h-10 px-4 rounded-xl border border-border bg-white text-sm font-semibold hover:border-brand hover:text-brand-dark"
              >
                All Time
              </a>
            </div>
          </section>
        )}

        {/* Load list */}
        {loads.length === 0 ? (
          <div className="bg-white border border-border rounded-2xl p-8 text-center">
            <p className="text-muted text-sm">
              No loads this week. Tap{" "}
              <span className="font-semibold text-foreground">Add a Load</span>{" "}
              after every trip to track your real profit.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {loads.map((load) => {
              const ownMiles =
                Number(load.loaded_miles || 0) +
                Number(load.deadhead_miles || 0);
              const monthKey = loadMonthKey(load.load_date);
              const otherMonthMiles = Math.max(
                0,
                (monthMiles.get(monthKey) ?? 0) - ownMiles
              );
              const e = computeLoadEconomics(load, profile, { otherMonthMiles });
              const dateLabel = new Date(
                load.load_date + "T12:00:00"
              ).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              });
              const isWin = e.profit >= 0;
              return (
                <Link
                  key={load.id}
                  href={`/loads/${load.id}`}
                  className="bg-white border border-border rounded-2xl p-4 hover:border-brand transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-muted">{dateLabel}</p>
                      <p className="font-bold text-base truncate">
                        {load.broker || "Untitled load"}
                      </p>
                      {(load.origin || load.destination) && (
                        <p className="text-xs text-muted truncate">
                          {load.origin || "—"} →{" "}
                          {load.destination || "—"}
                        </p>
                      )}
                    </div>
                    <div
                      className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-bold ${
                        isWin
                          ? "bg-brand-soft text-brand-dark"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {isWin ? "+" : ""}
                      {money(e.profit)}
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-gray-50 rounded-lg px-3 py-2">
                      <p className="text-muted">Miles</p>
                      <p className="font-bold text-sm">
                        {e.totalMiles.toLocaleString()}
                      </p>
                      <p className="text-[10px] text-muted">
                        {e.deadheadPct.toFixed(0)}% DH
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg px-3 py-2">
                      <p className="text-muted">Revenue</p>
                      <p className="font-bold text-sm">{money(e.revenue)}</p>
                      <p className="text-[10px] text-muted">
                        {moneyCents(e.rpm)} / mi
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg px-3 py-2">
                      <p className="text-muted">Cost</p>
                      <p className="font-bold text-sm">
                        {money(e.totalCost)}
                      </p>
                      <p className="text-[10px] text-muted">
                        {moneyCents(e.cpm)} / mi
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
      <BottomNav isPro />
    </main>
  );
}
