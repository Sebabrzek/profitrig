import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fetchSubscription, isPro } from "@/lib/subscription";
import { proPlusOnSale } from "@/lib/stripe/server";
import { aiBudgetPeriod, aiTier, aiUpgradeFor, chatLimitMessage } from "@/lib/aiGuard";
import { SCAN_MAX_BYTES, isScanMimeType, scanLimitsForTier } from "@/lib/scan";
import { runScan } from "@/lib/scanRun";
import { todayIsoIn, TZ_COOKIE } from "@/lib/loads";

export const runtime = "nodejs";
// Reading a cab photo takes seconds; a slow answer must not be cut off.
export const maxDuration = 120;

/**
 * Scan a rate con or load ticket from the Scan button.
 *
 * The browser sends one file. This checks who is asking and what they sent;
 * the reading itself — page by page for a PDF, measured, reserved against
 * the monthly AI allowance, stored privately, read by Opus 5.5 — is the
 * shared scanner (lib/scanRun), the same one email-in uses.
 *
 * Nothing becomes a load here. The driver checks the draft and saves it.
 */

function fail(error: string, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error, ...extra }, { status });
}

const UNAVAILABLE =
  "Scanning is having a moment. Try again shortly, or enter the load by hand.";

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return fail("Scanning isn't set up on this server yet.", 503);

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Not signed in.", 401);

  const sub = await fetchSubscription(supabase, user.id);
  const tier = aiTier(sub, isPro(sub));
  const limits = scanLimitsForTier(tier);
  if (!limits) {
    return fail("Scanning comes with ProfitRig Pro, along with the Loads it fills in.", 403, {
      upgrade: true,
    });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    console.error("scan: SUPABASE_SERVICE_ROLE_KEY is not set");
    return fail(UNAVAILABLE, 503);
  }

  let file: File | null = null;
  try {
    const form = await request.formData();
    const f = form.get("file");
    file = f instanceof File ? f : null;
  } catch {
    return fail("That upload didn't come through. Try again.", 400);
  }
  if (!file || file.size === 0) return fail("Pick a photo or PDF first.", 400);
  if (!isScanMimeType(file.type)) {
    return fail("Scan a photo (JPG, PNG) or a PDF.", 415);
  }
  if (file.size > SCAN_MAX_BYTES) {
    return fail("That file is over 4 MB. Take a photo instead, or send just the rate con page.", 413);
  }

  const outcome = await runScan({
    admin,
    apiKey,
    userId: user.id,
    tier,
    limits,
    bytes: new Uint8Array(await file.arrayBuffer()),
    mime: file.type,
    // Today on the driver's calendar, so a date without a year lands right.
    today: todayIsoIn((await cookies()).get(TZ_COOKIE)?.value),
  });

  switch (outcome.kind) {
    case "read":
      return NextResponse.json({ scanId: outcome.scanId });
    case "unreadable":
      return fail(
        "ProfitRig couldn't read that one. Try a sharper photo with the whole page in view, or enter the load by hand.",
        422,
        { scanId: outcome.scanId }
      );
    case "cant_open":
      return fail("That file couldn't be opened. Try a clearer photo, or a different PDF.", 422);
    case "too_long":
      return fail("That document is too long to scan. Send just the page with the load on it.", 413);
    case "limit": {
      const period = aiBudgetPeriod(new Date());
      const onSale = proPlusOnSale();
      const message =
        outcome.reason === "minute"
          ? "That's a lot of scans at once. Give it a minute, then try again."
          : outcome.reason === "day"
            ? `That's today's ${limits.perDay} scans. More free up through the day.`
            : chatLimitMessage("budget", tier, period.resetsAt, onSale);
      return fail(message, 429, {
        reason: outcome.reason,
        upgrade: outcome.reason === "budget" && aiUpgradeFor(tier, onSale) !== null,
      });
    }
    case "not_set_up":
      return fail("Scanning isn't switched on yet. Enter this load by hand for now.", 503);
    case "unavailable":
      return fail(UNAVAILABLE, 503);
  }
}
