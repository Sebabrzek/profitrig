"use client";

import { useState, useTransition } from "react";
import { Notice } from "@/components/ui/Notice";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Card, CardHeader } from "@/components/ui/Surfaces";
import {
  createCheckoutAction,
  createPortalAction,
  switchToProPlusAction,
} from "../actions";

type Period = "monthly" | "yearly";
type Level = "pro" | "pro_plus";

export function UpgradeCard({
  hasExistingCustomer: _hasExistingCustomer,
  proPlusOnSale,
}: {
  hasExistingCustomer: boolean;
  /** Pro Plus is offered only once its Stripe price is set. */
  proPlusOnSale: boolean;
}) {
  const [level, setLevel] = useState<Level>("pro");
  const [period, setPeriod] = useState<Period>("monthly");
  // Pro Plus is monthly only.
  const plan = proPlusOnSale && level === "pro_plus" ? "pro_plus" : period;
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
    plan === "pro_plus"
      ? "$19.99 / month"
      : plan === "yearly"
        ? "$99 / year"
        : "$9.99 / month";
  const sublabel =
    plan === "yearly"
      ? "Save ~17% vs paying monthly"
      : "Cancel anytime";

  return (
    <Card as="div" className="mb-4">
      {proPlusOnSale && (
        <div className="mb-3">
          <SegmentedControl
            label="Plan"
            block
            value={level}
            onChange={setLevel}
            options={[
              { value: "pro", label: "Pro" },
              { value: "pro_plus", label: "Pro Plus" },
            ]}
          />
        </div>
      )}
      {plan === "pro_plus" ? (
        <p className="mb-5 text-sm leading-snug text-muted">
          Everything in Pro, with twice the monthly AI allowance. Billed
          monthly.
        </p>
      ) : (
        <div className="mb-5">
          <SegmentedControl
            label="Billing period"
            block
            value={period}
            onChange={setPeriod}
            options={[
              { value: "monthly", label: "Monthly" },
              {
                value: "yearly",
                label: (
                  <>
                    Yearly <span className="ml-1 font-medium">(save 17%)</span>
                  </>
                ),
              },
            ]}
          />
        </div>
      )}

      <div className="text-center mb-4">
        <p className="text-4xl font-black">{priceLabel}</p>
        <p className="text-xs text-muted mt-1">
          7-day free trial · {sublabel}
        </p>
      </div>

      <Field label="Have a code? (optional)" className="mb-4">
        <TextInput
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Enter promo code"
          autoCapitalize="characters"
          className="uppercase placeholder:normal-case placeholder:lowercase"
        />
      </Field>

      {error && (
        <Notice tone="error" className="mb-3">
          {error}
        </Notice>
      )}

      <Button variant="primary" size="lg" block onClick={go} pending={pending}>
        {pending ? "Opening checkout…" : "Start 7-Day Free Trial"}
      </Button>

      <p className="text-[11px] text-muted text-center mt-3 leading-snug">
        Card billed only after the 7-day trial. Cancel anytime. Secured by
        Stripe. We never see your card number.
      </p>
    </Card>
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
      <Button variant="dark" onClick={go} pending={pending}>
        {pending ? "Opening…" : "Manage subscription"}
      </Button>
      {error && (
        <Notice tone="error" className="mt-3">
          {error}
        </Notice>
      )}
    </div>
  );
}

/**
 * For someone already on Pro: more AI, on Stripe's own confirmation page,
 * which shows what changes and what it costs before anything does.
 */
export function ProPlusOffer() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function go() {
    setError(null);
    startTransition(async () => {
      const r = await switchToProPlusAction();
      if (!r.ok) {
        setError(r.error);
        return;
      }
      window.location.href = r.url;
    });
  }

  return (
    <Card as="div" className="mb-4">
      <CardHeader
        eyebrow="Pro Plus · $19.99 / month"
        title="Want more AI?"
        description="Everything in Pro, with twice the monthly AI allowance. Stripe shows exactly what changes, and what it costs today, before you confirm."
      />
      <Button variant="secondary" onClick={go} pending={pending}>
        {pending ? "Opening…" : "Switch to Pro Plus"}
      </Button>
      {error && (
        <Notice tone="error" className="mt-3">
          {error}
        </Notice>
      )}
    </Card>
  );
}
