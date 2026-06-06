import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Wordmark } from "@/components/Wordmark";
import { HeaderNav } from "@/components/HeaderNav";
import { BottomNav } from "@/components/BottomNav";
import { isAdminEmail } from "@/lib/admin";
import { fetchSubscription, isPro } from "@/lib/subscription";
import { EMPTY_CAPITAL_ASSET, type CapitalAsset, todayIso } from "@/lib/tax/types";
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

  const defaultDate =
    year && /^\d{4}$/.test(year) && Number(year) !== new Date().getFullYear()
      ? `${year}-01-01`
      : todayIso();

  const initial: CapitalAsset = {
    ...EMPTY_CAPITAL_ASSET,
    placed_in_service: defaultDate,
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 bg-white border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Wordmark size="md" />
          <HeaderNav
            variant="tax"
            email={user.email ?? ""}
            isAdmin={isAdminEmail(user.email)}
            isPro
          />
        </div>
      </header>
      <div className="max-w-2xl mx-auto px-4 py-4 pb-28 md:pb-8">
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
      </div>
      <BottomNav isPro />
    </main>
  );
}
