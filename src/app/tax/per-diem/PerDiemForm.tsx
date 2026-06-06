"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { savePerDiemSummaryAction } from "@/lib/tax/actions";
import { computePerDiem } from "@/lib/tax/perDiem";
import type { PerDiemRate, PerDiemSummary } from "@/lib/tax/types";

const money = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });

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
  const [text, setText] = useState(value === 0 ? "" : String(value));
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold">{label}</span>
      {hint && <span className="text-xs text-muted -mt-1">{hint}</span>}
      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          value={text}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => {
            const clean = e.target.value.replace(/[^0-9]/g, "");
            setText(clean);
            const parsed = clean === "" ? 0 : parseInt(clean, 10);
            onChange(Number.isFinite(parsed) ? parsed : 0);
          }}
          className="w-full h-12 px-4 pr-16 rounded-xl border border-border bg-white text-base font-medium focus:outline-none focus:ring-2 focus:ring-brand"
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted text-sm pointer-events-none">
          nights
        </span>
      </div>
    </label>
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
      <section className="bg-white border border-border rounded-2xl p-5">
        <h2 className="text-lg font-bold mb-1">Nights away ({taxYear})</h2>
        <p className="text-xs text-muted mb-3 leading-snug">
          A &quot;night away&quot; is any night your job requires you to sleep
          somewhere other than your tax home. Split by the IRS rate-change
          date (Oct 1) — the per-diem rate increases each fiscal year.
        </p>

        {suggestedNights.periodANights + suggestedNights.periodBNights > 0 && (
          <div className="mb-3 p-3 rounded-xl bg-gray-50 border border-border text-sm">
            <p className="font-semibold mb-1">From your logged loads</p>
            <p className="text-xs text-muted leading-snug mb-2">
              Suggested: {suggestedNights.periodANights} nights Jan 1 – Sep 30,{" "}
              {suggestedNights.periodBNights} nights Oct 1 – Dec 31 (loads with
              250+ loaded miles). Confirm and override if needed.
            </p>
            <button
              type="button"
              onClick={useSuggested}
              className="text-xs font-semibold text-brand hover:text-brand-dark"
            >
              Use suggested nights
            </button>
          </div>
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
      </section>

      <section className="bg-white border border-border rounded-2xl p-5">
        <h2 className="text-lg font-bold mb-1">Calculation</h2>
        <p className="text-xs text-muted mb-3 leading-snug">
          80% deductible per the DOT transportation-worker rule (IRC §274(n)).
        </p>
        <div className="flex flex-col gap-3 text-sm">
          {computed.periods.map((p) => (
            <div
              key={p.label}
              className="border border-border rounded-xl px-4 py-3"
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-semibold">{p.label}</p>
                <p className="font-bold">{money(p.deductible)}</p>
              </div>
              <p className="text-xs text-muted">
                {p.nights} nights × ${p.rate.toFixed(0)}/day × 80% ={" "}
                {money(p.deductible)}{" "}
                <span className="ml-1">({p.notice})</span>
              </p>
            </div>
          ))}
          <div className="border-t border-border pt-3 mt-1 flex items-baseline justify-between">
            <p className="font-semibold">Total deductible per-diem</p>
            <p className="text-xl font-black">{money(computed.totalDeductible)}</p>
          </div>
          <p className="text-[11px] text-muted">
            Schedule C line 24b — Meals (80%). CPA-confirmable.
          </p>
        </div>
      </section>

      {saved && (
        <div
          className={`text-sm rounded-xl p-3 ${
            saved === "ok"
              ? "bg-brand-soft text-brand-dark"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {saved === "ok" ? "✓ Saved" : `Error: ${saved}`}
        </div>
      )}

      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="h-12 px-6 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save per-diem worksheet"}
      </button>
    </div>
  );
}
