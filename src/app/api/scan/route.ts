import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fetchSubscription, isPro } from "@/lib/subscription";
import { proPlusOnSale } from "@/lib/stripe/server";
import {
  AI_MONTHLY_BUDGET_USD,
  aiBudgetPeriod,
  aiTier,
  aiUpgradeFor,
  chatLimitMessage,
  planForTier,
} from "@/lib/aiGuard";
import {
  SCAN_EFFORT,
  SCAN_MAX_BYTES,
  SCAN_MAX_INPUT_TOKENS,
  SCAN_MAX_TOKENS,
  SCAN_MODEL,
  SCAN_OUTPUT_SCHEMA,
  SCAN_SYSTEM_PROMPT,
  cleanScanReading,
  isScanMimeType,
  mergeScanAnswers,
  needsPageTwo,
  pageTwoPrompt,
  scanCostUsd,
  scanLimitsForTier,
  scanReserveUsd,
} from "@/lib/scan";
import { pdfPage } from "@/lib/pdfPages";
import { todayIsoIn, TZ_COOKIE } from "@/lib/loads";

export const runtime = "nodejs";
// Reading a cab photo takes seconds; a slow answer must not be cut off.
export const maxDuration = 120;

/**
 * Scan a rate con or load ticket.
 *
 * The browser sends one file. Everything else is decided here:
 *
 *   1. signed in, on a plan with Loads, the file is an image or PDF ≤ 4 MB
 *   2. a PDF is cut into its first two pages: the AI reads page 1, and
 *      page 2 only if page 1 is missing the pay, a place or the date —
 *      never further (a rate con's later pages are terms and signatures)
 *   3. its size in tokens is measured (free), and anything huge is refused
 *   4. the check in Postgres reserves what this scan may cost — both pages,
 *      if there are two — against the driver's monthly AI allowance
 *      (fails closed)
 *   5. the whole file is stored, privately, under the driver's own folder
 *   6. Opus 5.5 reads it into a fixed JSON shape
 *   7. what it read, tokens and cost are recorded as ONE scan; the browser
 *      gets the scan's id and opens a draft load from it
 *
 * Nothing becomes a load here. The driver checks the draft and saves it.
 */

function fail(error: string, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error, ...extra }, { status });
}

const UNAVAILABLE =
  "Scanning is having a moment. Try again shortly, or enter the load by hand.";

const EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

type Reservation = {
  allowed: boolean;
  reason?: "minute" | "day" | "budget";
  retry_at?: string | null;
  usage_id?: string;
};

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

  const mime = file.type;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const data = Buffer.from(bytes).toString("base64");
  // Today on the driver's calendar, so a date without a year lands right.
  const today = todayIsoIn((await cookies()).get(TZ_COOKIE)?.value);

  // What the AI is shown: a photo as it is; a PDF one page at a time.
  type Part = { block: Anthropic.Beta.BetaContentBlockParam; prompt: string };
  const pdf = (b64: string): Anthropic.Beta.BetaContentBlockParam => ({
    type: "document",
    source: { type: "base64", media_type: "application/pdf", data: b64 },
  });
  const firstPrompt = `Today's date is ${today}. Read this document.`;
  let first: Part;
  let second: Part | null = null;
  if (mime === "application/pdf") {
    const page1 = await pdfPage(bytes, 0);
    const page2 = page1 && page1.pageCount >= 2 ? await pdfPage(bytes, 1) : null;
    // A PDF that cannot be taken apart (damaged, or locked) is read whole;
    // the token limit below still caps what that can cost.
    first = { block: pdf(page1 ? page1.data : data), prompt: firstPrompt };
    if (page2) second = { block: pdf(page2.data), prompt: pageTwoPrompt(today) };
  } else {
    first = {
      block: {
        type: "image",
        source: {
          type: "base64",
          media_type: mime as "image/jpeg" | "image/png" | "image/webp",
          data,
        },
      },
      prompt: firstPrompt,
    };
  }
  const messagesFor = (part: Part): Anthropic.Beta.BetaMessageParam[] => [
    { role: "user", content: [part.block, { type: "text", text: part.prompt }] },
  ];

  const anthropic = new Anthropic({ apiKey });

  // Measured before anything is spent: counting tokens is free.
  const count = async (part: Part) =>
    (
      await anthropic.messages.countTokens({
        model: SCAN_MODEL,
        system: SCAN_SYSTEM_PROMPT,
        messages: messagesFor(part) as Anthropic.MessageParam[],
      })
    ).input_tokens;
  let firstTokens: number;
  let secondTokens = 0;
  try {
    [firstTokens, secondTokens] = await Promise.all([
      count(first),
      second ? count(second) : Promise.resolve(0),
    ]);
  } catch (err) {
    console.error("scan: token count failed", err);
    return fail("That file couldn't be opened. Try a clearer photo, or a different PDF.", 422);
  }
  if (firstTokens > SCAN_MAX_INPUT_TOKENS) {
    return fail(
      "That document is too long to scan. Send just the page with the load on it.",
      413
    );
  }
  if (secondTokens > SCAN_MAX_INPUT_TOKENS) second = null;

  const period = aiBudgetPeriod(new Date());
  const onSale = proPlusOnSale();
  // Held for both pages when there are two, since page 2 may be needed.
  const reserveUsd =
    Math.ceil(
      (scanReserveUsd(firstTokens) + (second ? scanReserveUsd(secondTokens) : 0)) * 10_000
    ) / 10_000;
  const { data: reserved, error: reserveError } = await admin.rpc("ai_reserve_budget", {
    p_user_id: user.id,
    p_plan: planForTier(tier),
    p_model: SCAN_MODEL,
    p_feature: "scan",
    p_per_minute: limits.perMinute,
    p_per_day: limits.perDay,
    p_budget_usd: AI_MONTHLY_BUDGET_USD[tier],
    p_reserve_usd: reserveUsd,
    p_period_start: period.start.toISOString(),
  });
  const reservation = reserved as Reservation | null;
  if (reserveError || !reservation) {
    // Includes migration 019 not having run: scanning has no fallback.
    console.error("scan: usage check failed", reserveError);
    return fail(UNAVAILABLE, 503);
  }
  if (!reservation.allowed || !reservation.usage_id) {
    const reason = reservation.reason ?? "day";
    const message =
      reason === "minute"
        ? "That's a lot of scans at once. Give it a minute, then try again."
        : reason === "day"
          ? `That's today's ${limits.perDay} scans. More free up through the day.`
          : chatLimitMessage("budget", tier, period.resetsAt, onSale);
    return fail(message, 429, {
      reason,
      upgrade: reason === "budget" && aiUpgradeFor(tier, onSale) !== null,
    });
  }
  const usageId = reservation.usage_id;

  async function recordUsage(fields: Record<string, unknown>) {
    const { error } = await admin!
      .from("ai_usage")
      .update({ completed_at: new Date().toISOString(), ...fields })
      .eq("id", usageId);
    if (error) console.error("scan: could not record usage", error);
  }
  // Nothing was sent to the AI: the reservation costs nothing.
  const release = (code: string) =>
    recordUsage({ status: "error", error_code: code, input_tokens: 0, output_tokens: 0, estimated_cost_usd: 0 });

  // The record first, then the file under the driver's own folder.
  const scanId = crypto.randomUUID();
  const storagePath = `${user.id}/${scanId}.${EXTENSION[mime]}`;
  const { error: rowError } = await admin.from("scans").insert({
    id: scanId,
    user_id: user.id,
    storage_path: storagePath,
    mime_type: mime,
    byte_size: file.size,
    usage_id: usageId,
  });
  if (rowError) {
    console.error("scan: could not record scan (migration 020?)", rowError);
    await release("no_scans_table");
    return fail("Scanning isn't switched on yet. Enter this load by hand for now.", 503);
  }
  const { error: uploadError } = await admin.storage
    .from("scans")
    .upload(storagePath, Buffer.from(data, "base64"), { contentType: mime, upsert: false });
  if (uploadError) {
    console.error("scan: could not store file", uploadError);
    await release("storage");
    await admin.from("scans").update({ status: "failed" }).eq("id", scanId);
    return fail(UNAVAILABLE, 503);
  }

  // One read of one part: its answer (null if unusable), cost and tokens.
  async function read(part: Part) {
    const response = await anthropic.beta.messages.create({
      model: SCAN_MODEL,
      max_tokens: SCAN_MAX_TOKENS,
      // A refused read is re-run on the model Anthropic recommends for it.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SCAN_SYSTEM_PROMPT,
      messages: messagesFor(part),
      output_config: {
        effort: SCAN_EFFORT,
        format: { type: "json_schema", schema: SCAN_OUTPUT_SCHEMA as unknown as Record<string, unknown> },
      },
    });
    const u = response.usage;
    const cost = scanCostUsd(
      {
        input_tokens: u.input_tokens,
        output_tokens: u.output_tokens,
        cache_creation_input_tokens: u.cache_creation_input_tokens,
        cache_read_input_tokens: u.cache_read_input_tokens,
        iterations: (u.iterations ?? []).map((i) => ({
          type: i.type,
          model: "model" in i ? String(i.model) : null,
          input_tokens: i.input_tokens,
          output_tokens: i.output_tokens,
          cache_creation_input_tokens: "cache_creation_input_tokens" in i ? i.cache_creation_input_tokens : 0,
          cache_read_input_tokens: "cache_read_input_tokens" in i ? i.cache_read_input_tokens : 0,
        })),
      },
      response.model
    );
    let answer: unknown = null;
    if (response.stop_reason === "end_turn") {
      const textBlock = response.content.find((b) => b.type === "text");
      try {
        answer = textBlock && textBlock.type === "text" ? JSON.parse(textBlock.text) : null;
      } catch {
        answer = null;
      }
    }
    return {
      answer: answer !== null && typeof answer === "object" ? answer : null,
      cost,
      model: response.model,
      stopReason: response.stop_reason,
      input: u.input_tokens,
      output: u.output_tokens,
      cacheWrite: u.cache_creation_input_tokens ?? 0,
      cacheRead: u.cache_read_input_tokens ?? 0,
    };
  }

  try {
    const one = await read(first);
    const total = { ...one };
    let extracted: unknown = one.answer;
    // Page 2 only when page 1 is missing what matters — then stop.
    if (one.answer && second && needsPageTwo(cleanScanReading(one.answer, today))) {
      try {
        const two = await read(second);
        total.cost = Math.round((total.cost + two.cost) * 1_000_000) / 1_000_000;
        total.input += two.input;
        total.output += two.output;
        total.cacheWrite += two.cacheWrite;
        total.cacheRead += two.cacheRead;
        if (two.answer) extracted = mergeScanAnswers(one.answer, two.answer);
      } catch (err) {
        // Page 1's answer stands; the form lists what is still missing.
        console.error("scan: page 2 read failed", err);
      }
    }

    const readOk = extracted !== null && typeof extracted === "object";

    await recordUsage({
      status: readOk ? "succeeded" : "error",
      error_code: readOk ? null : String(one.stopReason ?? "unparsed").slice(0, 60),
      model: one.model,
      input_tokens: total.input,
      output_tokens: total.output,
      cache_creation_input_tokens: total.cacheWrite,
      cache_read_input_tokens: total.cacheRead,
      estimated_cost_usd: total.cost,
    });
    await admin
      .from("scans")
      .update({
        status: readOk ? "read" : "failed",
        document_type: readOk
          ? String((extracted as Record<string, unknown>).document_type ?? "other").slice(0, 40)
          : null,
        extracted: readOk ? extracted : null,
      })
      .eq("id", scanId);

    if (!readOk) {
      return fail(
        "ProfitRig couldn't read that one. Try a sharper photo with the whole page in view, or enter the load by hand.",
        422,
        { scanId }
      );
    }
    return NextResponse.json({ scanId });
  } catch (err) {
    console.error("scan: read failed", err);
    // Billed only if the provider produced something; nothing came back here.
    await recordUsage({
      status: "error",
      error_code: err instanceof Error ? err.name.slice(0, 60) : "unknown",
      estimated_cost_usd: 0,
    });
    await admin.from("scans").update({ status: "failed" }).eq("id", scanId);
    return fail(UNAVAILABLE, 503);
  }
}
