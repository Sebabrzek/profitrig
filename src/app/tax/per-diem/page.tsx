import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/ui/Surfaces";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
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
    <AppShell
      width="form"
      account={{
        email: user.email ?? "",
        isPro: true,
        isAdmin: isAdminEmail(user.email),
      }}
    >
        <PageHeader
          title="Per-diem worksheet"
          description="Nights away from your tax home × IRS rate × 80% (DOT rule)."
          action={<YearSelect taxYear={taxYear} years={years} />}
        />

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
    </AppShell>
  );
}
