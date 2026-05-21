"use client";

import { useState, useTransition } from "react";
import { createCheckoutAction, createPortalAction } from "../actions";

type Plan = "monthly" | "yearly";

export function UpgradeCard({
  hasExistingCustomer: _hasExistingCustomer,
}: {
  hasExistingCustomer: boolean;
}) {
  const [plan, setPlan] = useState<Plan>("monthly");
  const [code, setCode] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function go() {
    setError(null);
    startTransition(async () => {
      const r = await createCheckoutAction({
        plan,
        promoCode: code.trim() || null,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      window.location.href = r.url;
    });
  }

  const priceLabel =
    plan === "yearly" ? "$99 / year" : "$9.99 / month";
  const sublabel =
    plan === "yearly"
      ? "Save ~17% vs paying monthly"
      : "Cancel anytime";

  return (
    <div className="bg-white border border-border rounded-2xl p-5 mb-4 shadow-sm">
      <div className="flex gap-2 bg-gray-100 rounded-full p-1 mb-5">
        <button
          type="button"
          onClick={() => setPlan("monthly")}
          className={`flex-1 py-2 rounded-full text-sm font-semibold transition ${
            plan === "monthly"
              ? "bg-white shadow text-foreground"
              : "text-muted"
          }`}
        >
          Monthly
        </button>
        <button
          type="button"
          onClick={() => setPlan("yearly")}
          className={`flex-1 py-2 rounded-full text-sm font-semibold transition ${
            plan === "yearly"
              ? "bg-white shadow text-foreground"
              : "text-muted"
          }`}
        >
          Yearly <span className="text-brand-dark">(save 17%)</span>
        </button>
      </div>

      <div className="text-center mb-4">
        <p className="text-4xl font-black">{priceLabel}</p>
        <p className="text-xs text-muted mt-1">
          7-day free trial · {sublabel}
        </p>
      </div>

      <div className="mb-4">
        <label className="text-xs font-semibold text-muted">
          Have a code? (optional)
        </label>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Enter promo code"
          autoCapitalize="characters"
          className="mt-1 w-full h-12 px-4 rounded-xl border border-border bg-white text-base focus:outline-none focus:ring-2 focus:ring-brand uppercase placeholder:normal-case placeholder:lowercase"
        />
      </div>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3 mb-3">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={go}
        disabled={pending}
        className="w-full h-14 rounded-2xl bg-brand hover:bg-brand-dark text-white font-bold text-base disabled:opacity-60 transition"
      >
        {pending ? "Opening checkout…" : "Start 7-Day Free Trial"}
      </button>

      <p className="text-[11px] text-muted text-center mt-3 leading-snug">
        Card billed only after the 7-day trial. Cancel anytime. Secured by
        Stripe. We never see your card number.
      </p>
    </div>
  );
}

export function ProActiveControls() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function go() {
    setError(null);
    startTransition(async () => {
      const r = await createPortalAction();
      if (!r.ok) {
        setError(r.error);
        return;
      }
      window.location.href = r.url;
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={go}
        disabled={pending}
        className="h-12 px-6 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold disabled:opacity-60 transition"
      >
        {pending ? "Opening…" : "Manage subscription"}
      </button>
      {error && (
        <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
          {error}
        </div>
      )}
    </div>
  );
}
