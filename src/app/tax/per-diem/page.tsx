import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Wordmark } from "@/components/Wordmark";
import { HeaderNav } from "@/components/HeaderNav";
import { BottomNav } from "@/components/BottomNav";
import { isAdminEmail } from "@/lib/admin";
import { fetchSubscription, isPro } from "@/lib/subscription";
import { emptyPerDiemSummary, type PerDiemRate } from "@/lib/tax/types";
import { suggestNightsFromLoads } from "@/lib/tax/perDiem";
import { PerDiemForm } from "./PerDiemForm";
import { YearSelect } from "../YearSelect";

function thisYear(): number {
  return new Date().getFullYear();
}

export const dynamic = "force-dynamic";

export default async function PerDiemPage({
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

  const [summaryRes, ratesRes, loadsRes] = await Promise.all([
    supabase
      .from("per_diem_summary")
      .select("period_a_nights,period_b_nights")
      .eq("user_id", user.id)
      .eq("tax_year", taxYear)
      .maybeSingle(),
    supabase
      .from("per_diem_rates")
      .select("effective_date,conus_rate,ooc_rate,notice")
      .order("effective_date", { ascending: true }),
    supabase
      .from("loads")
      .select("load_date,loaded_miles")
      .eq("user_id", user.id)
      .gte("load_date", `${taxYear}-01-01`)
      .lte("load_date", `${taxYear}-12-31`),
  ]);

  const initial = summaryRes.data
    ? {
        tax_year: taxYear,
        period_a_nights: Number(summaryRes.data.period_a_nights) || 0,
        period_b_nights: Number(summaryRes.data.period_b_nights) || 0,
      }
    : emptyPerDiemSummary(taxYear);

  const rates: PerDiemRate[] = (ratesRes.data ?? []).map((r) => ({
    effective_date: r.effective_date,
    conus_rate: Number(r.conus_rate) || 0,
    ooc_rate: Number(r.ooc_rate) || 0,
    notice: r.notice ?? "",
  }));

  const suggested = suggestNightsFromLoads(
    (loadsRes.data ?? []).map((r) => ({
      load_date: r.load_date,
      loaded_miles: Number(r.loaded_miles) || 0,
    })),
    taxYear
  );

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
            <h1 className="text-2xl font-black">Per-diem worksheet</h1>
            <p className="text-xs text-muted leading-snug">
              Nights away from your tax home × IRS rate × 80% (DOT rule).
            </p>
          </div>
          <YearSelect taxYear={taxYear} years={years} />
        </div>

        <Link
          href="/tax"
          className="text-sm font-semibold text-brand hover:text-brand-dark"
        >
          ← Tax Pack
        </Link>

        <div className="mt-3">
          <PerDiemForm
            initial={initial}
            rates={rates}
            taxYear={taxYear}
            suggestedNights={suggested}
          />
        </div>
      </div>
      <BottomNav isPro />
    </main>
  );
}
