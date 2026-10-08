import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isPro, type SubscriptionRow } from "@/lib/subscription";
import type { Person } from "@/lib/messages";

/**
 * Everyone with an account, as the Messages tab needs them: email, first
 * name, plan, the "Send me ProfitRig emails" box, how they're paid, their
 * own email switch, and when they last logged a load. Service role only.
 */
export async function loadPeople(admin: SupabaseClient): Promise<Person[]> {
  const [{ data: usersData }, profiles, subs, prefs, loads] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin.from("driver_profiles").select("user_id,first_name,marketing_opt_in,authority_type"),
    admin.from("subscriptions").select("*"),
    admin.from("email_preferences").select("user_id,product_updates"),
    admin.from("loads").select("user_id,load_date").order("load_date", { ascending: false }),
  ]);
  const profileBy = new Map((profiles.data ?? []).map((p) => [String(p.user_id), p]));
  const subBy = new Map(((subs.data ?? []) as SubscriptionRow[]).map((s) => [s.user_id, s]));
  const prefBy = new Map((prefs.data ?? []).map((p) => [String(p.user_id), p]));
  const lastLoad = new Map<string, string>();
  for (const l of loads.data ?? []) {
    const uid = String(l.user_id);
    if (!lastLoad.has(uid) && l.load_date) lastLoad.set(uid, String(l.load_date));
  }
  return (usersData?.users ?? []).map((u) => {
    const p = profileBy.get(u.id);
    const pref = prefBy.get(u.id);
    return {
      userId: u.id,
      email: u.email ?? "",
      firstName: String(p?.first_name ?? ""),
      pro: isPro(subBy.get(u.id) ?? null),
      marketingOptIn: Boolean(p?.marketing_opt_in),
      authorityType: String(p?.authority_type ?? ""),
      productUpdates: pref && typeof pref.product_updates === "boolean" ? pref.product_updates : null,
      lastLoadDate: lastLoad.get(u.id) ?? null,
    };
  });
}
