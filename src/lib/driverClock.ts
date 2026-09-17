import "server-only";
import { cookies } from "next/headers";
import { TZ_COOKIE, parseDateParam, todayIsoIn } from "@/lib/loads";

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
