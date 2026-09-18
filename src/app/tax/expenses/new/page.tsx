import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { fetchSubscription, isPro } from "@/lib/subscription";
import { EMPTY_EXPENSE, type Expense } from "@/lib/tax/types";
import { driverToday } from "@/lib/driverClock";
import { ExpenseForm } from "../ExpenseForm";

export const dynamic = "force-dynamic";

export default async function NewExpensePage({
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

  // If a target year was passed, default the expense_date to Jan 1 of that
  // year so the entry lands in the right bucket (driver can still pick the
  // real date). "Today" is the driver's: on the UTC server a New Year's Eve
  // receipt entered that evening would default into next tax year.
  const { iso: today } = await driverToday();
  const defaultDate =
    year && /^\d{4}$/.test(year) && year !== today.slice(0, 4)
      ? `${year}-01-01`
      : today;

  const initial: Expense = { ...EMPTY_EXPENSE, expense_date: defaultDate };

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
          <h1 className="text-2xl font-black">Add an expense</h1>
          <Link
            href={`/tax/expenses?year=${year ?? defaultDate.slice(0, 4)}`}
            className="text-sm font-semibold text-brand hover:text-brand-dark"
          >
            ← Back
          </Link>
        </div>
        <ExpenseForm initial={initial} />
    </AppShell>
  );
}
