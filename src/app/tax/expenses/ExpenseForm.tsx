"use client";

import { Card } from "@/components/ui/Surfaces";
import { Notice } from "@/components/ui/Notice";
import { Button, ButtonLink } from "@/components/ui/Button";
import {
  Field,
  NumberField,
  SelectInput,
  TextArea,
  TextInput,
} from "@/components/ui/Field";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { CATEGORIES, categoryMeta } from "@/lib/tax/categories";
import {
  deleteExpenseAction,
  upsertExpenseAction,
} from "@/lib/tax/actions";
import type { Expense, ExpenseCategory } from "@/lib/tax/types";

export function ExpenseForm({
  initial,
  expenseId,
}: {
  initial: Expense;
  expenseId?: string;
}) {
  const router = useRouter();
  const [e, setE] = useState<Expense>({ ...initial, id: expenseId });
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
      <Card className="flex flex-col gap-4">
        <Field label="Date">
          <TextInput
            type="date"
            value={e.expense_date}
            onChange={(ev) =>
              setE((s) => ({ ...s, expense_date: ev.target.value }))
            }
          />
        </Field>

        <Field label="Category">
          <SelectInput
            value={e.category}
            onChange={(ev) =>
              setE((s) => ({
                ...s,
                category: ev.target.value as ExpenseCategory,
              }))
            }
          >
            {CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </SelectInput>
          <p className="text-xs text-muted leading-snug">
            Suggested: {meta.scheduleC} ·{" "}
            <span className="italic">CPA-confirmable</span>
          </p>
          {meta.hint && (
            <p className="text-xs text-[var(--pr-text)] mt-1 leading-snug">
              {meta.hint}
            </p>
          )}
        </Field>

        <Field label="Amount">
          <NumberField
            prefix="$"
            value={e.amount}
            onChange={(amount) => setE((s) => ({ ...s, amount }))}
          />
        </Field>

        <Field label="Vendor (optional)">
          <TextInput
            type="text"
            value={e.vendor}
            placeholder="e.g. Pilot Flying J, DAT, etc."
            onChange={(ev) => setE((s) => ({ ...s, vendor: ev.target.value }))}
          />
        </Field>

        <Field label="Note (optional)">
          <TextArea
            value={e.note}
            onChange={(ev) =>
              setE((s) => ({ ...s, note: ev.target.value.slice(0, 500) }))
            }
            rows={2}
            placeholder="Anything that helps you (or your accountant) remember what this was."
          />
        </Field>
      </Card>

      {error && (
        <Notice tone="error">{error}</Notice>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
        {expenseId && (
          <Button
            variant="destructive"
            className="sm:mr-auto"
            onClick={remove}
            pending={deletePending}
            disabled={pending}
          >
            {deletePending ? "Deleting…" : "Delete"}
          </Button>
        )}
        <ButtonLink
          href={`/tax/expenses?year=${e.expense_date.slice(0, 4)}`}
          variant="secondary"
        >
          Cancel
        </ButtonLink>
        <Button
          variant="primary"
          className="sm:min-w-44"
          onClick={save}
          pending={pending}
          disabled={deletePending || e.amount < 0}
        >
          {pending ? "Saving…" : expenseId ? "Save changes" : "Save expense"}
        </Button>
      </div>
    </div>
  );
}
