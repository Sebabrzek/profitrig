import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import {
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
} from "@/components/ui/Surfaces";
import { Notice } from "@/components/ui/Notice";
import { ButtonLink, buttonClass } from "@/components/ui/Button";
import { formatMoney, formatRate, outcomeOf } from "@/lib/format";
import {
  InstrumentPanel,
  Reading,
  ReadingGrid,
} from "@/components/instruments/Instruments";
import {
  AnswerColumn,
  AnswerLayout,
  WorkColumn,
} from "@/components/shell/AnswerLayout";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { fetchSubscription, isPro } from "@/lib/subscription";
import { type CostProfile } from "../actions";
import {
  type Load,
  type MonthAllocationNote,
  aggregateWeek,
  buildMtdContext,
  computeLoadEconomics,
  describeMonthAllocation,
  endOfWeek,
  formatWeekLabel,
  isoDate,
  loadFromRow,
  loadMonthKey,
  monthRangeForWeek,
  monthStatsByLoad,
  parseDateParam,
  startOfWeek,
} from "@/lib/loads";
import { driverToday } from "@/lib/driverClock";
import { fetchDriverSettings } from "@/lib/driverSettings";
import { RoadExpenseCard } from "@/components/RoadExpenseCard";
import { sumRoadExpenses, type RoadExpense } from "@/lib/roadExpenses";
import { WeekStartToggle } from "./WeekStartToggle";
import { LoadLedger, LoadRecord } from "./LoadRecord";

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

function profileIsConfigured(p: CostProfile): boolean {
  return p.monthly_miles > 0 && (p.mpg > 0 || p.maintenance_per_mile > 0);
}

/** 20 → "20%", 17.5 → "17.5%". */
function pctLabel(n: number) {
  return `${Number(n.toFixed(2))}%`;
}

function roundedMiles(n: number) {
  return Math.round(n).toLocaleString("en-US");
}

/**
 * Why this week's loads carry the share of monthly bills they do, and whether
 * that can still change. Without it an old week's profit moves with no reason
 * given — a profitable week can read as a loss two weeks later.
 */
function allocationNoteText(note: MonthAllocationNote): string {
  const month = new Date(`${note.monthKey}-15T12:00:00`).toLocaleString(
    "en-US",
    { month: "long" }
  );
  const estimate = `${roundedMiles(note.estimateMiles)} mi/month estimate`;
  if (note.final) {
    return note.basis === "actual_mtd"
      ? `${month} is over, so its bills are settled: spread over the ${roundedMiles(note.basisMiles)} miles you logged.`
      : `${month} is over, so its bills are settled at your ${estimate} — not enough of the month was logged to use your real miles.`;
  }
  if (note.basis === "monthly_estimate") {
    return `Monthly bills (truck payment, insurance…) are spread at your ${estimate} until you've logged about a week of ${month}. Profit here can still change this month.`;
  }
  const pace = `Monthly bills are spread over your real ${month} pace — about ${roundedMiles(note.basisMiles)} mi/month so far — so this week's profit keeps moving until ${month} ends.`;
  return note.lowPace
    ? `${pace} That's well under your ${estimate}. If you've hauled loads you haven't logged, add them — every missing load makes the logged ones carry more of your bills.`
    : pace;
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

  // Resolve the target week on the DRIVER's calendar, in the week they chose.
  const [{ iso: today, now }, settings] = await Promise.all([
    driverToday(),
    fetchDriverSettings(supabase, user.id),
  ]);
  const weekStartsOn = settings.weekStart;
  const targetDate = params.week ? parseDateParam(params.week) : now;
  const weekStart = startOfWeek(targetDate, weekStartsOn);
  const weekEnd = endOfWeek(targetDate, weekStartsOn);
  // Prev/Next carry a mid-week day, not the week's first day. A mid-week day
  // sits in both the Sunday and the Monday version of the same week, so
  // switching the setting keeps the driver's week on screen. A Sunday in the
  // URL would jump them back a whole week.
  const prevWeek = new Date(weekStart);
  prevWeek.setDate(prevWeek.getDate() - 7 + 3);
  const nextWeek = new Date(weekStart);
  nextWeek.setDate(nextWeek.getDate() + 7 + 3);

  // Every day of each month the week touches, so each load's fixed-cost
  // share comes from its whole month — even when the week crosses months.
  const monthRange = monthRangeForWeek(weekStart, weekEnd);

  const [costRes, monthLoadsRes, roadExpensesRes] = await Promise.all([
    supabase
      .from("cost_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("loads")
      .select("*")
      .eq("user_id", user.id)
      .gte("load_date", monthRange.from)
      .lte("load_date", monthRange.to)
      .order("load_date", { ascending: false })
      .order("created_at", { ascending: false }),
    // Road expenses for the displayed week only — they aren't part of the
    // per-load allocation, so there's no need for the wider month range.
    supabase
      .from("road_expenses")
      .select("id,spent_on,category,amount,note")
      .eq("user_id", user.id)
      .gte("spent_on", isoDate(weekStart))
      .lte("spent_on", isoDate(weekEnd))
      .order("spent_on", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  const roadExpenses: RoadExpense[] = (roadExpensesRes.data ?? []).map(
    (r) => ({
      id: r.id,
      spent_on: r.spent_on,
      category: r.category,
      amount: Number(r.amount) || 0,
      note: r.note ?? "",
    })
  );
  const roadExpenseTotal = sumRoadExpenses(roadExpenses);

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

  const loads: Load[] = (loadsRes.data ?? []).map((r) => loadFromRow(r));

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
    carrier_pct: null, // miles only — this list never prices revenue
    notes: "",
  }));
  const monthStats = monthStatsByLoad(monthLoads);

  const totals = aggregateWeek(
    loads,
    profile,
    monthStats,
    roadExpenseTotal,
    now
  );
  const isConfigured = profileIsConfigured(profile);

  // One note per month this week's loads fall in (two when a week crosses
  // months), explaining the fixed-cost share and whether it can still move.
  const allocationNotes = [
    ...new Set(loads.map((l) => loadMonthKey(l.load_date))),
  ]
    .sort()
    .flatMap((key) => {
      const stats = monthStats.get(key);
      return stats ? [describeMonthAllocation(key, stats, profile, now)] : [];
    });

  return (
    <AppShell
      width="standard"
      account={{
        email: user.email ?? "",
        isPro: true,
        isAdmin: isAdminEmail(user.email),
      }}
    >
        <PageHeader title="Loads" />
        {!isConfigured && (
          <Notice title="Set up your cost per mile first" className="mb-4">
            <p>
              The load tracker uses your saved monthly costs and per-mile rates
              from the calculator. Open the calculator, fill it in, hit Save,
              then come back here.
            </p>
            <ButtonLink href="/calculator" variant="dark" size="sm" className="mt-3">
              Open Calculator
            </ButtonLink>
          </Notice>
        )}

        {/* Week navigator */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <ButtonLink
            href={`/loads?week=${isoDate(prevWeek)}`}
            variant="secondary"
            size="sm"
          >
            ← Prev
          </ButtonLink>
          <div className="flex-1 text-center">
            <p className="text-xs text-muted uppercase tracking-wider font-semibold">
              Week of
            </p>
            <p className="text-sm font-bold">{formatWeekLabel(weekStart)}</p>
          </div>
          <ButtonLink
            href={`/loads?week=${isoDate(nextWeek)}`}
            variant="secondary"
            size="sm"
          >
            Next →
          </ButtonLink>
        </div>
        <WeekStartToggle value={weekStartsOn} />

        {/* How this driver gets paid, kept in view where they check profit */}
        {settings.carrierPct != null ? (
          <p className="text-center text-xs text-muted -mt-1 mb-3">
            Leased to{" "}
            <span className="font-semibold text-foreground">
              {settings.carrierName || "your carrier"}
            </span>{" "}
            · you keep {pctLabel(100 - settings.carrierPct)} ·{" "}
            <Link href="/profile" className="pr-link">
              Change
            </Link>
          </p>
        ) : settings.authorityType === "leased" ||
          settings.authorityType === "both" ? (
          <Notice size="sm" className="mb-4">
            You&apos;re leased to a carrier, but ProfitRig doesn&apos;t know
            what they keep — so every load here counts 100% of the pay as
            yours.{" "}
            <Link href="/profile" className="pr-link">
              Add your carrier&apos;s %
            </Link>
          </Notice>
        ) : null}

        {/* The weekly scoreboard: the result and why it is what it is. */}
        <AnswerLayout>
        <AnswerColumn>
        {/* Weekly summary */}
        <InstrumentPanel>
          <Reading
            size="hero"
            label="Week profit"
            value={formatMoney(totals.profit, { signed: true })}
            outcome={outcomeOf(totals.profit)}
          />
          <ReadingGrid>
            <Reading
              label="Revenue"
              value={formatMoney(totals.revenue)}
              context={
                totals.carrierCut > 0 && (
                  <>after {formatMoney(totals.carrierCut)} to carrier</>
                )
              }
            />
            <Reading
              label="Costs"
              value={formatMoney(totals.totalCost)}
              context={
                totals.roadExpenses > 0 && (
                  <>incl. {formatMoney(totals.roadExpenses)} other</>
                )
              }
            />
            <Reading label="Loads" figure={false} value={String(totals.loads)} />
            <Reading
              label="Total miles"
              figure={false}
              value={totals.totalMiles.toLocaleString()}
              context={
                <>
                  {totals.loadedMiles.toLocaleString()} loaded •{" "}
                  {totals.deadheadMiles.toLocaleString()} deadhead
                  {totals.totalMiles > 0
                    ? ` (${totals.deadheadPct.toFixed(0)}%)`
                    : ""}
                </>
              }
            />
            <Reading
              label="Avg rate / mile"
              value={formatRate(totals.rpm)}
              context={<>cost {formatRate(totals.cpm)}</>}
            />
          </ReadingGrid>
        </InstrumentPanel>

        {/* Why this week's fixed-cost share is what it is */}
        {isConfigured && allocationNotes.length > 0 && (
          <div className="flex flex-col gap-2 mb-4">
            {allocationNotes.map((note) =>
              note.lowPace ? (
                <Notice key={note.monthKey} size="sm">
                  {allocationNoteText(note)}
                </Notice>
              ) : (
                <p
                  key={note.monthKey}
                  className="px-1 text-xs leading-snug text-muted"
                >
                  {allocationNoteText(note)}
                </p>
              )
            )}
          </div>
        )}

        </AnswerColumn>
        <WorkColumn>
        {/* Other expenses this week (not tied to a single load) */}
        <RoadExpenseCard
          rows={roadExpenses}
          weekStartIso={isoDate(weekStart)}
          weekEndIso={isoDate(weekEnd)}
          defaultDateIso={
            today >= isoDate(weekStart) && today <= isoDate(weekEnd)
              ? today
              : isoDate(weekStart)
          }
        />

        {/* Add load CTA — full width on a phone, a 240px button from
            tablet up, on the column's left edge. `pr-btn-money` adds the
            engraved currency line behind the label, at about 8%: the one
            button in ProfitRig that carries it. Everything else about the
            button — size, radius, focus, disabled — is unchanged. */}
        <ButtonLink
          href={`/loads/new?date=${isoDate(targetDate)}`}
          variant="primary"
          size="lg"
          disabled={!isConfigured}
          className="pr-btn-money mb-4 flex w-full sm:w-60"
        >
          + Add a Load
        </ButtonLink>

        {/* Export to Sheets/Excel */}
        {isConfigured && (
          <Card className="mb-4">
            <CardHeader
              title="Export to Sheets / Excel"
              description="Download a CSV with every load + auto-totals. Opens in Google Sheets, Excel, or Numbers."
            />
            <div className="flex flex-wrap gap-2">
              <a
                href={`/api/loads/export?range=week&date=${isoDate(targetDate)}`}
                className={buttonClass({ variant: "secondary", size: "sm" })}
              >
                This Week
              </a>
              <a
                href={`/api/loads/export?range=month&date=${isoDate(targetDate)}`}
                className={buttonClass({ variant: "secondary", size: "sm" })}
              >
                This Month
              </a>
              <a
                href={`/api/loads/export?range=all`}
                className={buttonClass({ variant: "secondary", size: "sm" })}
              >
                All Time
              </a>
            </div>
          </Card>
        )}

        {/* Load list */}
        {loads.length === 0 ? (
          <EmptyState title="No loads this week.">
            Tap{" "}
            <span className="font-semibold text-foreground">Add a Load</span>{" "}
            after every trip to track your real profit.
          </EmptyState>
        ) : (
          <LoadLedger>
            {loads.map((load) => {
              const ownMiles =
                Number(load.loaded_miles || 0) +
                Number(load.deadhead_miles || 0);
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
              const dateLabel = new Date(
                load.load_date + "T12:00:00"
              ).toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              });
              return (
                <LoadRecord
                  key={load.id}
                  id={String(load.id)}
                  href={`/loads/${load.id}`}
                  dateLabel={dateLabel}
                  broker={load.broker}
                  origin={load.origin}
                  destination={load.destination}
                  economics={e}
                />
              );
            })}
          </LoadLedger>
        )}
        </WorkColumn>
        </AnswerLayout>
    </AppShell>
  );
}
