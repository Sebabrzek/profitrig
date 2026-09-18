import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { fetchSubscription, isPro } from "@/lib/subscription";
import { EMPTY_CAPITAL_ASSET, type CapitalAsset } from "@/lib/tax/types";
import { driverToday } from "@/lib/driverClock";
import { AssetForm } from "../AssetForm";

export const dynamic = "force-dynamic";

export default async function NewAssetPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { year } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const sub = await fetchSubscription(supabase, user.id);
  if (!isPro(sub)) redirect("/upgrade");

  // "Today" is the driver's, not the UTC server's.
  const { iso: today } = await driverToday();
  const defaultDate =
    year && /^\d{4}$/.test(year) && year !== today.slice(0, 4)
      ? `${year}-01-01`
      : today;

  const initial: CapitalAsset = {
    ...EMPTY_CAPITAL_ASSET,
    placed_in_service: defaultDate,
  };

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
          <h1 className="text-2xl font-black">Add a capital asset</h1>
          <Link
            href={`/tax/assets?year=${year ?? defaultDate.slice(0, 4)}`}
            className="text-sm font-semibold text-brand hover:text-brand-dark"
          >
            ← Back
          </Link>
        </div>
        <AssetForm initial={initial} />
    </AppShell>
  );
}
