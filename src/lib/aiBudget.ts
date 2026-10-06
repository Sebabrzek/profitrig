import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  aiBudgetPeriod,
  aiBudgetStatus,
  aiTier,
  spentUsd,
  type AiBudgetStatus,
} from "./aiGuard";
import { isPro, type SubscriptionRow } from "./subscription";

const PAGE = 1000;

/**
 * This month's AI spend, per driver — or for one driver when `userId` is
 * given. Null when it could not be read. Service role only: drivers cannot
 * read ai_usage at all.
 *
 * DISPLAY ONLY. The allowance is enforced in Postgres by ai_reserve_budget,
 * which adds up the same rows the same way; this only shows it. Every
 * column is read so this works before and after migration 019, and rows
 * are paged because Supabase hands back at most 1,000 at a time.
 */
export async function fetchMonthSpend(
  admin: SupabaseClient,
  now: Date,
  userId?: string
): Promise<Map<string, number> | null> {
  const { start } = aiBudgetPeriod(now);
  const rowsByUser = new Map<string, Record<string, unknown>[]>();
  for (let from = 0; ; from += PAGE) {
    let query = admin
      .from("ai_usage")
      .select("*")
      .gte("created_at", start.toISOString())
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (userId) query = query.eq("user_id", userId);
    const { data, error } = await query;
    if (error) return null;
    for (const row of (data ?? []) as Record<string, unknown>[]) {
      const uid = String(row.user_id);
      const list = rowsByUser.get(uid) ?? [];
      list.push(row);
      rowsByUser.set(uid, list);
    }
    if ((data ?? []).length < PAGE) break;
  }
  return new Map([...rowsByUser].map(([uid, rows]) => [uid, spentUsd(rows)]));
}

/** Where one driver stands this month, or null if it could not be read. */
export async function fetchAiBudget(
  admin: SupabaseClient,
  userId: string,
  sub: SubscriptionRow | null,
  now: Date
): Promise<AiBudgetStatus | null> {
  const spend = await fetchMonthSpend(admin, now, userId);
  if (!spend) return null;
  return aiBudgetStatus(aiTier(sub, isPro(sub)), spend.get(userId) ?? 0, now);
}
