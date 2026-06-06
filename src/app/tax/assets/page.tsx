import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Wordmark } from "@/components/Wordmark";
import { HeaderNav } from "@/components/HeaderNav";
import { BottomNav } from "@/components/BottomNav";
import { isAdminEmail } from "@/lib/admin";
import { fetchSubscription, isPro } from "@/lib/subscription";
import type { CapitalAsset } from "@/lib/tax/types";
import { YearSelect } from "../YearSelect";

const money = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });

function thisYear(): number {
  return new Date().getFullYear();
}

export const dynamic = "force-dynamic";

export default async function AssetsPage({
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

  const taxYear = Number.parseInt(year ?? String(thisYear()), 10);
  const { data: rows } = await supabase
    .from("capital_assets")
    .select("id,description,placed_in_service,cost")
    .eq("user_id", user.id)
    .gte("placed_in_service", `${taxYear}-01-01`)
    .lte("placed_in_service", `${taxYear}-12-31`)
    .order("placed_in_service", { ascending: false });

  const assets: CapitalAsset[] = (rows ?? []).map((r) => ({
    id: r.id,
    description: r.description ?? "",
    placed_in_service: r.placed_in_service,
    cost: Number(r.cost) || 0,
  }));

  const grandTotal = assets.reduce((s, a) => s + a.cost, 0);
  const years = [thisYear() - 2, thisYear() - 1, thisYear()];

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
        <div className="flex items-center justify-between mb-3 gap-2">
          <div>
            <h1 className="text-2xl font-black">Capital assets</h1>
            <p className="text-xs text-muted leading-snug">
              Truck, trailer, APU, etc. CPA depreciates / applies §179.
            </p>
          </div>
          <YearSelect taxYear={taxYear} years={years} />
        </div>

        <div className="bg-white border border-border rounded-2xl p-4 mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted font-semibold">
              Total cost placed in service {taxYear}
            </p>
            <p className="text-2xl font-black leading-none">
              {money(grandTotal)}
            </p>
            <p className="text-[10px] text-muted">
              Listed separately — never added to expense totals.
            </p>
          </div>
          <Link
            href={`/tax/assets/new?year=${taxYear}`}
            className="inline-flex items-center justify-center h-12 px-5 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold"
          >
            + Add asset
          </Link>
        </div>

        <Link
          href="/tax"
          className="text-sm font-semibold text-brand hover:text-brand-dark"
        >
          ← Tax Pack
        </Link>

        {assets.length === 0 ? (
          <div className="mt-4 bg-white border border-border rounded-2xl p-8 text-center">
            <p className="text-muted text-sm">
              No capital assets placed in service for {taxYear}.
            </p>
          </div>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {assets.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/tax/assets/${a.id}`}
                  className="block bg-white border border-border rounded-2xl p-4 hover:border-brand"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-bold text-base truncate">
                      {a.description}
                    </p>
                    <p className="font-black text-lg">{money(a.cost)}</p>
                  </div>
                  <p className="text-xs text-muted">
                    Placed in service{" "}
                    {new Date(
                      a.placed_in_service + "T12:00:00"
                    ).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <BottomNav isPro />
    </main>
  );
}
