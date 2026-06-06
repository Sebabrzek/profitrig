import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Wordmark } from "@/components/Wordmark";
import { HeaderNav } from "@/components/HeaderNav";
import { BottomNav } from "@/components/BottomNav";
import { isAdminEmail } from "@/lib/admin";
import { fetchSubscription, isPro } from "@/lib/subscription";
import { CATEGORIES, categoryMeta } from "@/lib/tax/categories";
import type { Expense, ExpenseCategory } from "@/lib/tax/types";
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
            <h1 className="text-2xl font-black">Expenses</h1>
            <p className="text-xs text-muted leading-snug">
              Non-load business expenses, actuals only.
            </p>
          </div>
          <YearSelect taxYear={taxYear} years={years} />
        </div>

        <div className="bg-white border border-border rounded-2xl p-4 mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted font-semibold">
              Total {taxYear}
            </p>
            <p className="text-2xl font-black leading-none">
              {money(grandTotal)}
            </p>
          </div>
          <Link
            href={`/tax/expenses/new?year=${taxYear}`}
            className="inline-flex items-center justify-center h-12 px-5 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold"
          >
            + Add expense
          </Link>
        </div>

        <Link
          href="/tax"
          className="text-sm font-semibold text-brand hover:text-brand-dark"
        >
          ← Tax Pack
        </Link>

        {expenses.length === 0 ? (
          <div className="mt-4 bg-white border border-border rounded-2xl p-8 text-center">
            <p className="text-muted text-sm">
              No expenses recorded for {taxYear}. Tap{" "}
              <span className="font-semibold text-foreground">+ Add expense</span>{" "}
              after every business receipt.
            </p>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {CATEGORIES.map((cat) => {
              const list = grouped.get(cat.key) ?? [];
              if (list.length === 0) return null;
              return (
                <section
                  key={cat.key}
                  className="bg-white border border-border rounded-2xl p-4"
                >
                  <div className="flex items-baseline justify-between mb-1">
                    <p className="font-bold text-sm">{cat.label}</p>
                    <p className="font-black text-base">
                      {money(totalByCat.get(cat.key) ?? 0)}
                    </p>
                  </div>
                  <p className="text-[11px] text-muted mb-3">
                    Suggested: {cat.scheduleC}
                  </p>
                  <ul className="flex flex-col gap-2">
                    {list.map((e) => (
                      <li key={e.id}>
                        <Link
                          href={`/tax/expenses/${e.id}`}
                          className="block border border-border rounded-xl px-3 py-2 hover:border-brand"
                        >
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-xs text-muted">
                              {new Date(
                                e.expense_date + "T12:00:00"
                              ).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </span>
                            <span className="font-bold text-sm">
                              {money(e.amount)}
                            </span>
                          </div>
                          {(e.vendor || e.note) && (
                            <p className="text-xs text-muted truncate">
                              {[e.vendor, e.note].filter(Boolean).join(" · ")}
                            </p>
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </div>
      <BottomNav isPro />
    </main>
  );
}
