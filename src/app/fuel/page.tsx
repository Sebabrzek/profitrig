import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Wordmark } from "@/components/Wordmark";
import { HeaderNav } from "@/components/HeaderNav";
import { BottomNav } from "@/components/BottomNav";
import { isAdminEmail } from "@/lib/admin";
import { fetchSubscription, isPro } from "@/lib/subscription";
import { driverToday } from "@/lib/driverClock";
import {
  EMPTY_RIG,
  computeFuelStats,
  type FuelLog,
  type Rig,
} from "@/lib/fuel";
import { RigCard } from "./RigCard";
import { FuelLogCard } from "./FuelLogCard";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/15 rounded-xl p-3">
      <p className="opacity-80 text-xs">{label}</p>
      <p className="text-base font-bold">{value}</p>
    </div>
  );
}

export default async function FuelPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null; // middleware redirects to /login

  const [sub, rigRes, logsRes, { iso: today }] = await Promise.all([
    fetchSubscription(supabase, user.id),
    supabase.from("rigs").select("*").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("fuel_logs")
      .select("id,logged_on,odometer,gallons")
      .eq("user_id", user.id)
      .order("odometer", { ascending: false }),
    driverToday(),
  ]);

  const r = rigRes.data;
  const rig: Rig = r
    ? {
        make: r.make ?? "",
        model: r.model ?? "",
        year: r.year == null ? null : Number(r.year),
        engine: r.engine ?? "",
        transmission:
          r.transmission === "automatic" || r.transmission === "manual"
            ? r.transmission
            : "",
        starting_odometer:
          r.starting_odometer == null ? null : Number(r.starting_odometer),
      }
    : EMPTY_RIG;
  const logs: FuelLog[] = (logsRes.data ?? []).map((l) => ({
    id: l.id,
    logged_on: l.logged_on,
    odometer: Number(l.odometer),
    gallons: Number(l.gallons),
  }));
  const stats = computeFuelStats(rig.starting_odometer, logs);

  const nextStep =
    logs.length === 0
      ? rig.starting_odometer == null
        ? "Add your truck's starting odometer below, then log your first week."
        : "Log your first week below to see your MPG."
      : "Log one more week and your MPG shows up — your first reading is the starting point.";

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 bg-white border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Wordmark size="md" />
          <HeaderNav
            variant="fuel"
            email={user.email ?? ""}
            isAdmin={isAdminEmail(user.email)}
            isPro={isPro(sub)}
          />
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4 pb-28 md:pb-8">
        <h1 className="text-2xl font-black mb-1">Fuel Economy</h1>
        <p className="text-sm text-muted mb-5">
          Each week, log your odometer and the gallons you bought. ProfitRig
          works out the miles per gallon your truck really gets.
        </p>

        <div className="rounded-2xl p-5 mb-4 shadow-sm text-white bg-gradient-to-br from-brand to-brand-dark">
          <p className="text-xs uppercase tracking-wider opacity-80 font-semibold">
            Your average
          </p>
          <p className="text-5xl font-mono font-bold mt-1 leading-none tracking-tight">
            {stats.averageMpg == null ? "—" : stats.averageMpg.toFixed(1)}
            <span className="text-lg font-bold opacity-80"> MPG</span>
          </p>
          {stats.averageMpg == null ? (
            <p className="mt-3 text-sm opacity-90">{nextStep}</p>
          ) : (
            <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
              <Stat
                label="Latest week"
                value={
                  stats.latestMpg == null
                    ? "—"
                    : `${stats.latestMpg.toFixed(1)} MPG`
                }
              />
              <Stat
                label="Miles tracked"
                value={Math.round(stats.milesTracked).toLocaleString("en-US")}
              />
              <Stat
                label="Gallons"
                value={Math.round(stats.gallonsTracked).toLocaleString("en-US")}
              />
            </div>
          )}
        </div>

        <RigCard initial={rig} />
        <FuelLogCard
          entries={stats.entries}
          lastOdometer={stats.lastOdometer}
          today={today}
        />
      </div>
      <BottomNav isPro={isPro(sub)} />
    </main>
  );
}
