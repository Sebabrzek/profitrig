"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fetchSubscription, isPro } from "@/lib/subscription";
import { aiTier } from "@/lib/aiGuard";
import { scanLimitsForTier } from "@/lib/scan";
import { addressFor, checkName, firstFreeName } from "@/lib/emailIn";

export type ClaimResult =
  | { ok: true; address: string }
  | { ok: false; error: string; suggestion?: string };

/**
 * Give the signed-in driver the address they asked for — dennis@ — or, if
 * someone has it, say so and offer the first free dennis2, dennis3, …
 * Changing it frees the old name at once. Written by the server, since
 * drivers cannot write addresses themselves (migration 021).
 */
export async function claimEmailAddressAction(raw: string): Promise<ClaimResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const sub = await fetchSubscription(supabase, user.id);
  if (!scanLimitsForTier(aiTier(sub, isPro(sub)))) {
    return { ok: false, error: "Emailing loads in comes with ProfitRig Pro." };
  }

  const checked = checkName(typeof raw === "string" ? raw : "");
  if (!checked.ok) return { ok: false, error: checked.error };
  const name = checked.name;

  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "This isn't available right now. Try again shortly." };

  const { data: rows, error: readError } = await admin
    .from("email_in_addresses")
    .select("user_id,local_part")
    .like("local_part", `${name}%`);
  if (readError) {
    return { ok: false, error: "Email-in isn't switched on yet." };
  }
  const mine = (rows ?? []).find((r) => r.user_id === user.id);
  if (mine?.local_part === name) return { ok: true, address: addressFor(name) };
  const taken = new Set(
    (rows ?? []).filter((r) => r.user_id !== user.id).map((r) => String(r.local_part))
  );
  const free = firstFreeName(name, taken);
  if (free !== name) {
    return {
      ok: false,
      error: `${name} is taken.`,
      suggestion: free ?? undefined,
    };
  }

  const { error } = await admin
    .from("email_in_addresses")
    .upsert(
      { user_id: user.id, local_part: name, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
  if (error) {
    // Someone took it a moment ago.
    return { ok: false, error: `${name} was just taken. Try again.` };
  }
  revalidatePath("/profile");
  revalidatePath("/loads/new");
  return { ok: true, address: addressFor(name) };
}

/**
 * Set an emailed draft aside: "not a load". Only the driver's own, and only
 * one not already saved as a load. The file stays in their records.
 */
export async function dismissScanAction(
  scanId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  if (typeof scanId !== "string" || !/^[0-9a-f-]{36}$/i.test(scanId)) {
    return { ok: false, error: "That draft no longer exists." };
  }
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "This isn't available right now. Try again shortly." };
  const { error } = await admin
    .from("scans")
    .update({ dismissed_at: new Date().toISOString() })
    .eq("id", scanId)
    .eq("user_id", user.id)
    .is("load_id", null);
  if (error) return { ok: false, error: "Couldn't set that aside. Try again." };
  revalidatePath("/loads");
  return { ok: true };
}
