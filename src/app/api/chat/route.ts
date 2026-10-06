import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fetchSubscription, isPro } from "@/lib/subscription";
import { proPlusOnSale } from "@/lib/stripe/server";
import { CHAT_SYSTEM_PROMPT } from "@/lib/supportChat";
import {
  CHAT_CONTEXT_MESSAGES,
  CHAT_CONTEXT_MINUTES,
  CHAT_MAX_MESSAGE_CHARS,
  CHAT_MAX_TOKENS,
  CHAT_MODEL,
  CHAT_RESERVE_USD,
  AI_MONTHLY_BUDGET_USD,
  OFF_TOPIC_REPLY,
  aiBudgetPeriod,
  aiTier,
  aiUpgradeFor,
  buildConversation,
  chatLimitMessage,
  chatLimitsForTier,
  estimateCostUsd,
  estimateOutputTokens,
  limitsForPlan,
  orderStoredMessages,
  planForTier,
  screenUserMessage,
  validateUserMessage,
} from "@/lib/aiGuard";

export const runtime = "nodejs";

/**
 * Ask ProfitRig.
 *
 * The browser sends one question and nothing else. Everything that decides
 * what the model sees — who is asking, what they are allowed, what was said
 * before — is worked out here:
 *
 *   1. signed in, message is 1–1,500 characters
 *   2. the check in Postgres reserves this request against the driver's
 *      per-minute and per-day caps and monthly AI allowance (fails closed)
 *   3. obvious misuse is refused without paying for an AI call
 *   4. the recent conversation is read back from ProfitRig's own records
 *   5. the answer streams, and stops if the driver closes the chat
 *   6. tokens, cost and status are recorded against the driver
 */

const UNAVAILABLE =
  "Ask ProfitRig is having a moment. Try again shortly — or tap Talk to a human and Sebastian will pick it up.";

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

type Reservation = {
  allowed: boolean;
  reason?: "minute" | "day" | "month" | "budget";
  retry_at?: string | null;
  usage_id?: string;
  remaining_day?: number;
  /** This month's spend before this request (migration 019 onwards). */
  spent_usd?: number;
};

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return fail(
      "Chat isn't set up yet on this server. Use Profile → Send feedback instead.",
      503
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Not signed in.", 401);

  // Counting a request needs the service-role key. Without it we would be
  // answering questions nobody is counting, so the chat closes instead.
  const admin = createSupabaseAdminClient();
  if (!admin) {
    console.error("ask-profitrig: SUPABASE_SERVICE_ROLE_KEY is not set");
    return fail(UNAVAILABLE, 503);
  }

  let body: { message?: unknown };
  try {
    body = await request.json();
  } catch {
    return fail("Bad request.", 400);
  }

  const checked = validateUserMessage(body?.message);
  if (!checked.ok) {
    return fail(
      checked.reason === "empty"
        ? "Type a question first."
        : `That's ${checked.length.toLocaleString()} characters. Keep a question under ${CHAT_MAX_MESSAGE_CHARS.toLocaleString()} and send the important part.`,
      400
    );
  }
  const message = checked.message;

  const sub = await fetchSubscription(supabase, user.id);
  const tier = aiTier(sub, isPro(sub));
  const plan = planForTier(tier);
  const limits = chatLimitsForTier(tier);
  const budgetUsd = AI_MONTHLY_BUDGET_USD[tier];
  const period = aiBudgetPeriod(new Date());
  const onSale = proPlusOnSale();

  // One call decides and records: it locks on this driver, counts their
  // rolling minute and 24 hours, adds up this month's AI spend, and only
  // then reserves the request — holding enough to finish it. Two requests
  // at the same instant are handled one after the other.
  let { data, error: reserveError } = await admin.rpc("ai_reserve_budget", {
    p_user_id: user.id,
    p_plan: plan,
    p_model: CHAT_MODEL,
    p_feature: "chat",
    p_per_minute: limits.perMinute,
    p_per_day: limits.perDay,
    p_budget_usd: budgetUsd,
    p_reserve_usd: CHAT_RESERVE_USD,
    p_period_start: period.start.toISOString(),
  });
  // Until migration 019 runs, the old question counts still guard the chat.
  if (reserveError?.code === "PGRST202") {
    const legacy = limitsForPlan(plan);
    ({ data, error: reserveError } = await admin.rpc("ai_reserve_request", {
      p_user_id: user.id,
      p_plan: plan,
      p_model: CHAT_MODEL,
      p_per_minute: legacy.perMinute,
      p_per_day: legacy.perDay,
      p_per_month: legacy.perMonth,
    }));
  }
  const reservation = data as Reservation | null;
  if (reserveError || !reservation) {
    console.error("ask-profitrig: usage check failed", reserveError);
    return fail(UNAVAILABLE, 503);
  }
  if (!reservation.allowed || !reservation.usage_id) {
    const reason = reservation.reason ?? "day";
    return NextResponse.json(
      {
        error: chatLimitMessage(reason, tier, period.resetsAt, onSale),
        reason,
        retryAt:
          reason === "budget"
            ? period.resetsAt.toISOString()
            : reservation.retry_at ?? null,
        // Only when a bigger allowance is actually for sale to them.
        upgrade:
          reason === "budget" && aiUpgradeFor(tier, onSale) !== null,
      },
      { status: 429 }
    );
  }
  const usageId = reservation.usage_id;
  // How much of the month this question takes them to, counting what it
  // holds. A percentage only: drivers never see dollars.
  const usedPercent =
    reservation.spent_usd == null || budgetUsd <= 0
      ? ""
      : String(
          Math.min(
            100,
            Math.floor(
              ((Number(reservation.spent_usd) + CHAT_RESERVE_USD) / budgetUsd) * 100
            )
          )
        );
  const headers = {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Ask-Remaining-Day": String(reservation.remaining_day ?? ""),
    "X-Ai-Used-Percent": usedPercent,
  };

  async function saveMessage(role: "user" | "assistant", content: string) {
    const { data: row, error } = await admin!
      .from("support_chats")
      // trusted: written by ProfitRig itself. Only these rows are ever read
      // back as conversation history.
      .insert({ user_id: user!.id, role, content, trusted: true })
      .select("id")
      .single();
    if (error) console.error("ask-profitrig: could not save message", error);
    return (row?.id as string | undefined) ?? null;
  }

  async function recordUsage(fields: Record<string, unknown>) {
    const { error } = await admin!
      .from("ai_usage")
      .update({ completed_at: new Date().toISOString(), ...fields })
      .eq("id", usageId);
    if (error) console.error("ask-profitrig: could not record usage", error);
  }

  // The conversation so far, read before the new question is stored.
  const since = new Date(
    Date.now() - CHAT_CONTEXT_MINUTES * 60_000
  ).toISOString();
  const { data: priorRows, error: historyError } = await admin
    .from("support_chats")
    .select("id,role,content,created_at")
    .eq("user_id", user.id)
    .eq("trusted", true)
    .gte("created_at", since)
    // Newest first to take the last few, then put back in the order they
    // were said. The id keeps rows saved in the same millisecond stable.
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(CHAT_CONTEXT_MESSAGES * 2);
  if (historyError) {
    // A missing history is a worse answer, not a wrong one: carry on.
    console.error("ask-profitrig: could not read history", historyError);
  }
  const conversation = buildConversation(
    orderStoredMessages(priorRows ?? []),
    message
  );

  const userMessageId = await saveMessage("user", message);

  // Obvious misuse is refused here, before any AI call is paid for.
  const screened = screenUserMessage(message);
  if (!screened.allowed) {
    const assistantMessageId = await saveMessage("assistant", OFF_TOPIC_REPLY);
    await recordUsage({
      status: "blocked",
      error_code: screened.category,
      input_tokens: 0,
      output_tokens: 0,
      estimated_cost_usd: 0,
      user_message_id: userMessageId,
      assistant_message_id: assistantMessageId,
    });
    return new Response(OFF_TOPIC_REPLY, { headers });
  }

  const anthropic = new Anthropic({ apiKey });
  // A second, tiny system block: the big one above it never changes.
  const driverContext = `About this driver: plan = ${
    plan === "pro"
      ? "Pro (paid)"
      : "Free (calculator only — Loads and Tax are locked)"
  }.`;

  const messageStream = anthropic.messages.stream(
    {
      model: CHAT_MODEL,
      max_tokens: CHAT_MAX_TOKENS,
      system: [
        { type: "text", text: CHAT_SYSTEM_PROMPT },
        { type: "text", text: driverContext },
      ],
      messages: conversation,
    },
    // Best effort: if the platform tells us the driver left, stop
    // generating. Vercel usually lets a request finish, so an abandoned
    // answer may complete — capped at CHAT_MAX_TOKENS, and still recorded.
    { signal: request.signal }
  );

  const encoder = new TextEncoder();
  let answer = "";
  let settled = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of messageStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            answer += event.delta.text;
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        const final = await messageStream.finalMessage();
        settled = true;
        const assistantMessageId = answer.trim()
          ? await saveMessage("assistant", answer)
          : null;
        await recordUsage({
          status: "succeeded",
          input_tokens: final.usage.input_tokens,
          output_tokens: final.usage.output_tokens,
          cache_creation_input_tokens:
            final.usage.cache_creation_input_tokens ?? null,
          cache_read_input_tokens: final.usage.cache_read_input_tokens ?? null,
          estimated_cost_usd: estimateCostUsd(CHAT_MODEL, final.usage),
          user_message_id: userMessageId,
          assistant_message_id: assistantMessageId,
        });
      } catch (err) {
        console.error("ask-profitrig: answer failed", err);
        if (!settled) {
          settled = true;
          const fallback =
            "\n\nSorry — I hit a snag answering that. Try again in a minute, or tap Talk to a human.";
          try {
            controller.enqueue(encoder.encode(fallback));
          } catch {
            // the driver is already gone
          }
          const partial = answer.trim() ? await saveMessage("assistant", answer) : null;
          const output = estimateOutputTokens(answer);
          await recordUsage({
            status: "error",
            error_code: err instanceof Error ? err.name.slice(0, 60) : "unknown",
            output_tokens: output,
            usage_estimated: true,
            estimated_cost_usd: estimateCostUsd(CHAT_MODEL, {
              output_tokens: output,
            }),
            user_message_id: userMessageId,
            assistant_message_id: partial,
          });
        }
      }
      try {
        controller.close();
      } catch {
        // already closed by a cancel
      }
    },
    async cancel() {
      // The driver closed the chat. Ask the provider to stop; whether it
      // does depends on the platform reporting the disconnect at all.
      messageStream.abort();
      if (settled) return;
      settled = true;
      const assistantMessageId = answer.trim()
        ? await saveMessage("assistant", answer)
        : null;
      const output = estimateOutputTokens(answer);
      await recordUsage({
        status: "cancelled",
        output_tokens: output,
        usage_estimated: true,
        estimated_cost_usd: estimateCostUsd(CHAT_MODEL, {
          output_tokens: output,
        }),
        user_message_id: userMessageId,
        assistant_message_id: assistantMessageId,
      });
    },
  });

  return new Response(stream, { headers });
}
