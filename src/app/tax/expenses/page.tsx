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
import { CATEGORIES, categoryMeta } from "@/lib/tax/categories";
import type { Expense, ExpenseCategory } from "@/lib/tax/types";
import { YearSelect } from "../YearSelect";

function thisYear(): number {
  return new Date().getFullYear();
}

export const dynamic = "force-dynamic";

export default async function ExpensesPage({
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
    .from("expenses")
    .select("id,expense_date,category,amount,vendor,note")
    .eq("user_id", user.id)
    .gte("expense_date", `${taxYear}-01-01`)
    .lte("expense_date", `${taxYear}-12-31`)
    .order("expense_date", { ascending: false });

  const expenses: Expense[] = (rows ?? []).map((r) => ({
    id: r.id,
    expense_date: r.expense_date,
    category: r.category as ExpenseCategory,
    amount: Number(r.amount) || 0,
    vendor: r.vendor ?? "",
    note: r.note ?? "",
  }));

  // Group by category
  const grouped = new Map<ExpenseCategory, Expense[]>();
  for (const e of expenses) {
    if (!grouped.has(e.category)) grouped.set(e.category, []);
    grouped.get(e.category)!.push(e);
  }

  const totalByCat = new Map<ExpenseCategory, number>();
  for (const [k, list] of grouped.entries()) {
    totalByCat.set(
      k,
      list.reduce((s, e) => s + e.amount, 0)
    );
  }
  const grandTotal = expenses.reduce((s, e) => s + e.amount, 0);

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
          title="Expenses"
          description="Non-load business expenses, actuals only."
          action={<YearSelect taxYear={taxYear} years={years} />}
        />

        <Card as="div" className="mb-4 flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Reading
              label={<>Total {taxYear}</>}
              value={formatMoney(grandTotal)}
            />
          </div>
          <ButtonLink
            href={`/tax/expenses/new?year=${taxYear}`}
            variant="primary"
            className="shrink-0"
          >
            + Add expense
          </ButtonLink>
        </Card>

        <Link href="/tax" className="pr-link pr-hit text-sm">
          ← Tax Pack
        </Link>

        {expenses.length === 0 ? (
          <EmptyState className="mt-4" title={<>No expenses recorded for {taxYear}.</>}>
            Tap{" "}
            <span className="font-semibold text-foreground">+ Add expense</span>{" "}
            after every business receipt.
          </EmptyState>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {CATEGORIES.map((cat) => {
              const list = grouped.get(cat.key) ?? [];
              if (list.length === 0) return null;
              const headingId = `expenses-${cat.key}`;
              return (
                <Card key={cat.key} aria-labelledby={headingId}>
                  <div className="flex items-baseline justify-between gap-3">
                    <h2
                      id={headingId}
                      className="font-display text-base font-bold text-[var(--pr-rig-green)]"
                    >
                      {cat.label}
                    </h2>
                    <p className="pr-figure shrink-0 text-lg font-semibold">
                      {formatMoney(totalByCat.get(cat.key) ?? 0)}
                    </p>
                  </div>
                  <p className="mt-0.5 text-xs leading-snug text-muted">
                    Suggested: {cat.scheduleC}
                  </p>
                  {/* Date | vendor and note | amount — one row per receipt,
                      the whole row opens it. */}
                  <ul className="mt-3 divide-y divide-border border-t border-border">
                    {list.map((e) => (
                      <li key={e.id}>
                        <Link
                          href={`/tax/expenses/${e.id}`}
                          className="pr-row-link -mx-2 grid-cols-[5.5rem_minmax(0,1fr)_auto] gap-3 px-2 py-2.5"
                        >
                          <span className="text-xs tabular-nums text-muted">
                            {new Date(
                              e.expense_date + "T12:00:00"
                            ).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                          <span className="truncate text-sm">
                            {[e.vendor, e.note].filter(Boolean).join(" · ")}
                          </span>
                          <span className="pr-figure text-[15px] font-semibold">
                            {formatMoney(e.amount)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Card>
              );
            })}
          </div>
        )}
    </AppShell>
  );
}
