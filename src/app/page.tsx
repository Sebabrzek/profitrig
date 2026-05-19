import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Calculator } from "./Calculator";
import { Wordmark } from "@/components/Wordmark";
import { signOutAction, type CostProfile } from "./actions";

const DEFAULTS: CostProfile = {
  truck_payment: 0,
  trailer_payment: 0,
  insurance: 0,
  eld_subscriptions: 0,
  permits_irp_ifta: 0,
  office_misc: 0,
  monthly_miles: 10000,
  mpg: 6.5,
  fuel_price_per_gallon: 4.0,
  maintenance_per_mile: 0.2,
  tires_per_mile: 0.05,
  def_per_mile: 0.03,
  owner_operator_rate_per_mile: 0,
  tolls_misc_per_mile: 0.05,
  desired_profit_per_mile: 0.5,
};

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let initial: CostProfile = DEFAULTS;
  let email = "";
  if (user) {
    email = user.email ?? "";
    const { data } = await supabase
      .from("cost_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) {
      initial = {
        truck_payment: Number(data.truck_payment) || 0,
        trailer_payment: Number(data.trailer_payment) || 0,
        insurance: Number(data.insurance) || 0,
        eld_subscriptions: Number(data.eld_subscriptions) || 0,
        permits_irp_ifta: Number(data.permits_irp_ifta) || 0,
        office_misc: Number(data.office_misc) || 0,
        monthly_miles: Number(data.monthly_miles) || 0,
        mpg: Number(data.mpg) || 0,
        fuel_price_per_gallon: Number(data.fuel_price_per_gallon) || 0,
        maintenance_per_mile: Number(data.maintenance_per_mile) || 0,
        tires_per_mile: Number(data.tires_per_mile) || 0,
        def_per_mile: Number(data.def_per_mile) || 0,
        owner_operator_rate_per_mile:
          Number(data.owner_operator_rate_per_mile) || 0,
        tolls_misc_per_mile: Number(data.tolls_misc_per_mile) || 0,
        desired_profit_per_mile: Number(data.desired_profit_per_mile) || 0,
      };
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 bg-white border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Wordmark size="md" />
          <form action={signOutAction}>
            <button
              type="submit"
              className="text-sm text-muted hover:text-foreground"
              title={email}
            >
              Sign Out
            </button>
          </form>
        </div>
      </header>
      <Calculator initial={initial} />
    </main>
  );
}
