import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Wordmark } from "@/components/Wordmark";
import { HeaderNav } from "@/components/HeaderNav";
import { BottomNav } from "@/components/BottomNav";
import { isAdminEmail } from "@/lib/admin";
import { fetchSubscription, isPro } from "@/lib/subscription";
import {
  driverPayTreatment,
  entityTypeLabel,
  truckFinancingLabel,
  type TaxProfile,
  type EntityType,
  type TruckFinancing,
} from "@/lib/tax/types";
import {
  aggregateRevenue,
  aggregateLoadActuals,
  TAX_PACK_DISCLAIMER,
} from "@/lib/tax/report";
import type { Load } from "@/lib/loads";
import { YearSelect } from "./YearSelect";

const money = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

const moneyCents = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });

function thisYear(): number {
  return new Date().getFullYear();
}

export const dynamic = "force-dynamic";

export default async function TaxPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { year: yearParam } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const sub = await fetchSubscription(supabase, user.id);
  if (!isPro(sub)) redirect("/upgrade");

  const taxYear = Number.parseInt(yearParam ?? String(thisYear()), 10);
  const yearStart = `${taxYear}-01-01`;
  const yearEnd = `${taxYear}-12-31`;

  const [profileRes, loadsRes, expensesRes, assetsRes, perDiemRes] =
    await Promise.all([
      supabase
        .from("tax_profiles")
        .select("entity_type,has_hired_driver,truck_financing")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("loads")
        .select(
          "load_date,loaded_miles,deadhead_miles,linehaul_pay,fuel_surcharge,accessorials,fuel_actual,tolls_actual,lumpers_actual"
        )
        .eq("user_id", user.id)
        .gte("load_date", yearStart)
        .lte("load_date", yearEnd),
      supabase
        .from("expenses")
        .select("amount")
        .eq("user_id", user.id)
        .gte("expense_date", yearStart)
        .lte("expense_date", yearEnd),
      supabase
        .from("capital_assets")
        .select("cost")
        .eq("user_id", user.id)
        .gte("placed_in_service", yearStart)
        .lte("placed_in_service", yearEnd),
      supabase
        .from("per_diem_summary")
        .select("period_a_nights,period_b_nights")
        .eq("user_id", user.id)
        .eq("tax_year", taxYear)
        .maybeSingle(),
    ]);

  const profile: TaxProfile = profileRes.data
    ? {
        entity_type: (profileRes.data.entity_type as EntityType | null) ?? null,
        has_hired_driver: Boolean(profileRes.data.has_hired_driver),
        truck_financing:
          (profileRes.data.truck_financing as TruckFinancing | null) ?? null,
      }
    : { entity_type: null, has_hired_driver: false, truck_financing: null };
  const profileSet = profile.entity_type != null && profile.truck_financing != null;

  const loads: Load[] = (loadsRes.data ?? []).map((r) => ({
    load_date: r.load_date,
    broker: "",
    origin: "",
    destination: "",
    loaded_miles: Number(r.loaded_miles) || 0,
    deadhead_miles: Number(r.deadhead_miles) || 0,
    linehaul_pay: Number(r.linehaul_pay) || 0,
    fuel_surcharge: Number(r.fuel_surcharge) || 0,
    accessorials: Number(r.accessorials) || 0,
    fuel_actual: r.fuel_actual == null ? null : Number(r.fuel_actual),
    tolls_actual: r.tolls_actual == null ? null : Number(r.tolls_actual),
    lumpers_actual: r.lumpers_actual == null ? null : Number(r.lumpers_actual),
    notes: "",
  }));

  const revenue = aggregateRevenue(loads);
  const loadActuals = aggregateLoadActuals(loads);
  const expenseTotal = (expensesRes.data ?? []).reduce(
    (s, e) => s + (Number(e.amount) || 0),
    0
  );
  const assetTotal = (assetsRes.data ?? []).reduce(
    (s, a) => s + (Number(a.cost) || 0),
    0
  );
  const perDiemRow = perDiemRes.data;
  const perDiemNights =
    (perDiemRow ? Number(perDiemRow.period_a_nights) : 0) +
    (perDiemRow ? Number(perDiemRow.period_b_nights) : 0);

  const currentYear = thisYear();
  const years = [currentYear - 2, currentYear - 1, currentYear];
  const driverPay = driverPayTreatment(profile);

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 bg-white border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Wordmark size="md" />
          <HeaderNav
            variant="tax"
            email={user.email ?? ""}
            isAdmin={isAdminEmail(user.email)}
            isPro
          />
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-4 pb-28 md:pb-8">
        <div className="flex items-end justify-between mb-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-brand font-bold">
              Tax Pack
            </p>
            <h1 className="text-2xl font-black">Year-end records</h1>
          </div>
          <YearSelect taxYear={taxYear} years={years} />
        </div>

        <p className="text-xs text-muted mb-4 leading-snug">
          Organized records for your accountant. Tax Pack reads only actual
          dollars — not the estimates and reserves from your Calculator.
        </p>

        {!profileSet && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 mb-4">
            <p className="font-bold text-sm">Set up your Tax Profile first</p>
            <p className="text-xs text-foreground/80 mt-1 leading-snug">
              We need your entity type and truck financing to know which line
              items belong in the Tax Pack (e.g. owner&apos;s draw is excluded
              for sole props/SMLLCs; financed truck payments are not
              deductible — only interest is).
            </p>
            <Link
              href="/tax/profile"
              className="mt-3 inline-flex items-center justify-center h-10 px-4 rounded-xl bg-brand hover:bg-brand-dark text-white text-sm font-semibold"
            >
              Open Tax Profile
            </Link>
          </div>
        )}

        {/* Headline summary card */}
        <section className="bg-gradient-to-br from-brand to-brand-dark text-white rounded-2xl p-5 mb-4 shadow-sm">
          <p className="text-xs uppercase tracking-wider opacity-80 font-semibold">
            Gross revenue · {taxYear}
          </p>
          <p className="text-5xl font-black mt-1 leading-none">
            {money(revenue.total)}
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
            <div className="bg-white/15 rounded-xl p-3">
              <p className="opacity-80 text-xs">Linehaul</p>
              <p className="text-base font-bold">{money(revenue.linehaul)}</p>
            </div>
            <div className="bg-white/15 rounded-xl p-3">
              <p className="opacity-80 text-xs">FSC</p>
              <p className="text-base font-bold">
                {money(revenue.fuel_surcharge)}
              </p>
            </div>
            <div className="bg-white/15 rounded-xl p-3">
              <p className="opacity-80 text-xs">Accessorials</p>
              <p className="text-base font-bold">
                {money(revenue.accessorials)}
              </p>
            </div>
          </div>
          <p className="text-xs opacity-90 mt-3">
            {loads.length.toLocaleString()} loads ·{" "}
            {loadActuals.totalMiles.toLocaleString()} total miles (
            {loadActuals.loadedMiles.toLocaleString()} loaded +{" "}
            {loadActuals.deadheadMiles.toLocaleString()} deadhead)
          </p>
        </section>

        {/* Stat tiles */}
        <section className="grid grid-cols-2 gap-3 mb-4">
          <StatCard
            href={`/tax/expenses?year=${taxYear}`}
            label="Expenses (non-load)"
            value={money(expenseTotal)}
            subtitle="Categorized actuals"
          />
          <StatCard
            href={`/tax/assets?year=${taxYear}`}
            label="Capital assets"
            value={money(assetTotal)}
            subtitle="Listed separately — CPA depreciates"
          />
          <StatCard
            href={`/tax/per-diem?year=${taxYear}`}
            label="Per-diem"
            value={`${perDiemNights} nights`}
            subtitle="× rate × 80% (DOT)"
          />
          <StatCard
            href={`/tax/profile`}
            label="Tax Profile"
            value={entityTypeLabel(profile.entity_type)}
            subtitle={`${truckFinancingLabel(profile.truck_financing)} · ${
              profile.has_hired_driver ? "Has hired driver" : "Owner-driver"
            }`}
          />
        </section>

        {/* Load-derived actuals snapshot (tax view) */}
        <section className="bg-white border border-border rounded-2xl p-5 mb-4">
          <p className="text-xs uppercase tracking-wider text-muted font-semibold">
            From your loads · {taxYear}
          </p>
          <p className="text-sm text-muted mb-3 leading-snug">
            Only actual receipts entered on each load. Estimates and reserves
            from the Calculator never appear here.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
            <Stat
              label="Fuel actual"
              value={money(loadActuals.fuelActualTotal)}
              subtitle={`${loadActuals.fuelLoadsWithActual} of ${loadActuals.fuelLoadsTotal} loads`}
            />
            <Stat
              label="Tolls actual"
              value={money(loadActuals.tollsActualTotal)}
            />
            <Stat
              label="Lumpers actual"
              value={money(loadActuals.lumpersActualTotal)}
            />
          </div>
        </section>

        {/* Driver pay treatment note */}
        <section className="bg-white border border-border rounded-2xl p-5 mb-4 text-sm">
          <p className="font-semibold mb-1">Driver pay treatment</p>
          <p className="text-muted leading-snug">
            {driverPay === "owner_draw_excluded" && (
              <>
                Your owner&apos;s pay is a <strong>draw</strong>, not a
                deductible expense. We deliberately exclude
                &quot;driver pay&quot; from your Tax Pack — that number lives
                in the Calculator for load decisions only.
              </>
            )}
            {driverPay === "wages_or_1099" && (
              <>
                You have a hired driver. Enter their actual{" "}
                <strong>wages (W-2)</strong> or{" "}
                <strong>contract pay (1099)</strong> as Expenses (use the
                &quot;Other&quot; category with a clear note). Your CPA will
                place them on the right Schedule C line. Your own
                owner&apos;s pay stays excluded.
              </>
            )}
            {driverPay === "owner_w2_wages" && (
              <>
                S-corp: enter your <strong>actual W-2 wages</strong> as an
                Expense (Other category, note &quot;owner W-2 wages&quot;).
                Your CPA will place them correctly. The Calculator&apos;s
                &quot;driver pay per mile&quot; is for load decisions only and
                does not flow here.
              </>
            )}
          </p>
        </section>

        {/* CTA */}
        <section className="bg-white border border-border rounded-2xl p-5 mb-4">
          <p className="text-sm font-semibold mb-1">Year-end export</p>
          <p className="text-xs text-muted mb-3 leading-snug">
            Downloads a CSV grouped by Schedule C line plus a printable summary
            you can hand your accountant.
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              href={`/api/tax/export?year=${taxYear}&format=csv`}
              className="inline-flex items-center justify-center h-10 px-4 rounded-xl bg-brand hover:bg-brand-dark text-white text-sm font-semibold"
            >
              Download Tax Pack (CSV)
            </a>
            <a
              href={`/api/tax/export?year=${taxYear}&format=html`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center h-10 px-4 rounded-xl border border-border bg-white text-sm font-semibold hover:border-brand"
            >
              Printable summary
            </a>
          </div>
        </section>

        <p className="text-[11px] text-muted leading-snug mt-2">
          {TAX_PACK_DISCLAIMER}
        </p>

        {/* Below: tiny totals for audit feel */}
        <p className="text-[10px] text-muted mt-4">
          Audit: revenue {moneyCents(revenue.total)} · load-actuals (fuel +
          tolls + lumpers) {moneyCents(
            loadActuals.fuelActualTotal +
              loadActuals.tollsActualTotal +
              loadActuals.lumpersActualTotal
          )}{" "}
          · non-load expenses {moneyCents(expenseTotal)} · capital assets{" "}
          {moneyCents(assetTotal)} (excluded from expense totals)
        </p>
      </div>
      <BottomNav isPro />
    </main>
  );
}

function StatCard({
  href,
  label,
  value,
  subtitle,
}: {
  href: string;
  label: string;
  value: string;
  subtitle: string;
}) {
  return (
    <Link
      href={href}
      className="bg-white border border-border rounded-2xl p-4 hover:border-brand transition"
    >
      <p className="text-xs uppercase tracking-wider text-muted font-semibold">
        {label}
      </p>
      <p className="text-xl font-black mt-1 leading-none text-brand-dark">
        {value}
      </p>
      <p className="text-[11px] text-muted mt-1">{subtitle}</p>
    </Link>
  );
}

function Stat({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <div className="bg-gray-50 rounded-xl p-3">
      <p className="text-muted text-xs">{label}</p>
      <p className="text-sm font-bold">{value}</p>
      {subtitle && <p className="text-[10px] text-muted">{subtitle}</p>}
    </div>
  );
}
