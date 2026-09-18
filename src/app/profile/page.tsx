import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { fetchSubscription, isPro } from "@/lib/subscription";
import { EMPTY_DRIVER_PROFILE, type DriverProfile } from "@/lib/profile";
import { ProfileForm, type PastLoadsWithoutSplit } from "./ProfileForm";
import { FeedbackCard } from "./FeedbackCard";
import { HistoryList, type Snapshot } from "./HistoryList";

export default async function ProfilePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let initial: DriverProfile = EMPTY_DRIVER_PROFILE;
  let email = "";
  let userIsPro = false;
  let pastLoads: PastLoadsWithoutSplit = { count: 0, from: null, to: null };
  let snapshots: Snapshot[] = [];
  if (user) {
    email = user.email ?? "";
    userIsPro = isPro(await fetchSubscription(supabase, user.id));
    const { data } = await supabase
      .from("driver_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) {
      initial = {
        first_name: data.first_name ?? "",
        last_name: data.last_name ?? "",
        phone: data.phone ?? "",
        company_name: data.company_name ?? "",
        domicile_city: data.domicile_city ?? "",
        domicile_state: data.domicile_state ?? "",
        carrier_name: data.carrier_name ?? "",
        authority_type: data.authority_type ?? "",
        trailer_type: data.trailer_type ?? "",
        marketing_opt_in: Boolean(data.marketing_opt_in),
        carrier_pct: data.carrier_pct == null ? null : Number(data.carrier_pct),
      };
    }

    // Loads logged before the driver set a carrier %. Profile asks once what
    // to do with them. Any error — such as before migration 013 — just means
    // there is nothing to ask about.
    const unsplit = () =>
      supabase
        .from("loads")
        .select("load_date", { count: "exact" })
        .eq("user_id", user.id)
        .is("carrier_pct", null);
    const [first, last, snapRes] = await Promise.all([
      unsplit().order("load_date", { ascending: true }).limit(1),
      unsplit().order("load_date", { ascending: false }).limit(1),
      // Every column, so snapshots still list before migration 014 adds
      // the carrier columns.
      supabase
        .from("cost_profile_snapshots")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
    ]);
    snapshots = (snapRes.data ?? []).map((s) => ({
      id: s.id,
      label: s.label ?? null,
      total_cpm: Number(s.total_cpm) || 0,
      required_rate: Number(s.required_rate) || 0,
      monthly_miles: Number(s.monthly_miles) || 0,
      desired_profit_per_mile: Number(s.desired_profit_per_mile) || 0,
      created_at: s.created_at,
      carrier_name: s.carrier_name ?? null,
      carrier_pct: s.carrier_pct == null ? null : Number(s.carrier_pct),
    }));
    if (!first.error && !last.error) {
      pastLoads = {
        count: first.count ?? 0,
        from: first.data?.[0]?.load_date ?? null,
        to: last.data?.[0]?.load_date ?? null,
      };
    }
  }

  return (
    <AppShell
      width="form"
      account={{
        email: email,
        isPro: userIsPro,
        isAdmin: isAdminEmail(email),
      }}
    >
        <h1 className="text-2xl font-black mb-1">Your Profile</h1>
        <p className="text-sm text-muted mb-5">
          Quick info about you and your operation. All optional. Helps us send
          tips that actually match what you haul.
        </p>
        <ProfileForm initial={initial} email={email} pastLoads={pastLoads} />
        <div className="mt-4">
          <FeedbackCard />
        </div>

        <section id="history" className="mt-8 scroll-mt-20">
          <h2 className="text-lg font-bold mb-1">Carrier &amp; rate history</h2>
          <p className="text-sm text-muted mb-4">
            Every snapshot you save on the calculator, newest first: who you
            were driving for, your cost per mile, and your target rate. Load
            one back into the calculator anytime.
          </p>
          {snapshots.length === 0 ? (
            <div className="bg-white border border-border rounded-2xl p-6 text-center">
              <p className="text-sm text-muted">
                No snapshots yet. On the{" "}
                <Link href="/" className="text-brand font-semibold">
                  calculator
                </Link>
                , tap{" "}
                <span className="font-semibold text-foreground">
                  Save a dated snapshot
                </span>{" "}
                to record your first one.
              </p>
            </div>
          ) : (
            <HistoryList snapshots={snapshots} />
          )}
        </section>
    </AppShell>
  );
}
