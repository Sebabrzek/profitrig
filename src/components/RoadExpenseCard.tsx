"use client";

import { useState, useTransition } from "react";
import {
  ROAD_CATEGORIES,
  roadCategoryMeta,
  sumRoadExpenses,
  sumUntaxedRoadExpenses,
  type RoadExpense,
  type RoadExpenseCategory,
} from "@/lib/roadExpenses";
import {
  addRoadExpenseAction,
  deleteRoadExpenseAction,
} from "@/app/actions";

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

function shortDate(iso: string) {
  const [, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}`;
}

export function RoadExpenseCard({
  rows,
  weekStartIso,
  weekEndIso,
  defaultDateIso,
}: {
  rows: RoadExpense[];
  weekStartIso: string;
  weekEndIso: string;
  /** Today if today is inside this week, else the week's Monday. */
  defaultDateIso: string;
}) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<RoadExpenseCategory | null>(null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(defaultDateIso);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const total = sumRoadExpenses(rows);
  const untaxed = sumUntaxedRoadExpenses(rows);

  function reset() {
    setCategory(null);
    setAmount("");
    setNote("");
    setDate(defaultDateIso);
    setError("");
    setOpen(false);
  }

  function submit() {
    if (!category) {
      setError("Pick what it was.");
      return;
    }
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter an amount.");
      return;
    }
    setError("");
    startTransition(async () => {
      const res = await addRoadExpenseAction({
        spent_on: date,
        category,
        amount: value,
        note,
      });
      if (res.ok) reset();
      else setError(res.error);
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      await deleteRoadExpenseAction(id);
    });
  }

  return (
    <section className="bg-white border border-border rounded-2xl p-4 mb-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold leading-tight">
            Other expenses this week
          </h2>
          <p className="text-xs text-muted mt-0.5 leading-snug">
            Anything you bought that isn&apos;t tied to one load.
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xl font-black leading-none text-foreground">
            {money(total)}
          </p>
          <p className="text-[11px] text-muted mt-0.5">
            {rows.length} {rows.length === 1 ? "item" : "items"}
          </p>
        </div>
      </div>

      {rows.length > 0 && (
        <ul className="mt-3 divide-y divide-border border-y border-border">
          {rows.map((r) => {
            const meta = roadCategoryMeta(r.category);
            return (
              <li
                key={r.id}
                className="flex items-center gap-3 py-2 text-sm"
              >
                <span className="text-muted text-xs w-10 shrink-0 tabular-nums">
                  {shortDate(r.spent_on)}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="font-semibold">{meta.label}</span>
                  {r.note && (
                    <span className="text-muted"> — {r.note}</span>
                  )}
                  {meta.taxCategory == null && (
                    <span
                      className="ml-1.5 text-[9px] uppercase tracking-wider bg-gray-100 text-muted px-1.5 py-0.5 rounded-full font-bold whitespace-nowrap"
                      title="Counted in your weekly profit. Not sent to the tax report — the per-diem worksheet covers meals."
                    >
                      profit only
                    </span>
                  )}
                </span>
                <span className="font-bold tabular-nums shrink-0">
                  {money(Number(r.amount))}
                </span>
                <button
                  type="button"
                  onClick={() => r.id && remove(r.id)}
                  disabled={pending}
                  aria-label="Delete expense"
                  className="text-muted hover:text-red-600 disabled:opacity-40 shrink-0 p-1"
                >
                  <TrashIcon />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {untaxed > 0 && (
        <p className="text-[11px] text-muted mt-2 leading-snug">
          {money(untaxed)} of this is food. It counts against your profit
          here, but it isn&apos;t sent to the tax report — your per-diem
          worksheet already covers meals.
        </p>
      )}

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 w-full h-12 rounded-xl border-2 border-dashed border-border hover:border-brand hover:text-brand-dark font-bold text-sm text-muted transition"
        >
          + Add an expense
        </button>
      ) : (
        <div className="mt-3 border border-border rounded-xl p-3">
          <p className="text-xs font-bold uppercase tracking-wider text-muted mb-2">
            What was it?
          </p>
          <div className="flex flex-wrap gap-1.5">
            {ROAD_CATEGORIES.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setCategory(c.key)}
                className={`px-3 py-2 rounded-xl text-sm font-semibold border transition ${
                  category === c.key
                    ? "bg-brand text-white border-brand"
                    : "bg-white text-foreground border-border hover:border-brand"
                }`}
              >
                {c.chip}
              </button>
            ))}
          </div>

          {category && roadCategoryMeta(category).hint && (
            <p className="text-[11px] text-muted mt-2 leading-snug">
              {roadCategoryMeta(category).hint}
            </p>
          )}

          <div className="mt-3 flex gap-2">
            <div className="flex-1">
              <label className="text-xs font-semibold block mb-1">
                Amount
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">
                  $
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) =>
                    setAmount(e.target.value.replace(/[^0-9.]/g, ""))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submit();
                  }}
                  placeholder="0.00"
                  autoFocus
                  className="w-full h-12 pl-7 pr-3 rounded-xl border border-border text-base font-semibold focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </div>
            </div>
            <div className="w-36">
              <label className="text-xs font-semibold block mb-1">Date</label>
              <input
                type="date"
                value={date}
                min={weekStartIso}
                max={weekEndIso}
                onChange={(e) => setDate(e.target.value)}
                className="w-full h-12 px-2 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
          </div>

          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder="Note (optional) — where, or what for"
            className="mt-2 w-full h-11 px-3 rounded-xl border border-border text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          />

          {error && (
            <p className="text-xs text-red-600 mt-2 font-semibold">{error}</p>
          )}

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={pending}
              className="flex-1 h-12 rounded-xl bg-brand hover:bg-brand-dark disabled:opacity-60 text-white font-bold transition"
            >
              {pending ? "Adding…" : "Add expense"}
            </button>
            <button
              type="button"
              onClick={reset}
              disabled={pending}
              className="h-12 px-4 rounded-xl border border-border text-sm font-semibold text-muted hover:text-foreground transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function TrashIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
