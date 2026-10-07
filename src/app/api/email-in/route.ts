import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fetchSubscription, isPro } from "@/lib/subscription";
import { aiTier } from "@/lib/aiGuard";
import { scanLimitsForTier } from "@/lib/scan";
import { runScan, type ScanRunOutcome } from "@/lib/scanRun";
import { todayIsoIn } from "@/lib/loads";
import {
  describeOutcome,
  gmailConfirmation,
  pickAttachments,
  recipientName,
  type EmailOutcome,
  type InboundEmail,
} from "@/lib/emailIn";

export const runtime = "nodejs";
// Postmark waits two minutes; three documents read side by side fit well inside.
export const maxDuration = 120;

/**
 * Email-in: Postmark posts every email that reaches *@in.profitrig.com here.
 *
 *   1. Postmark proves who it is (basic auth with POSTMARK_INBOUND_SECRET);
 *      anyone else gets 403, which also tells Postmark to stop retrying
 *   2. the address picks the driver; unknown addresses are dropped
 *   3. an email already handled (Postmark re-delivers) is not read again
 *   4. Gmail's forwarding confirmation is kept so the driver can see the code
 *   5. up to three PDFs or photos are read by the shared scanner — the same
 *      allowance, limits and page-by-page reading as the Scan button — and
 *      a document already received is skipped at no cost
 *   6. what happened is logged in one plain sentence for the driver
 *
 * Every read becomes a DRAFT on the driver's Loads page. Nothing is saved as
 * a load, and nothing is sent back.
 */

function authorized(request: Request, secret: string): boolean {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Basic ")) return false;
  let password = "";
  try {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    password = decoded.slice(decoded.indexOf(":") + 1);
  } catch {
    return false;
  }
  const a = Buffer.from(password);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

const ok = (note: string) => NextResponse.json({ ok: true, note });

export async function POST(request: Request) {
  const secret = process.env.POSTMARK_INBOUND_SECRET;
  // Not set up yet: Postmark keeps the email and retries for six hours.
  if (!secret) return NextResponse.json({ error: "not configured" }, { status: 503 });
  if (!authorized(request, secret)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let email: InboundEmail;
  try {
    email = (await request.json()) as InboundEmail;
  } catch {
    return NextResponse.json({ error: "bad payload" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!admin || !apiKey) {
    console.error("email-in: missing service role key or Anthropic key");
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }

  const name = recipientName(email);
  if (!name) return ok("no in.profitrig.com recipient");
  const { data: address } = await admin
    .from("email_in_addresses")
    .select("user_id")
    .eq("local_part", name)
    .maybeSingle();
  if (!address) return ok("unknown address");
  const userId = String(address.user_id);

  const messageId = typeof email.MessageID === "string" ? email.MessageID.slice(0, 200) : null;
  if (messageId) {
    const { data: seen } = await admin
      .from("email_in_messages")
      .select("id")
      .eq("postmark_message_id", messageId)
      .maybeSingle();
    if (seen) return ok("already handled");
  }

  const base = {
    user_id: userId,
    postmark_message_id: messageId,
    from_email: (email.FromFull?.Email ?? email.From ?? "").slice(0, 200) || null,
    from_name: (email.FromFull?.Name ?? email.FromName ?? "").slice(0, 200) || null,
    subject: (email.Subject ?? "").slice(0, 300) || null,
  };
  const log = async (outcome: EmailOutcome, extra: Record<string, unknown> = {}) => {
    const { data, error } = await admin
      .from("email_in_messages")
      .insert({ ...base, outcome, detail: describeOutcome(outcome), ...extra })
      .select("id")
      .single();
    if (error) console.error("email-in: could not log email", error);
    return (data?.id as string | undefined) ?? null;
  };

  const gmail = gmailConfirmation(email);
  if (gmail) {
    await log("gmail_confirmation", { gmail_code: gmail.code, gmail_from: gmail.from });
    return ok("gmail confirmation kept");
  }

  const sub = await fetchSubscription(admin, userId);
  const tier = aiTier(sub, isPro(sub));
  const limits = scanLimitsForTier(tier);
  if (!limits) {
    await log("not_on_plan");
    return ok("not on a plan with scanning");
  }

  const { picked, extra } = pickAttachments(email);
  if (picked.length === 0) {
    await log("no_attachment");
    return ok("nothing to read");
  }

  // Logged first: each scan points back at the email it came in.
  const logId = await log("failed");
  if (!logId) return NextResponse.json({ error: "unavailable" }, { status: 503 });

  // The same file twice in one email is one document.
  const fingerprints = new Set<string>();
  const jobs = picked
    .map((a) => ({ ...a, sha256: createHash("sha256").update(a.bytes).digest("hex") }))
    .filter((a) => !fingerprints.has(a.sha256) && fingerprints.add(a.sha256));

  const today = todayIsoIn(null);
  const results = await Promise.all(
    jobs.map(async (job): Promise<ScanRunOutcome | { kind: "duplicate" }> => {
      const { data: earlier } = await admin
        .from("scans")
        .select("id")
        .eq("user_id", userId)
        .eq("content_sha256", job.sha256)
        .limit(1);
      if (earlier && earlier.length > 0) return { kind: "duplicate" };
      return runScan({
        admin,
        apiKey,
        userId,
        tier,
        // Several attachments arrive at once; the day's limit still holds.
        limits: { perMinute: Math.max(limits.perMinute, 15), perDay: limits.perDay },
        bytes: job.bytes,
        mime: job.mime,
        today,
        email: { messageId: logId, sha256: job.sha256 },
      });
    })
  );

  const count = (k: string) => results.filter((r) => r.kind === k).length;
  const read = count("read");
  const transient = count("unavailable") + count("not_set_up");
  // Nothing read and something only temporarily wrong: let Postmark retry.
  // The log row goes, so the retry is not mistaken for a repeat; anything
  // already stored is recognised by its fingerprint and not paid for twice.
  if (read === 0 && transient > 0) {
    await admin.from("email_in_messages").delete().eq("id", logId);
    return NextResponse.json({ error: "try again" }, { status: 503 });
  }

  const outcome: EmailOutcome =
    read > 0
      ? "scanned"
      : count("duplicate") === results.length
        ? "duplicate"
        : count("limit") > 0
          ? "over_limit"
          : "failed";
  await admin
    .from("email_in_messages")
    .update({ outcome, detail: describeOutcome(outcome, { read, extra }), documents_read: read })
    .eq("id", logId);
  return ok(outcome);
}
