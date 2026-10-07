"use client";

import { useState, useTransition } from "react";
import { Card, CardHeader } from "@/components/ui/Surfaces";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { Field, TextInput } from "@/components/ui/Field";
import type { InvoiceSettings } from "@/lib/invoices";
import { saveInvoiceSettingsAction } from "../invoiceActions";

/**
 * The business an invoice is from — company only, never a person's name —
 * set once. Changing it later never rewrites invoices already issued.
 */
export function InvoiceSettingsCard({ initial, saved: savedBefore }: { initial: InvoiceSettings; saved: boolean }) {
  const [s, setS] = useState(initial);
  const [factored, setFactored] = useState(Boolean(initial.factor_name));
  const [message, setMessage] = useState<null | "ok" | string>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof InvoiceSettings) => (e: { target: { value: string } }) =>
    setS((cur) => ({ ...cur, [k]: e.target.value }));

  function save() {
    setMessage(null);
    start(async () => {
      const r = await saveInvoiceSettingsAction({
        ...s,
        factor_name: factored ? s.factor_name : "",
        factor_address: factored ? s.factor_address : "",
      });
      setMessage(r.ok ? "ok" : r.error);
    });
  }

  return (
    <Card>
      <CardHeader
        title="Invoice details"
        description="Who your invoices are from. Brokers pay the company, so that's what goes on the invoice — not your name."
      />
      {!savedBefore && (
        <Notice className="mb-4" size="sm">
          Fill this in once and every load gets a Create invoice button.
        </Notice>
      )}
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label="Company name" className="sm:col-span-2">
          <TextInput value={s.company_name} onChange={set("company_name")} required maxLength={120} />
        </Field>
        <Field label="MC number">
          <TextInput value={s.mc_number} onChange={set("mc_number")} inputMode="numeric" maxLength={20} placeholder="1041722" />
        </Field>
        <Field label="Phone">
          <TextInput value={s.phone} onChange={set("phone")} type="tel" maxLength={30} />
        </Field>
        <Field label="Street address" className="sm:col-span-2">
          <TextInput value={s.address_line} onChange={set("address_line")} maxLength={120} />
        </Field>
        <Field label="City">
          <TextInput value={s.city} onChange={set("city")} maxLength={80} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="State">
            <TextInput value={s.state} onChange={set("state")} maxLength={2} placeholder="TX" className="uppercase" />
          </Field>
          <Field label="ZIP">
            <TextInput value={s.zip} onChange={set("zip")} inputMode="numeric" maxLength={10} />
          </Field>
        </div>
        <Field label="Billing email" hint="Shown on the invoice so brokers can reach you." className="sm:col-span-2">
          <TextInput value={s.email} onChange={set("email")} type="email" maxLength={200} />
        </Field>
        <Field label="Payment terms" hint="Days the broker has to pay. 0 means on receipt.">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted">Net</span>
            <TextInput
              value={String(s.net_days)}
              onChange={set("net_days")}
              inputMode="numeric"
              maxLength={3}
              className="max-w-[6rem]"
            />
            <span className="text-sm text-muted">days</span>
          </div>
        </Field>
        <Field label="Next invoice number" hint="Starts at 1001. Change it to continue your own numbering.">
          <TextInput value={String(s.next_number)} onChange={set("next_number")} inputMode="numeric" maxLength={8} className="max-w-[10rem]" />
        </Field>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" checked={factored} onChange={(e) => setFactored(e.target.checked)} />
          I sell my invoices to a factoring company
        </label>
        {factored && (
          <>
            <Field label="Factoring company" className="sm:col-span-2">
              <TextInput value={s.factor_name} onChange={set("factor_name")} maxLength={120} />
            </Field>
            <Field label="Their remit-to address" hint="Brokers send the payment here." className="sm:col-span-2">
              <textarea
                className="pr-control min-h-[5.5rem]"
                value={s.factor_address}
                onChange={set("factor_address")}
                maxLength={300}
              />
            </Field>
          </>
        )}
        <div className="sm:col-span-2">
          {message && message !== "ok" && (
            <Notice tone="error" className="mb-3">
              {message}
            </Notice>
          )}
          <div className="flex items-center gap-3">
            <Button type="submit" variant="dark" pending={pending}>
              Save invoice details
            </Button>
            {message === "ok" && (
              <span role="status" className="text-sm font-semibold text-[var(--pr-rig-green)]">
                Saved
              </span>
            )}
          </div>
        </div>
      </form>
    </Card>
  );
}
