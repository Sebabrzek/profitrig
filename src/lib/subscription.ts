import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SubscriptionRow = {
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: string;
  plan: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
};

export const PRO_STATUSES = new Set(["trialing", "active"]);

export function isPro(sub: SubscriptionRow | null | undefined): boolean {
  if (!sub) return false;
  if (!PRO_STATUSES.has(sub.status)) return false;
  if (sub.current_period_end) {
    return new Date(sub.current_period_end).getTime() > Date.now();
  }
  // No period end recorded but status is active/trialing — treat as Pro.
  return true;
}

export async function fetchSubscription(
  supabase: SupabaseClient,
  userId: string
): Promise<SubscriptionRow | null> {
  const { data } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as SubscriptionRow | null) ?? null;
}
