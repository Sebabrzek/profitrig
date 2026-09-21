import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { AppShell } from "@/components/shell/AppShell";
import { Card, EmptyState, PageHeader } from "@/components/ui/Surfaces";
import { Reading } from "@/components/instruments/Instruments";
import { formatMoney } from "@/lib/format";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { fetchSubscription, isPro } from "@/lib/subscription";
import type { CapitalAsset } from "@/lib/tax/types";
import { YearSelect } from "../YearSelect";

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
    <AppShell
      width="form"
      account={{
        email: user.email ?? "",
        isPro: true,
        isAdmin: isAdminEmail(user.email),
      }}
    >
        <PageHeader
          title="Capital assets"
          description="Truck, trailer, APU, etc. CPA depreciates / applies §179."
          action={<YearSelect taxYear={taxYear} years={years} />}
        />

        <Card as="div" className="mb-4 flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Reading
              label={<>Total cost placed in service {taxYear}</>}
              value={formatMoney(grandTotal)}
              context="Listed separately — never added to expense totals."
            />
          </div>
          <ButtonLink
            href={`/tax/assets/new?year=${taxYear}`}
            variant="primary"
            className="shrink-0"
          >
            + Add asset
          </ButtonLink>
        </Card>

        <Link href="/tax" className="pr-link pr-hit text-sm">
          ← Tax Pack
        </Link>

        {assets.length === 0 ? (
          <EmptyState
            className="mt-4"
            title={<>No capital assets placed in service for {taxYear}.</>}
          />
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {assets.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/tax/assets/${a.id}`}
                  className="pr-record pr-record-link flex items-center justify-between gap-4 p-4"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-display text-base font-bold">
                      {a.description}
                    </span>
                    <span className="mt-0.5 block text-[13px] text-muted">
                      Placed in service{" "}
                      {new Date(
                        a.placed_in_service + "T12:00:00"
                      ).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </span>
                  <span className="pr-figure shrink-0 text-xl font-semibold">
                    {formatMoney(a.cost)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
    </AppShell>
  );
}
