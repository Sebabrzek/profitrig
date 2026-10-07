import Link from "next/link";
import { Fragment } from "react";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import {
  Card,
  CardHeader,
  PageHeader,
  SectionHeading,
} from "@/components/ui/Surfaces";
import { Notice } from "@/components/ui/Notice";
import { Chip } from "@/components/ui/Chip";
import { buttonClass } from "@/components/ui/Button";
import {
  InstrumentPanel,
  PanelNote,
  Reading,
  ReadingGrid,
} from "@/components/instruments/Instruments";
import {
  LoadLedger,
  LoadRecord,
  PartialRecord,
  TripLine,
} from "@/app/loads/LoadRecord";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin";
import { fetchDriverSettings } from "@/lib/driverSettings";
import { driverToday } from "@/lib/driverClock";
import { costProfileFromRow } from "@/lib/costProfile";
import { computeCalculatorTotals } from "@/lib/calculatorTotals";
import {
  buildMtdContext,
  computeLoadEconomics,
  effectiveCarrierPct,
  formatWeekLabel,
  isoDate,
  loadFromRow,
  loadMonthKey,
  monthStatsByLoad,
  startOfWeek,
  type Load,
} from "@/lib/loads";
import {
  groupTrips,
  isPartial,
  partialExtraMiles,
  tripLabel,
  tripTotals,
} from "@/lib/partials";
import { adminWeeks, driverNote, gmailHref, mailtoHref } from "@/lib/adminView";
import { findLookalikes, loadChecks, openChecks, profileChecks } from "@/lib/checks";
import { computeFuelStats, type FuelLog } from "@/lib/fuel";
import { roadCategoryMeta, type RoadExpense } from "@/lib/roadExpenses";
import { formatMoney, formatRate, outcomeOf } from "@/lib/format";
import { CheckList, DataTable, KeyValues } from "./Sections";
import type { SubscriptionRow } from "@/lib/subscription";
import { fetchAiBudget } from "@/lib/aiBudget";
import { AI_TIER_LABEL, formatAiDollars, formatResetDate } from "@/lib/aiGuard";
import { addressFor } from "@/lib/emailIn";

/**
 * One driver, everything they have entered, READ-ONLY — so Sebastian can sit
 * with a driver's numbers and catch mistakes without the driver's password.
 *
 * Every figure is priced by the same functions the driver's own screens run
 * (computeCalculatorTotals, computeLoadEconomics, aggregateWeek), with fixed
 * costs spread over each load's whole month and weeks cut by the DRIVER's own
 * week setting. So Admin shows exactly the numbers the driver sees. The one
 * difference is "today", which is the reviewer's: a month still in progress
 * is judged from the reviewer's calendar, which can differ by a day.
 *
 * Gate: signed in AND on ADMIN_EMAILS, checked here on the server before any
 * service-role read — the same gate as /admin. Nothing on this page writes.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const day = (iso: string | null | undefined, withYear = true) =>
  iso
    ? new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString(
        "en-US",
        withYear
          ? { month: "short", day: "numeric", year: "numeric" }
          : { weekday: "short", month: "short", day: "numeric" }
      )
    : "—";
const money = (n: number | null | undefined) => (n == null ? "—" : formatMoney(n));
const rate = (n: number | null | undefined) => (n == null ? "—" : formatRate(n));
const miles = (n: number) => n.toLocaleString("en-US");
const est = <span className="text-muted">est.</span>;

export default async function AdminDriverPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ week?: string }>;
}) {
  const [{ id }, { week: weekParam }] = await Promise.all([params, searchParams]);

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) notFound();
  if (!UUID.test(id)) notFound();
  const admin = createSupabaseAdminClient();
  if (!admin) notFound();

  const { data: authData } = await admin.auth.admin.getUserById(id);
  const driver = authData?.user;
  if (!driver) notFound();

  // Every read is scoped to this one driver. (The column list is typed as
  // "*" only so the query builder does not try to parse a runtime string.)
  const byUser = (table: string, columns = "*") =>
    admin.from(table).select(columns as "*").eq("user_id", id);

  const [
    settings,
    { now },
    profileRes,
    costRes,
    snapshotsRes,
    subRes,
    loadsRes,
    roadRes,
    rigRes,
    fuelRes,
    taxProfileRes,
    perDiemRes,
    expensesRes,
    assetsRes,
    chatRes,
    usageRes,
    feedbackRes,
    scansRes,
    inboxRes,
  ] = await Promise.all([
    fetchDriverSettings(admin, id),
    driverToday(),
    byUser("driver_profiles").maybeSingle(),
    byUser("cost_profiles").maybeSingle(),
    byUser("cost_profile_snapshots").order("created_at", { ascending: false }),
    byUser("subscriptions").maybeSingle(),
    byUser("loads").order("load_date", { ascending: false }).order("created_at", { ascending: false }),
    byUser("road_expenses").order("spent_on", { ascending: false }),
    byUser("rigs").maybeSingle(),
    byUser("fuel_logs", "id,logged_on,odometer,gallons").order("odometer", { ascending: false }),
    byUser("tax_profiles").maybeSingle(),
    byUser("per_diem_summary").order("tax_year", { ascending: false }),
    byUser("expenses").order("expense_date", { ascending: false }),
    byUser("capital_assets").order("placed_in_service", { ascending: false }),
    byUser("support_chats", "id,role,content,created_at").order("created_at", { ascending: false }).limit(60),
    byUser("ai_usage", "status,estimated_cost_usd,created_at"),
    admin.from("feedback").select("id,message,created_at").eq("user_id", id).order("created_at", { ascending: false }),
    // Empty before migration 020.
    byUser("scans", "*").order("created_at", { ascending: false }).limit(50),
    // Empty before migration 021.
    byUser("email_in_addresses", "local_part").maybeSingle(),
  ]);
  const [{ data: me }, aiBudget] = await Promise.all([
    admin.from("driver_profiles").select("first_name").eq("user_id", user.id).maybeSingle(),
    fetchAiBudget(admin, id, (subRes.data ?? null) as SubscriptionRow | null, new Date()),
  ]);

  type Row = Record<string, unknown>;
  const p = (profileRes.data ?? null) as Row | null;
  const name = [p?.first_name, p?.last_name].filter(Boolean).join(" ");
  const costRow = (costRes.data ?? null) as Row | null;
  const profile = costProfileFromRow(costRow ?? {});
  const totals = computeCalculatorTotals(profile);
  const sub = (subRes.data ?? null) as Row | null;

  // ── loads, priced as the driver's Loads tab prices them ─────────────────
  const loads: Load[] = ((loadsRes.data ?? []) as Row[]).map((r) => loadFromRow(r));
  const loadRows = new Map(((loadsRes.data ?? []) as Row[]).map((r) => [String(r.id), r]));
  const byId = new Map(loads.map((l) => [String(l.id), l]));
  const months = monthStatsByLoad(loads);
  const ownMiles = (l: Load) => (Number(l.loaded_miles) || 0) + (Number(l.deadhead_miles) || 0);
  const econ = (l: Load) => {
    const st = months.get(loadMonthKey(l.load_date));
    return computeLoadEconomics(
      l,
      profile,
      buildMtdContext(l.load_date, Math.max(0, (st?.miles ?? 0) - ownMiles(l)), st?.firstDay ?? 1, now)
    );
  };
  const road: RoadExpense[] = ((roadRes.data ?? []) as Row[]).map((r) => ({
    id: String(r.id),
    spent_on: String(r.spent_on),
    category: String(r.category) as RoadExpense["category"],
    amount: Number(r.amount) || 0,
    note: (r.note as string | null) ?? "",
  }));
  const weeks = adminWeeks(loads, road, profile, settings.weekStart, now);
  const lookalikes = findLookalikes(loads);
  const today = isoDate(now);
  const weekOf = (iso: string) => isoDate(startOfWeek(new Date(`${iso}T12:00:00`), settings.weekStart));
  // Open alerts, and the ones the driver has marked "this is right" — the
  // latter shown as confirmed, never counted as problems.
  const alertsFor = (l: Load) =>
    openChecks(
      loadChecks(l, econ(l), {
        fuelEstimate: computeLoadEconomics({ ...l, fuel_actual: null }, profile, undefined).fuelCost,
        primaryMiles: l.parent_load_id ? ownMiles(byId.get(l.parent_load_id) ?? l) : undefined,
        lookalike: lookalikes.has(String(l.id)),
        today,
      }),
      l.dismissed_checks
    );
  const checksFor = (l: Load) => alertsFor(l).open;

  // ── fuel ────────────────────────────────────────────────────────────────
  const rig = (rigRes.data ?? null) as Row | null;
  const fuelLogs: FuelLog[] = ((fuelRes.data ?? []) as Row[]).map((l) => ({
    id: String(l.id),
    logged_on: String(l.logged_on),
    odometer: Number(l.odometer),
    gallons: Number(l.gallons),
  }));
  const fuel = computeFuelStats(rig?.starting_odometer == null ? null : Number(rig.starting_odometer), fuelLogs);

  // ── everything worth a look, newest first ───────────────────────────────
  const flags: { text: string; where?: string; href?: string }[] = [
    ...(costRow
      ? profileChecks(profile, totals, fuel.averageMpg).map((text) => ({ text, where: "Calculator", href: "#cpm" }))
      : [{ text: "No Calculator saved yet — every load is costed at $0 a mile", where: "Calculator", href: "#cpm" }]),
    ...loads.flatMap((l) =>
      checksFor(l).map((text) => ({
        text,
        where: `${day(l.load_date, false)} · ${l.broker || (isPartial(l) ? "partial" : "load")}`,
        href: `?week=${weekOf(l.load_date)}#entry-${l.id}`,
      }))
    ),
  ];

  const selected =
    weeks.find((w) => w.weekStart === (weekParam ? weekOf(weekParam) : "")) ?? weeks[0] ?? null;

  // A note to the driver about the week in view, for Sebastian to send from
  // his own email. ProfitRig stores and sends nothing.
  const calcFlags = costRow ? profileChecks(profile, totals, fuel.averageMpg) : [];
  const note = driverNote({
    firstName: String(p?.first_name ?? ""),
    weekLabel: selected ? formatWeekLabel(new Date(`${selected.weekStart}T12:00:00`)) : null,
    items: [
      ...(selected?.loads ?? []).flatMap((l) =>
        checksFor(l).map((text) => ({ where: `${day(l.load_date, false)} · ${l.broker || (isPartial(l) ? "partial" : "load")}`, text }))
      ),
      ...calcFlags.map((text) => ({ where: "Your Calculator", text })),
    ],
    from: me?.first_name ? `${me.first_name}, ProfitRig` : "ProfitRig",
  });
  const firstName = String(p?.first_name ?? "").trim() || "driver";

  const usage = ((usageRes.data ?? []) as Row[]);
  const aiCost = usage.reduce((s, u) => s + (Number(u.estimated_cost_usd) || 0), 0);

  return (
    <AppShell width="wide" account={{ email: user.email ?? "", isPro: true, isAdmin: true }}>
      <PageHeader
        eyebrow="Driver · read-only"
        title={name || driver.email || "Driver"}
        description={name ? driver.email : undefined}
        action={
          <Link href="/admin" className="pr-link pr-hit text-sm">
            ← All users
          </Link>
        }
      />
      <Notice size="sm" className="mb-5">
        Exactly what this driver entered, priced the way their own screens
        price it. Nothing here can be changed from Admin.
      </Notice>

      {/* Reach them from your own email, with what is worth a look in the
          week you are viewing already written out. */}
      {driver.email && (
        <div className="mb-6">
          <div className="flex flex-wrap gap-2">
            <a href={mailtoHref(driver.email, note.subject, note.body)} className={buttonClass({ variant: "dark", size: "sm" })}>
              Email {firstName}
            </a>
            <a
              href={gmailHref(driver.email, note.subject, note.body)}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClass({ variant: "secondary", size: "sm" })}
            >
              Open in Gmail
            </a>
          </div>
          <p className="mt-2 text-xs text-muted">
            Pre-written with what&apos;s worth a look in the week you&apos;re
            viewing. You edit it before it goes, and it sends from your own
            email.
          </p>
        </div>
      )}

      {/* ── account ─────────────────────────────────────────────────── */}
      <Card className="mb-5">
        <CardHeader title="Account" />
        <KeyValues
          items={[
            ["Email", driver.email ?? "—"],
            ["Name", name || "—"],
            ["Phone", (p?.phone as string) || "—"],
            ["Company", (p?.company_name as string) || "—"],
            ["Home", [p?.domicile_city, p?.domicile_state].filter(Boolean).join(", ") || "—"],
            ["Trailer", (p?.trailer_type as string) || "—"],
            ["Authority", (p?.authority_type as string) || "—"],
            [
              "Carrier",
              settings.carrierPct != null
                ? `${settings.carrierName || "—"} keeps ${Number(settings.carrierPct.toFixed(2))}%`
                : settings.carrierName || "—",
            ],
            ["Week starts", settings.weekStart === "sunday" ? "Sunday" : "Monday"],
            [
              "Plan",
              sub
                ? `${String(sub.status)}${sub.current_period_end ? ` until ${day(String(sub.current_period_end))}` : ""}${sub.cancel_at_period_end ? " (cancelling)" : ""}`
                : "Free",
            ],
            [
              "AI this month",
              aiBudget
                ? `${formatAiDollars(aiBudget.spentUsd)} of ${formatAiDollars(aiBudget.budgetUsd)} (${AI_TIER_LABEL[aiBudget.tier]}) · ${aiBudget.usedPercent}% · resets ${formatResetDate(aiBudget.resetsAt)}`
                : "—",
            ],
            [
              "Email-in",
              inboxRes.data ? addressFor(String((inboxRes.data as Row).local_part)) : "—",
            ],
            ["Signed up", day(driver.created_at)],
            ["Last sign-in", day(driver.last_sign_in_at)],
          ]}
        />
      </Card>

      {/* ── worth a look ────────────────────────────────────────────── */}
      <Card className="mb-8">
        <CardHeader
          title={`Worth a look${flags.length ? ` (${flags.length})` : ""}`}
          description="Patterns that have produced wrong numbers before. The driver may well be right — these are where to start a conversation."
        />
        <CheckList items={flags.slice(0, 60)} />
        {flags.length > 60 && (
          <p className="mt-2 text-sm text-muted">…and {flags.length - 60} more in the weeks below.</p>
        )}
      </Card>

      {/* ── cost per mile ───────────────────────────────────────────── */}
      <section id="cpm" className="mb-8 scroll-mt-24">
        <SectionHeading
          title="Cost per mile"
          description={costRow ? `What they entered in the Calculator, last saved ${day(costRow.updated_at as string)}.` : "They have not saved the Calculator yet."}
        />
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,420px)_1fr]">
          <InstrumentPanel>
            <Reading
              size="hero"
              label="Their cost per mile"
              value={formatRate(totals.totalCPM)}
              unit="/ mi"
              context={profile.real_cpm_override != null && profile.real_cpm_override > 0 && <>manual — their inputs calculate {formatRate(totals.computedCPM)}</>}
            />
            <ReadingGrid wideColumns={2}>
              <Reading label="Target rate" value={formatRate(totals.requiredRate)} unit="/ mi" />
              <Reading label="Break-even month" value={formatMoney(totals.breakEven)} />
              <Reading label="Fixed per mile" value={formatRate(totals.fixedPerMile)} context={<>{formatMoney(totals.fixed)} a month</>} />
              <Reading label="Running per mile" value={formatRate(totals.variablePerMile)} context={<>fuel {formatRate(totals.fuelPerMile)}</>} />
            </ReadingGrid>
          </InstrumentPanel>
          <Card>
            <CardHeader title="What they entered" />
            <KeyValues
              items={[
                ["Truck payment", money(profile.truck_payment)],
                ["Trailer payment", money(profile.trailer_payment)],
                ["Insurance", money(profile.insurance)],
                ["ELD / subscriptions", money(profile.eld_subscriptions)],
                ["Permits / IRP / IFTA", money(profile.permits_irp_ifta)],
                ["Office / parking", money(profile.office_misc)],
                ["Load board", money(profile.load_board_per_month)],
                [profile.other_label ? `Other (${profile.other_label})` : "Other monthly", money(profile.other_monthly_bill)],
                ["Monthly miles", profile.monthly_miles ? miles(profile.monthly_miles) : "—"],
                ["MPG", profile.mpg || "—"],
                ["Diesel price", profile.fuel_price_per_gallon ? `${formatRate(profile.fuel_price_per_gallon)}/gal` : "—"],
                ["Maintenance / mi", rate(profile.maintenance_per_mile)],
                ["Tires / mi", rate(profile.tires_per_mile)],
                ["DEF / mi", rate(profile.def_per_mile)],
                ["Driver pay / mi", rate(profile.driver_pay_per_mile)],
                ["Tolls & misc / mi", rate(profile.tolls_misc_per_mile)],
                ["Profit they want / mi", rate(profile.desired_profit_per_mile)],
                ["Manual cost per mile", profile.real_cpm_override ? formatRate(profile.real_cpm_override) : "not set"],
              ]}
            />
          </Card>
        </div>
        {(snapshotsRes.data ?? []).length > 0 && (
          <Card className="mt-5">
            <CardHeader title="Saved versions" description="Earlier Calculator saves they kept." />
            <DataTable
              caption="Saved Calculator versions"
              columns={[
                { key: "when", label: "Saved" },
                { key: "label", label: "Label" },
                { key: "cpm", label: "Cost / mi", align: "right" },
                { key: "target", label: "Target", align: "right" },
                { key: "miles", label: "Mo. miles", align: "right" },
              ]}
              rows={((snapshotsRes.data ?? []) as Row[]).map((s) => ({
                _key: String(s.id),
                when: day(s.created_at as string),
                label: (s.label as string) || "—",
                cpm: formatRate(Number(s.total_cpm) || 0),
                target: formatRate(Number(s.required_rate) || 0),
                miles: miles(Number(s.monthly_miles) || 0),
              }))}
            />
          </Card>
        )}
      </section>

      {/* ── weeks ───────────────────────────────────────────────────── */}
      <section id="weeks" className="mb-8 scroll-mt-24">
        <SectionHeading
          title="Weeks"
          description={`Every week with a load or an expense, in their own ${settings.weekStart === "sunday" ? "Sunday" : "Monday"} weeks. Choose one to see what was entered.`}
        />
        <Card>
          <DataTable
            caption="Weeks"
            empty="No loads or expenses logged yet."
            columns={[
              { key: "week", label: "Week of" },
              { key: "loads", label: "Loads", align: "right" },
              { key: "miles", label: "Miles", align: "right" },
              { key: "revenue", label: "Revenue", align: "right" },
              { key: "cost", label: "Cost", align: "right" },
              { key: "profit", label: "Profit", align: "right" },
              { key: "rate", label: "Rate / mi", align: "right" },
              { key: "checks", label: "Worth a look", align: "right" },
            ]}
            rows={weeks.map((w) => {
              const n = w.loads.reduce((s, l) => s + checksFor(l).length, 0);
              return {
                _key: w.weekStart,
                _highlight: w.weekStart === selected?.weekStart,
                week: (
                  <Link href={`?week=${w.weekStart}#week`} className="pr-link whitespace-nowrap">
                    {formatWeekLabel(new Date(`${w.weekStart}T12:00:00`))}
                  </Link>
                ),
                loads: `${w.totals.loads}${w.partials ? ` (${w.partials} partial)` : ""}`,
                miles: miles(w.totals.totalMiles),
                revenue: formatMoney(w.totals.revenue),
                cost: formatMoney(w.totals.totalCost),
                profit: formatMoney(w.totals.profit, { signed: true }),
                rate: w.totals.totalMiles > 0 ? formatRate(w.totals.rpm) : "—",
                checks: n > 0 ? <Chip>{n}</Chip> : "",
              };
            })}
          />
        </Card>
      </section>

      {/* ── the selected week ───────────────────────────────────────── */}
      {selected && (
        <section id="week" className="mb-8 scroll-mt-24">
          <SectionHeading
            title={`Week of ${formatWeekLabel(new Date(`${selected.weekStart}T12:00:00`))}`}
            description="As their Loads tab shows it, then every figure they typed."
          />
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,420px)_1fr]">
            <InstrumentPanel>
              <Reading size="hero" label="Week profit" value={formatMoney(selected.totals.profit, { signed: true })} outcome={outcomeOf(selected.totals.profit)} />
              <ReadingGrid>
                <Reading label="Revenue" value={formatMoney(selected.totals.revenue)} context={selected.totals.carrierCut > 0 && <>after {formatMoney(selected.totals.carrierCut)} to carrier</>} />
                <Reading label="Costs" value={formatMoney(selected.totals.totalCost)} context={selected.totals.roadExpenses > 0 && <>incl. {formatMoney(selected.totals.roadExpenses)} other</>} />
                <Reading label="Loads" figure={false} value={String(selected.totals.loads)} context={selected.partials > 0 && <>incl. {selected.partials} partial</>} />
                <Reading label="Total miles" figure={false} value={miles(selected.totals.totalMiles)} context={<>{miles(selected.totals.loadedMiles)} loaded • {miles(selected.totals.deadheadMiles)} deadhead</>} />
                <Reading label="Avg rate / mile" value={formatRate(selected.totals.rpm)} context={<>cost {formatRate(selected.totals.cpm)}</>} />
              </ReadingGrid>
              <PanelNote>Fixed costs spread over each load&apos;s whole month, exactly as on their Loads tab.</PanelNote>
            </InstrumentPanel>
            <div>
              {selected.loads.length > 0 ? (
                <LoadLedger>
                  {groupTrips(selected.loads).map((trip) => {
                    const l = trip.primary;
                    const record = (x: Load) =>
                      isPartial(x) ? (
                        <PartialRecord key={x.id} id={String(x.id)} href={`#entry-${x.id}`} broker={x.broker} origin={x.origin} destination={x.destination} economics={econ(x)} />
                      ) : (
                        <LoadRecord key={x.id} id={String(x.id)} href={`#entry-${x.id}`} dateLabel={day(x.load_date, false)} broker={x.broker} origin={x.origin} destination={x.destination} economics={econ(x)} />
                      );
                    return (
                      <Fragment key={l.id}>
                        {record(l)}
                        {trip.partials.map(record)}
                        {trip.partials.length > 0 && (
                          <TripLine totals={tripTotals(trip, profile, months, now)} partials={trip.partials.length} />
                        )}
                      </Fragment>
                    );
                  })}
                </LoadLedger>
              ) : (
                <p className="text-sm text-muted">No loads this week — only other expenses.</p>
              )}
            </div>
          </div>

          <Card className="mt-5">
            <CardHeader title="Every load as they entered it" description="Blank fuel and tolls are estimated from their Calculator, shown here as “est.”." />
            <DataTable
              caption="Loads as entered"
              columns={[
                { key: "date", label: "Date" },
                { key: "load", label: "Load" },
                { key: "loaded", label: "Loaded mi", align: "right" },
                { key: "dh", label: "Deadhead mi", align: "right" },
                { key: "linehaul", label: "Linehaul", align: "right" },
                { key: "fsc", label: "FSC", align: "right" },
                { key: "acc", label: "Accessorials", align: "right" },
                { key: "pct", label: "Carrier %", align: "right" },
                { key: "fuel", label: "Fuel", align: "right" },
                { key: "tolls", label: "Tolls", align: "right" },
                { key: "lumpers", label: "Lumpers", align: "right" },
                { key: "profit", label: "Profit", align: "right" },
                { key: "notes", label: "Notes & checks" },
              ]}
              rows={selected.loads.map((l) => {
                const e = econ(l);
                const checks = checksFor(l);
                const raw = loadRows.get(String(l.id));
                const parent = l.parent_load_id ? byId.get(l.parent_load_id) : undefined;
                return {
                  _key: String(l.id),
                  _id: `entry-${l.id}`,
                  _highlight: checks.length > 0,
                  date: <span className="whitespace-nowrap">{day(l.load_date, false)}</span>,
                  load: (
                    <>
                      <span className="font-semibold">{l.broker || "—"}</span>
                      <br />
                      <span className="text-muted">
                        {l.origin || "—"} → {l.destination || "—"}
                      </span>
                      {parent && (
                        <>
                          <br />
                          <Chip>Partial</Chip>{" "}
                          <span className="text-muted">of {tripLabel(parent)} · +{miles(partialExtraMiles(l))} mi</span>
                        </>
                      )}
                    </>
                  ),
                  loaded: miles(Number(l.loaded_miles) || 0),
                  dh: miles(Number(l.deadhead_miles) || 0),
                  linehaul: formatMoney(Number(l.linehaul_pay) || 0),
                  fsc: formatMoney(Number(l.fuel_surcharge) || 0),
                  acc: formatMoney(Number(l.accessorials) || 0),
                  pct: l.carrier_pct == null ? "—" : `${Number(effectiveCarrierPct(l.carrier_pct).toFixed(2))}%`,
                  fuel: l.fuel_actual == null ? <>{formatMoney(e.fuelCost)} {est}</> : formatMoney(l.fuel_actual),
                  tolls: l.tolls_actual == null ? <>{formatMoney(e.tollsCost)} {est}</> : formatMoney(l.tolls_actual),
                  lumpers: l.lumpers_actual == null ? "—" : formatMoney(l.lumpers_actual),
                  profit: <span className="font-semibold">{formatMoney(e.profit, { signed: true })}</span>,
                  notes: (
                    <>
                      {l.notes && <p className="max-w-[28ch] whitespace-pre-wrap">{l.notes}</p>}
                      {checks.map((c) => (
                        <p key={c} className="max-w-[32ch] text-[var(--pr-loss-deep)]">● {c}</p>
                      ))}
                      {alertsFor(l).confirmed.map((c) => (
                        <p key={c} className="max-w-[32ch] text-muted">✓ Driver says right: {c}</p>
                      ))}
                      {raw?.updated_at != null && (
                        <p className="text-xs text-muted">saved {day(String(raw.updated_at))}</p>
                      )}
                    </>
                  ),
                };
              })}
            />
          </Card>

          <Card className="mt-5">
            <CardHeader title="Other expenses this week" />
            <DataTable
              caption="Road expenses"
              empty="None this week."
              columns={[
                { key: "date", label: "Date" },
                { key: "what", label: "What" },
                { key: "note", label: "Note" },
                { key: "amount", label: "Amount", align: "right" },
              ]}
              rows={selected.roadExpenses.map((r) => ({
                _key: String(r.id),
                date: day(r.spent_on, false),
                what: roadCategoryMeta(r.category).label,
                note: r.note || "—",
                amount: formatMoney(r.amount),
              }))}
            />
          </Card>
        </section>
      )}

      {/* ── fuel ────────────────────────────────────────────────────── */}
      <section id="fuel" className="mb-8 scroll-mt-24">
        <SectionHeading
          title="Fuel"
          description={fuel.averageMpg != null ? `Their fuel log averages ${fuel.averageMpg.toFixed(1)} MPG over ${miles(fuel.milesTracked)} miles. Their Calculator uses ${profile.mpg || "no"} MPG.` : "Not enough fuel entries for an MPG yet."}
        />
        <Card className="mb-5">
          <CardHeader title="Truck" />
          <KeyValues
            items={[
              ["Make / model", [rig?.make, rig?.model].filter(Boolean).join(" ") || "—"],
              ["Year", rig?.year != null ? String(rig.year) : "—"],
              ["Engine", (rig?.engine as string) || "—"],
              ["Transmission", (rig?.transmission as string) || "—"],
              ["Starting odometer", rig?.starting_odometer != null ? miles(Number(rig.starting_odometer)) : "—"],
            ]}
          />
        </Card>
        <Card>
          <CardHeader title="Fuel log" />
          <DataTable
            caption="Fuel log"
            empty="No fuel logged."
            columns={[
              { key: "date", label: "Date" },
              { key: "odo", label: "Odometer", align: "right" },
              { key: "gal", label: "Gallons", align: "right" },
              { key: "miles", label: "Miles", align: "right" },
              { key: "mpg", label: "MPG", align: "right" },
              { key: "status", label: "" },
            ]}
            rows={fuel.entries.map((f) => ({
              _key: String(f.id),
              _highlight: f.status === "check" || f.status === "odometer",
              date: day(f.logged_on, false),
              odo: miles(f.odometer),
              gal: f.gallons.toFixed(2),
              miles: f.miles == null ? "—" : miles(f.miles),
              mpg: f.mpg == null ? "—" : f.mpg.toFixed(1),
              status:
                f.status === "baseline" ? "starting point" : f.status === "check" ? "check this — no semi gets this MPG" : f.status === "odometer" ? "odometer lower than before" : "",
            }))}
          />
        </Card>
      </section>

      {/* ── tax ─────────────────────────────────────────────────────── */}
      <section id="tax" className="mb-8 scroll-mt-24">
        <SectionHeading title="Tax" />
        <Card className="mb-5">
          <CardHeader title="Tax profile" />
          <KeyValues
            items={[
              ["Business type", ((taxProfileRes.data as Row | null)?.entity_type as string) || "—"],
              ["Truck", ((taxProfileRes.data as Row | null)?.truck_financing as string) || "—"],
              ["Hired driver", (taxProfileRes.data as Row | null)?.has_hired_driver ? "Yes" : "No"],
            ]}
          />
        </Card>
        <Card className="mb-5">
          <CardHeader title="Per diem nights they entered" />
          <DataTable
            caption="Per diem"
            empty="No per diem saved."
            columns={[
              { key: "year", label: "Tax year" },
              { key: "a", label: "Jan 1 – Sep 30", align: "right" },
              { key: "b", label: "Oct 1 – Dec 31", align: "right" },
            ]}
            rows={((perDiemRes.data ?? []) as Row[]).map((r) => ({
              _key: String(r.tax_year),
              year: String(r.tax_year),
              a: String(Number(r.period_a_nights) || 0),
              b: String(Number(r.period_b_nights) || 0),
            }))}
          />
        </Card>
        <Card className="mb-5">
          <CardHeader title="Expenses" />
          <DataTable
            caption="Tax expenses"
            empty="No expenses entered."
            columns={[
              { key: "date", label: "Date" },
              { key: "cat", label: "Category" },
              { key: "vendor", label: "Vendor" },
              { key: "note", label: "Note" },
              { key: "amount", label: "Amount", align: "right" },
            ]}
            rows={((expensesRes.data ?? []) as Row[]).map((r) => ({
              _key: String(r.id),
              date: day(r.expense_date as string),
              cat: String(r.category),
              vendor: (r.vendor as string) || "—",
              note: (r.note as string) || "—",
              amount: formatMoney(Number(r.amount) || 0),
            }))}
          />
        </Card>
        <Card>
          <CardHeader title="Assets" />
          <DataTable
            caption="Capital assets"
            empty="No assets entered."
            columns={[
              { key: "date", label: "In service" },
              { key: "what", label: "What" },
              { key: "cost", label: "Cost", align: "right" },
            ]}
            rows={((assetsRes.data ?? []) as Row[]).map((r) => ({
              _key: String(r.id),
              date: day(r.placed_in_service as string),
              what: String(r.description),
              cost: formatMoney(Number(r.cost) || 0),
            }))}
          />
        </Card>
      </section>

      {/* ── scans ───────────────────────────────────────────────────── */}
      <section id="scans" className="mb-8 scroll-mt-24">
        <SectionHeading
          title="Scans"
          description="Documents they scanned, newest first, and what ProfitRig read from each — to check the scanner against the original."
        />
        <Card>
          <DataTable
            caption="Scanned documents"
            empty="Nothing scanned."
            columns={[
              { key: "date", label: "Scanned" },
              { key: "how", label: "From" },
              { key: "what", label: "Read as" },
              { key: "read", label: "What it read" },
              { key: "load", label: "Load" },
              { key: "file", label: "Original" },
            ]}
            rows={((scansRes.data ?? []) as Row[]).map((r) => {
              const x = (r.extracted ?? {}) as Row;
              const read = [x.customer, x.origin && x.destination ? `${x.origin} → ${x.destination}` : null, x.total_pay ?? x.linehaul_pay ? `$${x.total_pay ?? x.linehaul_pay}` : null, x.miles ? `${x.miles} mi` : null]
                .filter(Boolean)
                .join(" · ");
              return {
                _key: String(r.id),
                date: day(r.created_at as string),
                how: r.source === "email" ? "Email" : "Scan",
                what: r.status === "read" ? String(r.document_type ?? "—").replace(/_/g, " ") : String(r.status),
                read: read || "—",
                load: r.load_id && byId.get(String(r.load_id)) ? (
                  <a
                    href={`?week=${weekOf(byId.get(String(r.load_id))!.load_date)}#entry-${r.load_id}`}
                    className="pr-link"
                  >
                    Saved
                  </a>
                ) : r.load_id ? (
                  "Saved"
                ) : (
                  "Not saved"
                ),
                file: (
                  <a href={`/api/scan/${r.id}/file`} target="_blank" rel="noopener noreferrer" className="pr-link">
                    View
                  </a>
                ),
              };
            })}
          />
        </Card>
      </section>

      {/* ── Ask ProfitRig, and feedback ─────────────────────────────── */}
      <section id="chat" className="mb-8 scroll-mt-24">
        <SectionHeading
          title="Ask ProfitRig"
          description={`${usage.length} questions on record, about ${formatMoney(aiCost)} of AI.`}
        />
        <Card className="mb-5">
          {(chatRes.data ?? []).length === 0 ? (
            <p className="text-sm text-muted">No conversation.</p>
          ) : (
            <ol className="flex flex-col gap-3 text-sm">
              {[...((chatRes.data ?? []) as Row[])].reverse().map((m) => (
                <li key={String(m.id)} className={m.role === "user" ? "" : "border-l-2 border-border pl-3 text-muted"}>
                  <span className="pr-record-label mr-2">{m.role === "user" ? "Driver" : "ProfitRig"} · {day(m.created_at as string)}</span>
                  <span className="whitespace-pre-wrap">{String(m.content)}</span>
                </li>
              ))}
            </ol>
          )}
        </Card>
        <Card>
          <CardHeader title="Feedback they sent" />
          {(feedbackRes.data ?? []).length === 0 ? (
            <p className="text-sm text-muted">None.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {((feedbackRes.data ?? []) as Row[]).map((f) => (
                <li key={String(f.id)}>
                  <span className="pr-record-label mr-2">{day(f.created_at as string)}</span>
                  <span className="whitespace-pre-wrap">{String(f.message)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </AppShell>
  );
}
