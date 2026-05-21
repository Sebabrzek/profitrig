import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Wordmark } from "@/components/Wordmark";
import { HeaderNav } from "@/components/HeaderNav";
import { isAdminEmail } from "@/lib/admin";
import { fetchSubscription, isPro } from "@/lib/subscription";
import { type CostProfile } from "@/app/actions";
import { EMPTY_LOAD, type Load } from "@/lib/loads";
import { LoadForm } from "../LoadForm";

const EMPTY_PROFILE: CostProfile = {
  truck_payment: 0,
  trailer_payment: 0,
  insurance: 0,
  eld_subscriptions: 0,
  permits_irp_ifta: 0,
  office_misc: 0,
  monthly_miles: 0,
  mpg: 0,
  fuel_price_per_gallon: 0,
  maintenance_per_mile: 0,
  tires_per_mile: 0,
  def_per_mile: 0,
  driver_pay_per_mile: 0,
  tolls_misc_per_mile: 0,
  desired_profit_per_mile: 0,
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

  const { data: costData } = await supabase
    .from("cost_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  const profile: CostProfile = costData
    ? {
        truck_payment: Number(costData.truck_payment) || 0,
        trailer_payment: Number(costData.trailer_payment) || 0,
        insurance: Number(costData.insurance) || 0,
        eld_subscriptions: Number(costData.eld_subscriptions) || 0,
        permits_irp_ifta: Number(costData.permits_irp_ifta) || 0,
        office_misc: Number(costData.office_misc) || 0,
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
      <div className="max-w-2xl mx-auto px-4 py-4 pb-12">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-black">Add a Load</h1>
          <Link
            href="/loads"
            className="text-sm font-semibold text-brand hover:text-brand-dark"
          >
            ← Back
          </Link>
        </div>
        <LoadForm initial={initial} costProfile={profile} />
      </div>
    </main>
  );
}
