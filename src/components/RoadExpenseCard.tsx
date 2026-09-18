"use client";

import { useId, useState, useTransition } from "react";
import { Card, CardHeader } from "@/components/ui/Surfaces";
import { Notice } from "@/components/ui/Notice";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { AffixInput, Field, TextInput } from "@/components/ui/Field";
import { digitsAndDots } from "@/lib/numericInput";
import { formatMoney } from "@/lib/format";
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
  /** Today if today is inside this week, else the week's first day. */
  defaultDateIso: string;
}) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<RoadExpenseCategory | null>(null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(defaultDateIso);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const kindLabelId = useId();

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
    <Card className="mb-4">
      <CardHeader
        className=""
        title="Other expenses this week"
        description="Anything you bought that isn't tied to one load."
        aside={
          <div className="text-right">
            <p className="pr-figure text-xl font-semibold leading-none text-foreground">
              {formatMoney(total)}
            </p>
            <p className="text-[11px] text-muted mt-1">
              {rows.length} {rows.length === 1 ? "item" : "items"}
            </p>
          </div>
        }
      />

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
                    <span className="ml-1.5">
                      <Chip title="Counted in your weekly profit. Not sent to the tax report — the per-diem worksheet covers meals.">
                        profit only
                      </Chip>
                    </span>
                  )}
                </span>
                <span className="font-bold tabular-nums shrink-0">
                  {formatMoney(Number(r.amount))}
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
          {formatMoney(untaxed)}{" "}of this is food. It counts against your profit
          here, but it isn&apos;t sent to the tax report — your per-diem
          worksheet already covers meals.
        </p>
      )}

      {!open ? (
        <Button
          variant="secondary"
          block
          className="mt-3"
          onClick={() => setOpen(true)}
        >
          + Add an expense
        </Button>
      ) : (
        <div className="mt-3 border border-border rounded-xl p-3">
          <p id={kindLabelId} className="pr-field-label mb-2">
            What was it?
          </p>
          <div
            role="group"
            aria-labelledby={kindLabelId}
            className="flex flex-wrap gap-1.5"
          >
            {ROAD_CATEGORIES.map((c) => (
              <button
                key={c.key}
                type="button"
                aria-pressed={category === c.key}
                onClick={() => setCategory(c.key)}
                className="pr-choice"
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
            <Field label="Amount" className="flex-1">
              <AffixInput
                prefix="$"
                numeric
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(digitsAndDots(e.target.value))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                }}
                placeholder="0.00"
                autoFocus
              />
            </Field>
            <Field label="Date" className="w-36 shrink-0">
              <TextInput
                type="date"
                value={date}
                min={weekStartIso}
                max={weekEndIso}
                onChange={(e) => setDate(e.target.value)}
                className="px-2"
              />
            </Field>
          </div>

          <Field label="Note (optional)" className="mt-3">
            <TextInput
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
              placeholder="Where, or what for"
            />
          </Field>

          {error && (
            <Notice tone="error" size="sm" className="mt-2">
              {error}
            </Notice>
          )}

          <div className="mt-3 flex gap-2">
            <Button
              variant="primary"
              className="flex-1 sm:flex-none"
              onClick={submit}
              pending={pending}
            >
              {pending ? "Adding…" : "Add expense"}
            </Button>
            <Button variant="secondary" onClick={reset} disabled={pending}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Card>
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
