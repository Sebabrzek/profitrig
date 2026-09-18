import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { fetchSubscription, isPro } from "@/lib/subscription";
import type { CapitalAsset } from "@/lib/tax/types";
import { AssetForm } from "../AssetForm";

export const dynamic = "force-dynamic";

export default async function EditAssetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const sub = await fetchSubscription(supabase, user.id);
  if (!isPro(sub)) redirect("/upgrade");

  const { data } = await supabase
    .from("capital_assets")
    .select("id,description,placed_in_service,cost")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data) notFound();

  const initial: CapitalAsset = {
    id: data.id,
    description: data.description ?? "",
    placed_in_service: data.placed_in_service,
    cost: Number(data.cost) || 0,
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
          <h1 className="text-2xl font-black">Edit capital asset</h1>
          <Link
            href={`/tax/assets?year=${initial.placed_in_service.slice(0, 4)}`}
            className="text-sm font-semibold text-brand hover:text-brand-dark"
          >
            ← Back
          </Link>
        </div>
        <AssetForm initial={initial} assetId={id} />
    </AppShell>
  );
}
