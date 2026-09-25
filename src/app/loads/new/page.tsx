import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/ui/Surfaces";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { fetchSubscription, isPro } from "@/lib/subscription";
import { type CostProfile } from "@/app/actions";
import {
  EMPTY_LOAD,
  endOfMonth,
  isoDate,
  startOfMonth,
  type Load,
} from "@/lib/loads";
import { driverToday } from "@/lib/driverClock";
import { fetchDriverSettings } from "@/lib/driverSettings";
import { LoadForm, type PartialOf } from "../LoadForm";
import { MAX_PARTIALS, partialsEnabledFor, tripLabel } from "@/lib/partials";

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

export default async function NewLoadPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; partial_of?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const sub = await fetchSubscription(supabase, user.id);
  if (!isPro(sub)) redirect("/upgrade");

  // Default to the driver's today — not the UTC server's, which is already
  // tomorrow on a US evening. If the caller passed ?date=..., use that month
  // for MTD context instead so the form previews the right calendar month.
  const [{ iso: today, now }, settings] = await Promise.all([
    driverToday(),
    fetchDriverSettings(supabase, user.id),
  ]);

  // Adding a partial: the load it rides with decides its date, its month and
  // its carrier split. Anything that makes a partial impossible here — not
  // turned on for this account, migration 017 not run yet, a primary that is
  // itself a partial, or one already carrying two — goes back to that load.
  let primary: Record<string, unknown> | null = null;
  if (params.partial_of) {
    const back = `/loads/${params.partial_of}`;
    if (!partialsEnabledFor(user.email)) redirect(back);
    const { data } = await supabase
      .from("loads")
      .select("*")
      .eq("id", params.partial_of)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!data) notFound();
    if (!("parent_load_id" in data) || data.parent_load_id) redirect(back);
    const { count } = await supabase
      .from("loads")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("parent_load_id", params.partial_of);
    if ((count ?? 0) >= MAX_PARTIALS) redirect(back);
    primary = data;
  }

  const newLoadDate = primary
    ? new Date(String(primary.load_date) + "T12:00:00")
    : params.date
      ? new Date(params.date + "T12:00:00")
      : now;
  const monthFrom = startOfMonth(newLoadDate);
  const monthTo = endOfMonth(newLoadDate);

  const [{ data: costData }, monthLoadsRes] = await Promise.all([
    supabase
      .from("cost_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("loads")
      .select("load_date,loaded_miles,deadhead_miles")
      .eq("user_id", user.id)
      .gte("load_date", isoDate(monthFrom))
      .lte("load_date", isoDate(monthTo)),
  ]);

  // Sum of every OTHER load already saved in this calendar month.
  const otherMonthMiles = (monthLoadsRes.data ?? []).reduce(
    (acc: number, r) =>
      acc +
      (Number(r.loaded_miles) || 0) +
      (Number(r.deadhead_miles) || 0),
    0
  );
  // Earliest day already logged this month. buildMtdContext clamps this to
  // the new load's own date, so a first-ever load starts its own window.
  const monthFirstDay = (monthLoadsRes.data ?? []).reduce(
    (min: number, r) =>
      Math.min(min, Number(String(r.load_date).slice(8, 10)) || 31),
    31
  );

  const profile: CostProfile = costData
    ? {
        truck_payment: Number(costData.truck_payment) || 0,
        trailer_payment: Number(costData.trailer_payment) || 0,
        insurance: Number(costData.insurance) || 0,
        eld_subscriptions: Number(costData.eld_subscriptions) || 0,
        permits_irp_ifta: Number(costData.permits_irp_ifta) || 0,
        office_misc: Number(costData.office_misc) || 0,
        load_board_per_month: Number(costData.load_board_per_month) || 0,
        other_monthly_bill: Number(costData.other_monthly_bill) || 0,
        other_label: costData.other_label ?? "",
        monthly_miles: Number(costData.monthly_miles) || 0,
        mpg: Number(costData.mpg) || 0,
        fuel_price_per_gallon: Number(costData.fuel_price_per_gallon) || 0,
        maintenance_per_mile: Number(costData.maintenance_per_mile) || 0,
        tires_per_mile: Number(costData.tires_per_mile) || 0,
        def_per_mile: Number(costData.def_per_mile) || 0,
        driver_pay_per_mile: Number(costData.driver_pay_per_mile) || 0,
        tolls_misc_per_mile: Number(costData.tolls_misc_per_mile) || 0,
        desired_profit_per_mile:
          Number(costData.desired_profit_per_mile) || 0,
        real_cpm_override:
          costData.real_cpm_override == null
            ? null
            : Number(costData.real_cpm_override),
      }
    : EMPTY_PROFILE;

  const initial: Load = primary
    ? {
        ...EMPTY_LOAD,
        parent_load_id: String(primary.id),
        load_date: String(primary.load_date),
        // The same carrier split as the load it rides with, as a start.
        carrier_pct:
          primary.carrier_pct == null
            ? settings.carrierPct
            : Number(primary.carrier_pct),
      }
    : {
        ...EMPTY_LOAD,
        load_date: params.date || today,
        // A leased driver's split, filled in so they don't retype it per load.
        carrier_pct: settings.carrierPct,
      };

  const partialOf: PartialOf | undefined = primary
    ? {
        id: String(primary.id),
        label: tripLabel({
          broker: String(primary.broker ?? ""),
          origin: String(primary.origin ?? ""),
          destination: String(primary.destination ?? ""),
        }),
        dateLabel: new Date(
          String(primary.load_date) + "T12:00:00"
        ).toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        }),
      }
    : undefined;

  return (
    <AppShell
      width="standard"
      account={{
        email: user.email ?? "",
        isPro: true,
        isAdmin: isAdminEmail(user.email),
      }}
    >
        <PageHeader
          title={partialOf ? "Add a Partial" : "Add a Load"}
          action={
            <Link
              href={partialOf ? `/loads/${partialOf.id}` : "/loads"}
              className="pr-link pr-hit text-sm"
            >
              ← Back
            </Link>
          }
        />
        <LoadForm
          initial={initial}
          costProfile={profile}
          otherMonthMiles={otherMonthMiles}
          monthFirstDay={monthFirstDay}
          leased={settings.carrierPct != null}
          partialOf={partialOf}
        />
    </AppShell>
  );
}
