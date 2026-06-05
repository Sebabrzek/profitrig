import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Calculator } from "./Calculator";
import { Wordmark } from "@/components/Wordmark";
import { HeaderNav } from "@/components/HeaderNav";
import { BottomNav } from "@/components/BottomNav";
import { isAdminEmail } from "@/lib/admin";
import { fetchSubscription, isPro } from "@/lib/subscription";
import { type CostProfile } from "./actions";
import { isProfileComplete, type DriverProfile } from "@/lib/profile";
import {
  computeLoadEconomics,
  loadMonthKey,
  monthlyMilesByLoad,
  type Load,
} from "@/lib/loads";

const DEFAULTS: CostProfile = {
  truck_payment: 0,
  trailer_payment: 0,
  insurance: 0,
  eld_subscriptions: 0,
  permits_irp_ifta: 0,
  office_misc: 0,
  load_board_per_month: 0,
  other_monthly_bill: 0,
  other_label: "",
  monthly_miles: 10000,
  mpg: 6.5,
  fuel_price_per_gallon: 4.0,
  maintenance_per_mile: 0.2,
  tires_per_mile: 0.05,
  def_per_mile: 0.03,
  driver_pay_per_mile: 0,
  tolls_misc_per_mile: 0.05,
  desired_profit_per_mile: 0.5,
  real_cpm_override: null,
};

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let initial: CostProfile = DEFAULTS;
  let email = "";
  let driverProfile: DriverProfile | null = null;
  let userIsPro = false;
  let loggedLoadCount = 0;
  let realCPMFromLoads: number | null = null;
  let hasSavedProfile = false;
  if (user) {
    email = user.email ?? "";
    userIsPro = isPro(await fetchSubscription(supabase, user.id));
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
    hasSavedProfile = Boolean(data);
    if (data) {
      initial = {
        truck_payment: Number(data.truck_payment) || 0,
        trailer_payment: Number(data.trailer_payment) || 0,
        insurance: Number(data.insurance) || 0,
        eld_subscriptions: Number(data.eld_subscriptions) || 0,
        permits_irp_ifta: Number(data.permits_irp_ifta) || 0,
        office_misc: Number(data.office_misc) || 0,
        load_board_per_month: Number(data.load_board_per_month) || 0,
        other_monthly_bill: Number(data.other_monthly_bill) || 0,
        other_label: data.other_label ?? "",
        monthly_miles: Number(data.monthly_miles) || 0,
        mpg: Number(data.mpg) || 0,
        fuel_price_per_gallon: Number(data.fuel_price_per_gallon) || 0,
        maintenance_per_mile: Number(data.maintenance_per_mile) || 0,
        tires_per_mile: Number(data.tires_per_mile) || 0,
        def_per_mile: Number(data.def_per_mile) || 0,
        driver_pay_per_mile: Number(data.driver_pay_per_mile) || 0,
        tolls_misc_per_mile: Number(data.tolls_misc_per_mile) || 0,
        desired_profit_per_mile: Number(data.desired_profit_per_mile) || 0,
        real_cpm_override:
          data.real_cpm_override == null
            ? null
            : Number(data.real_cpm_override),
      };
    }
    // Phase 0.2: derive realCPM from every logged load. We deliberately use
    // the SAME per-load total-cost definition that drives per-load profit
    // (computeLoadEconomics returns `e.totalCost` = actual fuel/tolls/
    // lumpers + auto-allocated driver pay, maintenance, tires, DEF, and the
    // MTD-allocated fixed share). Sum(totalCost) / sum(totalMiles) keeps
    // the realCPM comparison apples-to-apples with the Calculator's
    // computed "true cost per mile." Only surfaced once N >= 5 loads so
    // the comparison is meaningful.
    if (userIsPro && hasSavedProfile) {
      const { data: allLoads } = await supabase
        .from("loads")
        .select("*")
        .eq("user_id", user.id);
      const loads: Load[] = (allLoads ?? []).map((r) => ({
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
        lumpers_actual:
          r.lumpers_actual == null ? null : Number(r.lumpers_actual),
        notes: r.notes ?? "",
      }));
      loggedLoadCount = loads.length;
      if (loggedLoadCount >= 5) {
        const monthMiles = monthlyMilesByLoad(loads);
        let totalMiles = 0;
        let totalCost = 0;
        for (const l of loads) {
          const ownMiles =
            Number(l.loaded_miles || 0) + Number(l.deadhead_miles || 0);
          const otherMonthMiles = Math.max(
            0,
            (monthMiles.get(loadMonthKey(l.load_date)) ?? 0) - ownMiles
          );
          const e = computeLoadEconomics(l, initial, { otherMonthMiles });
          totalMiles += e.totalMiles;
          totalCost += e.totalCost;
        }
        if (totalMiles > 0) {
          realCPMFromLoads = totalCost / totalMiles;
        }
      }
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
            isPro={userIsPro}
            isAuthed={Boolean(user)}
          />
        </div>
      </header>
      <Calculator
        initial={initial}
        profileComplete={profileComplete}
        loggedLoadCount={loggedLoadCount}
        realCPMFromLoads={realCPMFromLoads}
        isAuthed={Boolean(user)}
        hasSavedProfile={hasSavedProfile}
      />
      {user && <BottomNav isPro={userIsPro} />}
    </main>
  );
}
