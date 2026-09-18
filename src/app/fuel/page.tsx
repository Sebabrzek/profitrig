import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/ui/Surfaces";
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
    <AppShell
      width="standard"
      account={{
        email: user.email ?? "",
        isPro: isPro(sub),
        isAdmin: isAdminEmail(user.email),
      }}
    >
        <PageHeader
          title="Fuel Economy"
          description="Each week, log your odometer and the gallons you bought. ProfitRig works out the miles per gallon your truck really gets."
        />

        <AnswerLayout>
        <AnswerColumn>
        <InstrumentPanel>
          <Reading
            size="hero"
            label="Your average"
            value={stats.averageMpg == null ? "—" : stats.averageMpg.toFixed(1)}
            unit="MPG"
            context={stats.averageMpg == null ? nextStep : undefined}
          />
          {stats.averageMpg != null && (
            <ReadingGrid>
              <Reading
                label="Latest week"
                value={
                  stats.latestMpg == null ? "—" : stats.latestMpg.toFixed(1)
                }
                unit={stats.latestMpg == null ? undefined : "MPG"}
              />
              <Reading
                label="Miles tracked"
                figure={false}
                value={Math.round(stats.milesTracked).toLocaleString("en-US")}
              />
              <Reading
                label="Gallons"
                figure={false}
                value={Math.round(stats.gallonsTracked).toLocaleString("en-US")}
              />
            </ReadingGrid>
          )}
        </InstrumentPanel>

        </AnswerColumn>
        <WorkColumn>
        <RigCard initial={rig} />
        <FuelLogCard
          entries={stats.entries}
          lastOdometer={stats.lastOdometer}
          today={today}
        />
        </WorkColumn>
        </AnswerLayout>
    </AppShell>
  );
}
