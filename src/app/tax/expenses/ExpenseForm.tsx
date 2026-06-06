"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { CATEGORIES, categoryMeta } from "@/lib/tax/categories";
import {
  deleteExpenseAction,
  upsertExpenseAction,
} from "@/lib/tax/actions";
import type { Expense, ExpenseCategory } from "@/lib/tax/types";

function textValue(value: number) {
  return value === 0 ? "" : String(value);
}

function cleanNumeric(raw: string) {
  const onlyAllowed = raw.replace(/[^0-9.]/g, "");
  const firstDot = onlyAllowed.indexOf(".");
  if (firstDot === -1) return onlyAllowed;
  return (
    onlyAllowed.slice(0, firstDot + 1) +
    onlyAllowed.slice(firstDot + 1).replace(/\./g, "")
  );
}

export function ExpenseForm({
  initial,
  expenseId,
}: {
  initial: Expense;
  expenseId?: string;
}) {
  const router = useRouter();
  const [e, setE] = useState<Expense>({ ...initial, id: expenseId });
  const [amountText, setAmountText] = useState(() => textValue(initial.amount));
  const [pending, startTransition] = useTransition();
  const [deletePending, startDelete] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const meta = useMemo(() => categoryMeta(e.category), [e.category]);

  function save() {
    setError(null);
    startTransition(async () => {
      const r = await upsertExpenseAction(e);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.push(`/tax/expenses?year=${e.expense_date.slice(0, 4)}`);
      router.refresh();
    });
  }

  function remove() {
    if (!expenseId) return;
    if (!confirm("Delete this expense? This cannot be undone.")) return;
    setError(null);
    startDelete(async () => {
      const r = await deleteExpenseAction(expenseId);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.push(`/tax/expenses?year=${e.expense_date.slice(0, 4)}`);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="bg-white border border-border rounded-2xl p-5 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Date</span>
          <input
            type="date"
            value={e.expense_date}
            onChange={(ev) =>
              setE((s) => ({ ...s, expense_date: ev.target.value }))
            }
            className="w-full h-12 px-4 rounded-xl border border-border bg-white text-base focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Category</span>
          <select
            value={e.category}
            onChange={(ev) =>
              setE((s) => ({
                ...s,
                category: ev.target.value as ExpenseCategory,
              }))
            }
            className="w-full h-12 px-4 rounded-xl border border-border bg-white text-base focus:outline-none focus:ring-2 focus:ring-brand"
          >
            {CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted leading-snug">
            Suggested: {meta.scheduleC} ·{" "}
            <span className="italic">CPA-confirmable</span>
          </p>
          {meta.hint && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-1 leading-snug">
              {meta.hint}
            </p>
          )}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Amount</span>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted font-semibold pointer-events-none">
              $
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={amountText}
              onFocus={(ev) => ev.currentTarget.select()}
              onChange={(ev) => {
                const next = cleanNumeric(ev.target.value);
                setAmountText(next);
                const parsed = next === "" || next === "." ? 0 : parseFloat(next);
                setE((s) => ({
                  ...s,
                  amount: Number.isFinite(parsed) ? parsed : 0,
                }));
              }}
              onBlur={() => {
                if (amountText === "." || amountText === "") setAmountText("");
                else if (amountText.endsWith("."))
                  setAmountText(amountText.slice(0, -1));
              }}
              className="w-full h-12 pl-8 pr-4 rounded-xl border border-border bg-white text-base font-medium focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Vendor (optional)</span>
          <input
            type="text"
            value={e.vendor}
            placeholder="e.g. Pilot Flying J, DAT, etc."
            onChange={(ev) => setE((s) => ({ ...s, vendor: ev.target.value }))}
            className="w-full h-12 px-4 rounded-xl border border-border bg-white text-base focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Note (optional)</span>
          <textarea
            value={e.note}
            onChange={(ev) =>
              setE((s) => ({ ...s, note: ev.target.value.slice(0, 500) }))
            }
            rows={2}
            placeholder="Anything that helps you (or your accountant) remember what this was."
            className="w-full p-4 rounded-xl border border-border bg-white text-base focus:outline-none focus:ring-2 focus:ring-brand resize-y"
          />
        </label>
      </section>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
          {error}
        </div>
      )}

      <div className="flex flex-col-reverse sm:flex-row gap-3 items-stretch">
        {expenseId && (
          <button
            type="button"
            onClick={remove}
            disabled={deletePending || pending}
            className="h-12 px-6 rounded-xl border border-border bg-white text-red-600 font-semibold hover:bg-red-50 hover:border-red-300 disabled:opacity-50 transition"
          >
            {deletePending ? "Deleting…" : "Delete"}
          </button>
        )}
        <Link
          href={`/tax/expenses?year=${e.expense_date.slice(0, 4)}`}
          className="h-12 px-6 rounded-xl border border-border bg-white text-foreground font-semibold flex items-center justify-center hover:bg-gray-50"
        >
          Cancel
        </Link>
        <button
          type="button"
          onClick={save}
          disabled={pending || deletePending || e.amount < 0}
          className="flex-1 h-12 px-6 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold disabled:opacity-60"
        >
          {pending ? "Saving…" : expenseId ? "Save changes" : "Save expense"}
        </button>
      </div>
    </div>
  );
}
