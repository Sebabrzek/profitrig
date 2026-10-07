import "server-only";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { fetchSubscription, isPro } from "@/lib/subscription";
import { fetchDriverSettings } from "@/lib/driverSettings";
import { driverToday } from "@/lib/driverClock";
import { canInvoice } from "@/lib/invoices";

/**
 * Every invoice page starts here: a signed-in Pro driver who isn't leased.
 * A leased driver is paid by their carrier, so there is nothing to invoice.
 */
export async function invoicingContext() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!isPro(await fetchSubscription(supabase, user.id))) redirect("/upgrade");
  const [settings, { iso: today }] = await Promise.all([fetchDriverSettings(supabase, user.id), driverToday()]);
  if (!canInvoice(settings.authorityType)) notFound();
  return {
    supabase,
    user,
    today,
    account: { email: user.email ?? "", isPro: true, isAdmin: isAdminEmail(user.email) },
  };
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
