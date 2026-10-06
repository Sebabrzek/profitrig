/**
 * The guardrails around Ask ProfitRig: what a driver may send, how much they
 * may ask, what the server refuses without paying for an AI call, what
 * conversation the model actually sees, and what a request cost.
 *
 * Pure functions only — no database, no network, no secrets — so every rule
 * is tested (npm test) and can be read in one place. The limits themselves
 * are enforced in Postgres (ai_reserve_budget, migration 019 — or the older
 * ai_reserve_request, migration 015, until 019 has run); these are the
 * numbers handed to it.
 */

/** The model every Ask ProfitRig answer comes from. */
export const CHAT_MODEL = "claude-haiku-4-5";

/** An answer is 2–5 sentences; this is the hard ceiling. */
export const CHAT_MAX_TOKENS = 500;

/** A driver's question. Longer is refused, never silently cut. */
export const CHAT_MAX_MESSAGE_CHARS = 1500;

/** How much of the recent conversation the model is given. */
export const CHAT_CONTEXT_MESSAGES = 6;
export const CHAT_CONTEXT_MINUTES = 60;
/** A replayed answer is trimmed to keep the request small. */
export const CHAT_CONTEXT_ASSISTANT_CHARS = 1200;

/** How many messages the chat shows again when it is reopened. */
export const CHAT_HISTORY_MESSAGES = 20;
export const CHAT_HISTORY_HOURS = 24;

/** Below this many questions left, the chat says so. */
export const CHAT_REMAINING_NOTICE_AT = 2;

export type Plan = "pro" | "free";

export type PlanLimits = {
  /** Rolling 60 seconds. */
  perMinute: number;
  /** Rolling 24 hours. */
  perDay: number;
  /** Rolling 30 days. */
  perMonth: number;
};

const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  pro: { perMinute: 5, perDay: 30, perMonth: 300 },
  free: { perMinute: 5, perDay: 5, perMonth: 25 },
};

/**
 * The question counts from before the monthly allowance. Used only if
 * migration 019 has not run, when the server falls back to the old check.
 */
export function limitsForPlan(plan: Plan): PlanLimits {
  return PLAN_LIMITS[plan];
}

// ─────────────────────────────────────────────────────────────────────
// The monthly AI allowance
// ─────────────────────────────────────────────────────────────────────

/**
 * Which AI allowance a driver has. Pro and Pro Plus open the same screens;
 * they differ only in how much AI a month includes.
 */
export type AiTier = "free" | "trial" | "pro_monthly" | "pro_yearly" | "pro_plus";

/**
 * What one driver's AI may cost ProfitRig in a month, in dollars: Ask
 * ProfitRig and scanning together. At most about 40% of what the plan
 * earns — $9.99 → $4, $99 a year ($8.25 a month) → $3.30, $19.99 → $8.
 * Agreed with Sebastian, 6 Oct 2026.
 *
 * A trial needs no card, so it gets a starter allowance rather than the
 * plan's: otherwise every throwaway sign-up is $4 of AI for nothing.
 */
export const AI_MONTHLY_BUDGET_USD: Record<AiTier, number> = {
  free: 0.25,
  trial: 1,
  pro_monthly: 4,
  pro_yearly: 3.3,
  pro_plus: 8,
};

/**
 * Ask ProfitRig's per-minute and per-day caps. They stop a runaway; the
 * dollar allowance is the real limit.
 */
const CHAT_RATE_LIMITS: Record<AiTier, { perMinute: number; perDay: number }> = {
  free: { perMinute: 5, perDay: 5 },
  trial: { perMinute: 5, perDay: 30 },
  pro_monthly: { perMinute: 5, perDay: 30 },
  pro_yearly: { perMinute: 5, perDay: 30 },
  pro_plus: { perMinute: 5, perDay: 60 },
};

export function chatLimitsForTier(tier: AiTier): { perMinute: number; perDay: number } {
  return CHAT_RATE_LIMITS[tier];
}

/**
 * What a question is allowed to cost while it runs. Above the most one can
 * cost — the whole system prompt, a full replayed conversation, a maximum
 * question and a maximum answer come to about a cent on Haiku — so a
 * question that starts always has room to finish.
 */
export const CHAT_RESERVE_USD = 0.015;

/** From this share of the allowance on, the driver is told. */
export const AI_BUDGET_NOTICE_AT_PERCENT = 80;

export const AI_TIER_LABEL: Record<AiTier, string> = {
  free: "Free",
  trial: "Pro trial",
  pro_monthly: "Pro",
  pro_yearly: "Pro (yearly)",
  pro_plus: "Pro Plus",
};

/**
 * The allowance a subscription carries. `pro` is the caller's isPro() —
 * whether the subscription is live at all.
 */
export function aiTier(
  sub: { status: string; plan: string | null } | null | undefined,
  pro: boolean
): AiTier {
  if (!pro || !sub) return "free";
  if (sub.status === "trialing") return "trial";
  if (sub.plan === "pro_plus") return "pro_plus";
  if (sub.plan === "yearly" || sub.plan === "year") return "pro_yearly";
  return "pro_monthly";
}

/** Pro Plus is Pro for every screen and every rule except the allowance. */
export function planForTier(tier: AiTier): Plan {
  return tier === "free" ? "free" : "pro";
}

/**
 * The allowance runs by calendar month from midnight UTC on the 1st. That is
 * on or before midnight on the 1st everywhere in the US, so it never resets
 * later than a driver was told — and it does not depend on the time zone
 * their browser reports, which they could change.
 */
export function aiBudgetPeriod(now: Date): { start: Date; resetsAt: Date } {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  return {
    start: new Date(Date.UTC(y, m, 1)),
    resetsAt: new Date(Date.UTC(y, m + 1, 1)),
  };
}

/** "Nov 1" */
export function formatResetDate(resetsAt: Date): string {
  return resetsAt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** "$0.42", "<$0.01" — AI spend for Admin, to the cent. Drivers never see it. */
export function formatAiDollars(usd: number): string {
  if (!Number.isFinite(usd) || usd <= 0) return "$0.00";
  if (usd < 0.01) return "<$0.01";
  return `$${usd.toFixed(2)}`;
}

/** A usage row's cost: what it cost if finished, what it holds if running. */
export function spentUsd(
  rows: { estimated_cost_usd?: unknown; reserved_cost_usd?: unknown }[]
): number {
  let total = 0;
  for (const r of rows) {
    const v = r.estimated_cost_usd ?? r.reserved_cost_usd ?? 0;
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) total += n;
  }
  return Math.round(total * 1_000_000) / 1_000_000;
}

export type AiBudgetStatus = {
  tier: AiTier;
  budgetUsd: number;
  spentUsd: number;
  /** 0–100. 100 only when the next question would not fit. */
  usedPercent: number;
  nearlyOut: boolean;
  out: boolean;
  resetsAt: Date;
};

/**
 * Where a driver stands this month. Drivers see a percentage, never dollars;
 * Admin sees both.
 */
export function aiBudgetStatus(tier: AiTier, spent: number, now: Date): AiBudgetStatus {
  const budgetUsd = AI_MONTHLY_BUDGET_USD[tier];
  const out = spent + CHAT_RESERVE_USD > budgetUsd;
  const raw = budgetUsd > 0 ? (spent / budgetUsd) * 100 : 100;
  const usedPercent = out ? 100 : Math.max(0, Math.min(99, Math.floor(raw)));
  return {
    tier,
    budgetUsd,
    spentUsd: spent,
    usedPercent,
    nearlyOut: usedPercent >= AI_BUDGET_NOTICE_AT_PERCENT,
    out,
    resetsAt: aiBudgetPeriod(now).resetsAt,
  };
}

/**
 * Where "more AI" lives for this driver, if anywhere. Pro Plus is only
 * offered once its Stripe price is set; a trial's starter allowance is not
 * raised by changing plans, so a trial is offered nothing.
 */
export function aiUpgradeFor(tier: AiTier, proPlusOnSale: boolean): "pro" | "pro_plus" | null {
  if (tier === "free") return "pro";
  if ((tier === "pro_monthly" || tier === "pro_yearly") && proPlusOnSale) return "pro_plus";
  return null;
}

/** What a driver is told when Ask ProfitRig says no, by reason and plan. */
export function chatLimitMessage(
  reason: "minute" | "day" | "month" | "budget",
  tier: AiTier,
  resetsAt: Date,
  proPlusOnSale: boolean
): string {
  if (reason === "minute") {
    return "That's a lot of questions at once. Give it a minute, then ask again.";
  }
  if (reason === "day") {
    const perDay = chatLimitsForTier(tier).perDay;
    return tier === "free"
      ? `You've reached today's Ask ProfitRig limit. Free accounts get ${perDay} questions a day; Pro includes up to ${chatLimitsForTier("pro_monthly").perDay}.`
      : `You've reached today's Ask ProfitRig limit of ${perDay} questions. More free up through the day.`;
  }
  if (reason === "month") {
    return "You've reached this month's Ask ProfitRig limit.";
  }
  const when = formatResetDate(resetsAt);
  if (tier === "free") {
    return `You've used this month's free AI allowance. It resets ${when} — or go Pro for a much bigger one.`;
  }
  if (tier === "trial") {
    return `You've used the AI included with your free trial. Your full monthly allowance starts when your plan does.`;
  }
  if (aiUpgradeFor(tier, proPlusOnSale) === "pro_plus") {
    return `You've used this month's AI allowance. It resets ${when}. Need more? Pro Plus includes twice as much.`;
  }
  return `You've used this month's AI allowance. It resets ${when}.`;
}

/**
 * What Anthropic charges, per million tokens. Haiku checked 19 Sep 2026;
 * Opus 5.5 (scanning) and the Opus models a refused scan can fall back to,
 * 6 Oct 2026. Cache writes are 1.25× input.
 */
export const AI_PRICING: Record<
  string,
  { inputPerMTok: number; outputPerMTok: number; cacheWritePerMTok: number; cacheReadPerMTok: number }
> = {
  "claude-haiku-4-5": {
    inputPerMTok: 1,
    outputPerMTok: 5,
    cacheWritePerMTok: 1.25,
    cacheReadPerMTok: 0.1,
  },
  "claude-opus-5-5": {
    inputPerMTok: 4,
    outputPerMTok: 20,
    cacheWritePerMTok: 5,
    cacheReadPerMTok: 0.2,
  },
  "claude-opus-5": {
    inputPerMTok: 5,
    outputPerMTok: 25,
    cacheWritePerMTok: 6.25,
    cacheReadPerMTok: 0.5,
  },
  "claude-opus-4-8": {
    inputPerMTok: 5,
    outputPerMTok: 25,
    cacheWritePerMTok: 6.25,
    cacheReadPerMTok: 0.5,
  },
};

export type TokenUsage = {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
};

/** What a request cost, in dollars, rounded to the millionth. */
export function estimateCostUsd(model: string, usage: TokenUsage): number {
  const price = AI_PRICING[model];
  if (!price) return 0;
  const n = (v: number | null | undefined) => (Number.isFinite(v) ? Number(v) : 0);
  const dollars =
    (n(usage.input_tokens) * price.inputPerMTok +
      n(usage.output_tokens) * price.outputPerMTok +
      n(usage.cache_creation_input_tokens) * price.cacheWritePerMTok +
      n(usage.cache_read_input_tokens) * price.cacheReadPerMTok) /
    1_000_000;
  return Math.round(dollars * 1_000_000) / 1_000_000;
}

/** Tokens are unknown when an answer is cut off; estimate from the text. */
export function estimateOutputTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ─────────────────────────────────────────────────────────────────────
// What a driver may send
// ─────────────────────────────────────────────────────────────────────

export type MessageCheck =
  | { ok: true; message: string }
  | { ok: false; reason: "empty" | "too_long"; length: number };

/**
 * A question must be real text and at most 1,500 characters — counted in
 * characters a person would count, so an emoji is one, not two.
 */
export function validateUserMessage(raw: unknown): MessageCheck {
  const text = typeof raw === "string" ? raw.trim() : "";
  const length = [...text].length;
  if (length === 0) return { ok: false, reason: "empty", length: 0 };
  if (length > CHAT_MAX_MESSAGE_CHARS) {
    return { ok: false, reason: "too_long", length };
  }
  return { ok: true, message: text };
}

// ─────────────────────────────────────────────────────────────────────
// What the server refuses before paying for an AI call
// ─────────────────────────────────────────────────────────────────────

/** The one line Ask ProfitRig gives for anything outside its job. */
export const OFF_TOPIC_REPLY =
  "I'm Ask ProfitRig. I can help with ProfitRig, trucking business finances, operating costs, rates, loads, fuel, and owner-operator financial questions.";

/**
 * Attempts to talk the assistant out of its instructions. Deliberately
 * narrow: phrases a driver would never type about their trucking business.
 */
const OVERRIDE_PATTERNS: RegExp[] = [
  /\bignore\b[^.?!]{0,40}\b(previous|prior|above|earlier|all)\b[^.?!]{0,20}\b(instruction|instructions|rules|prompt)\b/i,
  /\b(disregard|forget)\b[^.?!]{0,30}\b(instruction|instructions|rules|prompt|guidelines)\b/i,
  /\b(system|initial|original)\s+prompt\b/i,
  /\b(reveal|show|print|repeat|output|tell me)\b[^.?!]{0,30}\b(your|the)\b[^.?!]{0,20}\b(prompt|instructions|rules|guidelines)\b/i,
  /\byou are (now|no longer)\b/i,
  /\b(developer|debug|god|dan)\s+mode\b/i,
  /\bjailbreak\b/i,
  /\bpretend (to be|you are|that you)\b/i,
  /\bact as\b[^.?!]{0,20}\b(ai|assistant|chatgpt|claude|gpt|hacker|lawyer|doctor|therapist)\b/i,
  /\bwithout (any )?(restrictions|filters|rules)\b/i,
];

/** Work that is plainly not trucking-business help. */
const OFF_TOPIC_PATTERNS: RegExp[] = [
  /\bwrite\b[^.?!]{0,30}\b(essay|poem|song|lyrics|story|novel|script|screenplay|cover letter|resume|blog post|homework)\b/i,
  /\bwrite\b[^.?!]{0,30}\b(code|program|function|script)\b[^.?!]{0,30}\b(python|javascript|java|c\+\+|sql|html|css|react)\b/i,
  /\b(python|javascript|java|c\+\+|sql|html|css|react)\b[^.?!]{0,20}\b(code|function|script|program)\b/i,
  /\b(recipe|recipes)\b[^.?!]{0,30}\b(for|to make)\b/i,
  /\bhow (do|to) (i|you) (cook|bake|make)\b(?![^.?!]{0,30}\b(money|profit)\b)/i,
  /\b(translate|summarize|summarise)\b[^.?!]{0,30}\b(this|the following|below)\b[^.?!]{0,20}\b(article|essay|text|paragraph|book|document)\b/i,
  /\b(who|what) (should|will) i vote\b/i,
  /\b(democrat|republican|election|president)\b[^.?!]{0,30}\b(opinion|think|better|should)\b/i,
  /\b(solve|do)\b[^.?!]{0,20}\bmy\b[^.?!]{0,20}\b(homework|assignment|exam|test)\b/i,
];

export type ScreenResult =
  | { allowed: true }
  | { allowed: false; category: "override" | "off_topic" };

/**
 * A cheap first pass, before any AI call. It only catches the obvious: the
 * hardened system prompt does the rest of the work. Anything it is unsure
 * about goes through to the model.
 */
export function screenUserMessage(message: string): ScreenResult {
  for (const pattern of OVERRIDE_PATTERNS) {
    if (pattern.test(message)) return { allowed: false, category: "override" };
  }
  for (const pattern of OFF_TOPIC_PATTERNS) {
    if (pattern.test(message)) return { allowed: false, category: "off_topic" };
  }
  return { allowed: true };
}

// ─────────────────────────────────────────────────────────────────────
// What the model sees
// ─────────────────────────────────────────────────────────────────────

export type StoredMessage = { role: string; content: string };

/** A stored row as the database hands it back. */
export type StoredRow = StoredMessage & { created_at?: string; id?: string };

/**
 * Stored messages in the order they were said: oldest first, and a question
 * ahead of the answer it got. Two rows can share a timestamp to the
 * millisecond (several questions sent at once), so the id breaks any
 * remaining tie — the same rows always come back in the same order.
 */
export function orderStoredMessages<T extends StoredRow>(rows: T[]): T[] {
  const rank = (role: string) => (role === "assistant" ? 1 : 0);
  return [...rows].sort((a, b) => {
    const byTime = (a.created_at ?? "").localeCompare(b.created_at ?? "");
    if (byTime !== 0) return byTime;
    const byRole = rank(a.role) - rank(b.role);
    if (byRole !== 0) return byRole;
    return (a.id ?? "").localeCompare(b.id ?? "");
  });
}
export type ModelMessage = { role: "user" | "assistant"; content: string };

/**
 * The conversation sent to the model: the driver's recent exchanges from
 * ProfitRig's own records, then the new question. Rows arrive oldest first
 * and are only ever this driver's server-written ones.
 *
 * The browser sends nothing but the new question, so no one can invent an
 * earlier "answer" to argue with later.
 */
export function buildConversation(
  history: StoredMessage[],
  message: string
): ModelMessage[] {
  const clean: ModelMessage[] = [];
  for (const row of history) {
    if (row.role !== "user" && row.role !== "assistant") continue;
    const content =
      row.role === "assistant"
        ? row.content.slice(0, CHAT_CONTEXT_ASSISTANT_CHARS)
        : row.content.slice(0, CHAT_MAX_MESSAGE_CHARS);
    if (!content.trim()) continue;
    // The model needs strict user → assistant → user order.
    if (clean.length > 0 && clean[clean.length - 1].role === row.role) {
      clean[clean.length - 1] = { role: row.role, content };
      continue;
    }
    clean.push({ role: row.role, content });
  }
  // Keep the most recent exchanges, and never open on an answer.
  let recent = clean.slice(-CHAT_CONTEXT_MESSAGES);
  while (recent.length > 0 && recent[0].role === "assistant") recent = recent.slice(1);
  // The last stored row is the previous answer; a trailing question means
  // that answer never arrived, so it is dropped rather than doubled up.
  while (recent.length > 0 && recent[recent.length - 1].role === "user") {
    recent = recent.slice(0, -1);
  }
  return [...recent, { role: "user", content: message }];
}
