import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { fetchSubscription, isPro } from "@/lib/subscription";
import {
  EMPTY_TAX_PROFILE,
  type EntityType,
  type TaxProfile,
  type TruckFinancing,
} from "@/lib/tax/types";
import { TaxProfileForm } from "./TaxProfileForm";

export const dynamic = "force-dynamic";

export default async function TaxProfilePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const sub = await fetchSubscription(supabase, user.id);
  if (!isPro(sub)) redirect("/upgrade");

  const { data } = await supabase
    .from("tax_profiles")
    .select("entity_type,has_hired_driver,truck_financing")
    .eq("user_id", user.id)
    .maybeSingle();

  const initial: TaxProfile = data
    ? {
        entity_type: (data.entity_type as EntityType | null) ?? null,
        has_hired_driver: Boolean(data.has_hired_driver),
        truck_financing: (data.truck_financing as TruckFinancing | null) ?? null,
      }
    : EMPTY_TAX_PROFILE;

  return (
    <AppShell
      width="form"
      account={{
        email: user.email ?? "",
        isPro: true,
        isAdmin: isAdminEmail(user.email),
      }}
    >
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-black">Tax Profile</h1>
          <Link
            href="/tax"
            className="text-sm font-semibold text-brand hover:text-brand-dark"
          >
            ← Tax Pack
          </Link>
        </div>
        <p className="text-sm text-muted mb-4 leading-snug">
          Tells the Tax Pack which line items apply to you. Drives the
          driver-pay rule and the truck-payment treatment. Change anytime.
        </p>
        <TaxProfileForm initial={initial} />
    </AppShell>
  );
}
