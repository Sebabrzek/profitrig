/**
 * The guardrails around Ask ProfitRig: what a driver may send, how much they
 * may ask, what the server refuses without paying for an AI call, what
 * conversation the model actually sees, and what a request cost.
 *
 * Pure functions only — no database, no network, no secrets — so every rule
 * is tested (npm test) and can be read in one place. The limits themselves
 * are enforced in Postgres (ai_reserve_request, migration 015); these are
 * the numbers handed to it.
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

export function limitsForPlan(plan: Plan): PlanLimits {
  return PLAN_LIMITS[plan];
}

/** What Anthropic charges, per million tokens. Checked 19 Sep 2026. */
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
