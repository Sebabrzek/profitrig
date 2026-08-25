import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Wordmark } from "@/components/Wordmark";
import { HeaderNav } from "@/components/HeaderNav";
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
import { BottomNav } from "@/components/BottomNav";
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

export default async function NewLoadPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const sub = await fetchSubscription(supabase, user.id);
  if (!isPro(sub)) redirect("/upgrade");

  // Default to "today" for new loads. If the caller passed ?date=..., use
  // that month for MTD context instead so the form previews the right
  // calendar month.
  const newLoadDate = params.date ? new Date(params.date + "T12:00:00") : new Date();
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

  const initial: Load = {
    ...EMPTY_LOAD,
    load_date: params.date || EMPTY_LOAD.load_date,
  };

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
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-black">Add a Load</h1>
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
          otherMonthMiles={otherMonthMiles}
          monthFirstDay={monthFirstDay}
        />
      </div>
      <BottomNav isPro />
    </main>
  );
}
