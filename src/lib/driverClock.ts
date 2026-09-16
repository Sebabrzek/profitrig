import "server-only";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  TZ_COOKIE,
  parseDateParam,
  parseWeekStart,
  todayIsoIn,
  type WeekStart,
} from "@/lib/loads";

/**
 * Today on the driver's own calendar, from the time zone their browser
 * reported. Until the first report arrives this is the server clock, and
 * TimeZoneCookie refreshes the page as soon as it knows better.
 *
 * `now` is local noon on that date: safe for every week and month helper,
 * which read local getters, whatever zone the server runs in.
 */
export async function driverToday(): Promise<{ iso: string; now: Date }> {
  const tz = (await cookies()).get(TZ_COOKIE)?.value;
  const iso = todayIsoIn(tz);
  return { iso, now: parseDateParam(iso) };
}

/**
 * The day the driver's week starts on. No profile row, no saved choice, or a
 * database without the week_start column yet (migration 012) all mean
 * Monday — so this ships safely before the migration runs.
 */
export async function fetchWeekStart(
  supabase: SupabaseClient,
  userId: string
): Promise<WeekStart> {
  const { data, error } = await supabase
    .from("driver_profiles")
    .select("week_start")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return "monday";
  return parseWeekStart(data.week_start);
}
