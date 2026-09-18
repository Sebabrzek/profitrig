import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { fetchSubscription, isPro } from "@/lib/subscription";
import { type CostProfile } from "@/app/actions";
import {
  endOfMonth,
  isoDate,
  loadFromRow,
  startOfMonth,
  type Load,
} from "@/lib/loads";
import { fetchDriverSettings } from "@/lib/driverSettings";
import { LoadForm } from "../LoadForm";

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

export default async function EditLoadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const sub = await fetchSubscription(supabase, user.id);
  if (!isPro(sub)) redirect("/upgrade");

  const [loadRes, costRes, settings] = await Promise.all([
    supabase
      .from("loads")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("cost_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle(),
    fetchDriverSettings(supabase, user.id),
  ]);

  if (!loadRes.data) notFound();
  const r = loadRes.data;

  // Other loads logged in this load's same calendar month, excluding this
  // load itself — used to compute MTD-based fixed-cost allocation live.
  const loadDateObj = new Date(r.load_date + "T12:00:00");
  const monthFrom = startOfMonth(loadDateObj);
  const monthTo = endOfMonth(loadDateObj);
  const { data: monthLoadsData } = await supabase
    .from("loads")
    .select("id,load_date,loaded_miles,deadhead_miles")
    .eq("user_id", user.id)
    .gte("load_date", isoDate(monthFrom))
    .lte("load_date", isoDate(monthTo));
  const otherMonthMiles = (monthLoadsData ?? [])
    .filter((row) => row.id !== id)
    .reduce(
      (acc: number, row) =>
        acc +
        (Number(row.loaded_miles) || 0) +
        (Number(row.deadhead_miles) || 0),
      0
    );
  // Earliest day this driver logged anything in the load's month — the start
  // of the run-rate window.
  const monthFirstDay = (monthLoadsData ?? []).reduce(
    (min: number, row) =>
      Math.min(min, Number(String(row.load_date).slice(8, 10)) || 31),
    31
  );

  const initial: Load = loadFromRow(r);

  const costData = costRes.data;
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

  return (
    <AppShell
      width="standard"
      account={{
        email: user.email ?? "",
        isPro: true,
        isAdmin: isAdminEmail(user.email),
      }}
    >
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-black">Edit Load</h1>
          <Link
            href="/loads"
            className="text-sm font-semibold text-brand hover:text-brand-dark"
          >
            ← Back
          </Link>
        </div>
        <LoadForm
          initial={initial}
          costProfile={profile}
          loadId={id}
          otherMonthMiles={otherMonthMiles}
          monthFirstDay={monthFirstDay}
          leased={settings.carrierPct != null}
        />
    </AppShell>
  );
}
