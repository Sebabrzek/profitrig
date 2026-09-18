"use client";

import { useMemo, useState, useTransition } from "react";
import { Card, CardHeader } from "@/components/ui/Surfaces";
import { Notice } from "@/components/ui/Notice";
import { Button } from "@/components/ui/Button";
import { AffixInput, Field } from "@/components/ui/Field";
import { digitsOnly, fieldTextFor, wholeNumberOf } from "@/lib/numericInput";
import { formatMoney } from "@/lib/format";
import { useRouter } from "next/navigation";
import { savePerDiemSummaryAction } from "@/lib/tax/actions";
import { computePerDiem } from "@/lib/tax/perDiem";
import type { PerDiemRate, PerDiemSummary } from "@/lib/tax/types";

function NightsInput({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (n: number) => void;
}) {
  const [text, setText] = useState(fieldTextFor(value));
  return (
    <Field label={label} hint={hint}>
      <AffixInput
        suffix="nights"
        numeric
        type="text"
        inputMode="numeric"
        value={text}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          const clean = digitsOnly(e.target.value);
          setText(clean);
          onChange(wholeNumberOf(clean));
        }}
      />
    </Field>
  );
}

export function PerDiemForm({
  initial,
  rates,
  taxYear,
  suggestedNights,
}: {
  initial: PerDiemSummary;
  rates: PerDiemRate[];
  taxYear: number;
  suggestedNights: { periodANights: number; periodBNights: number };
}) {
  const router = useRouter();
  const [s, setS] = useState<PerDiemSummary>(initial);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState<null | "ok" | string>(null);

  const computed = useMemo(
    () => computePerDiem(s, rates, taxYear),
    [s, rates, taxYear]
  );

  function save() {
    setSaved(null);
    startTransition(async () => {
      const r = await savePerDiemSummaryAction(s);
      if (r.ok) {
        setSaved("ok");
        setTimeout(() => setSaved(null), 2500);
        router.refresh();
      } else {
        setSaved(r.error);
      }
    });
  }

  function useSuggested() {
    setS((p) => ({
      ...p,
      period_a_nights: suggestedNights.periodANights,
      period_b_nights: suggestedNights.periodBNights,
    }));
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader
          title={<>Nights away ({taxYear})</>}
          description={
            'A "night away" is any night your job requires you to sleep somewhere other than your tax home. Split by the IRS rate-change date (Oct 1) — the per-diem rate increases each fiscal year.'
          }
        />

        {suggestedNights.periodANights + suggestedNights.periodBNights > 0 && (
          <Notice title="From your logged loads" className="mb-3">
            <p className="text-xs text-muted leading-snug mb-2">
              Suggested: {suggestedNights.periodANights} nights Jan 1 – Sep 30,{" "}
              {suggestedNights.periodBNights} nights Oct 1 – Dec 31 (loads with
              250+ loaded miles). Confirm and override if needed.
            </p>
            <Button variant="secondary" size="sm" onClick={useSuggested}>
              Use suggested nights
            </Button>
          </Notice>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <NightsInput
            label={`Jan 1 – Sep 30, ${taxYear}`}
            hint={`Rate effective prior Oct 1`}
            value={s.period_a_nights}
            onChange={(n) => setS((p) => ({ ...p, period_a_nights: n }))}
          />
          <NightsInput
            label={`Oct 1 – Dec 31, ${taxYear}`}
            hint={`Rate effective Oct 1, ${taxYear}`}
            value={s.period_b_nights}
            onChange={(n) => setS((p) => ({ ...p, period_b_nights: n }))}
          />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Calculation"
          description="80% deductible per the DOT transportation-worker rule (IRC §274(n))."
        />
        <div className="flex flex-col text-sm">
          {computed.periods.map((p) => (
            <div
              key={p.label}
              className="border-b border-border py-3 first:pt-0"
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-semibold">{p.label}</p>
                <p className="font-bold">{formatMoney(p.deductible)}</p>
              </div>
              <p className="text-xs text-muted">
                {p.nights} nights × ${p.rate.toFixed(0)}/day × 80% ={" "}
                {formatMoney(p.deductible)}{" "}
                <span className="ml-1">({p.notice})</span>
              </p>
            </div>
          ))}
          <div className="pt-3 flex items-baseline justify-between">
            <p className="font-semibold">Total deductible per-diem</p>
            <p className="pr-figure text-xl font-semibold">
              {formatMoney(computed.totalDeductible)}
            </p>
          </div>
          <p className="mt-3 text-[11px] text-muted">
            Schedule C line 24b — Meals (80%). CPA-confirmable.
          </p>
        </div>
      </Card>

      {saved === "ok" && (
        <p role="status" className="text-sm font-semibold text-[var(--pr-rig-green)]">
          ✓ Saved
        </p>
      )}
      {saved && saved !== "ok" && (
        <Notice tone="error">{`Error: ${saved}`}</Notice>
      )}

      <Button
        variant="primary"
        className="sm:self-start"
        onClick={save}
        pending={pending}
      >
        {pending ? "Saving…" : "Save per-diem worksheet"}
      </Button>
    </div>
  );
}
