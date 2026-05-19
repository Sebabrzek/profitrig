import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Calculator } from "./Calculator";
import { Wordmark } from "@/components/Wordmark";
import { HeaderNav } from "@/components/HeaderNav";
import { isAdminEmail } from "@/lib/admin";
import { type CostProfile } from "./actions";
import { isProfileComplete, type DriverProfile } from "@/lib/profile";

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
  driver_pay_per_mile: 0,
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
  let driverProfile: DriverProfile | null = null;
  if (user) {
    email = user.email ?? "";
    const [costRes, driverRes] = await Promise.all([
      supabase
        .from("cost_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("driver_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);
    const data = costRes.data;
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
        driver_pay_per_mile: Number(data.driver_pay_per_mile) || 0,
        tolls_misc_per_mile: Number(data.tolls_misc_per_mile) || 0,
        desired_profit_per_mile: Number(data.desired_profit_per_mile) || 0,
      };
    }
    if (driverRes.data) {
      driverProfile = {
        first_name: driverRes.data.first_name ?? "",
        last_name: driverRes.data.last_name ?? "",
        phone: driverRes.data.phone ?? "",
        company_name: driverRes.data.company_name ?? "",
        domicile_city: driverRes.data.domicile_city ?? "",
        domicile_state: driverRes.data.domicile_state ?? "",
        carrier_name: driverRes.data.carrier_name ?? "",
        authority_type: driverRes.data.authority_type ?? "",
        trailer_type: driverRes.data.trailer_type ?? "",
        marketing_opt_in: Boolean(driverRes.data.marketing_opt_in),
      };
    }
  }
  const profileComplete = isProfileComplete(driverProfile);

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 bg-white border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Wordmark size="md" />
          <HeaderNav
            variant="calculator"
            email={email}
            isAdmin={isAdminEmail(email)}
          />
        </div>
      </header>
      <Calculator initial={initial} profileComplete={profileComplete} />
    </main>
  );
}
