"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { postmarkConfig, reactivate } from "@/lib/postmark";

/**
 * A driver's own switch for ProfitRig's announcement emails. Turning it back
 * on after unsubscribing from an email also asks Postmark to deliver to them
 * again — only ever because they chose it here.
 */
export async function setProductUpdatesAction(
  on: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  if (typeof on !== "boolean") return { ok: false, error: "Bad request." };

  const { data: before } = await supabase
    .from("email_preferences")
    .select("unsubscribed_at")
    .eq("user_id", user.id)
    .maybeSingle();
  const { error } = await supabase.from("email_preferences").upsert(
    {
      user_id: user.id,
      product_updates: on,
      ...(on ? { unsubscribed_at: null } : {}),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) return { ok: false, error: "Couldn't save. Try again." };

  const config = postmarkConfig();
  if (on && before?.unsubscribed_at && config && user.email) {
    await reactivate(config.token, config.stream, user.email);
  }
  revalidatePath("/profile");
  return { ok: true };
}
