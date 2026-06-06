import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Wordmark } from "@/components/Wordmark";
import { HeaderNav } from "@/components/HeaderNav";
import { BottomNav } from "@/components/BottomNav";
import { isAdminEmail } from "@/lib/admin";
import { fetchSubscription, isPro } from "@/lib/subscription";
import type { Expense, ExpenseCategory } from "@/lib/tax/types";
import { ExpenseForm } from "../ExpenseForm";

export const dynamic = "force-dynamic";

export default async function EditExpensePage({
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
    .from("expenses")
    .select("id,expense_date,category,amount,vendor,note")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data) notFound();

  const initial: Expense = {
    id: data.id,
    expense_date: data.expense_date,
    category: data.category as ExpenseCategory,
    amount: Number(data.amount) || 0,
    vendor: data.vendor ?? "",
    note: data.note ?? "",
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
          <h1 className="text-2xl font-black">Edit expense</h1>
          <Link
            href={`/tax/expenses?year=${initial.expense_date.slice(0, 4)}`}
            className="text-sm font-semibold text-brand hover:text-brand-dark"
          >
            ← Back
          </Link>
        </div>
        <ExpenseForm initial={initial} expenseId={id} />
      </div>
      <BottomNav isPro />
    </main>
  );
}
