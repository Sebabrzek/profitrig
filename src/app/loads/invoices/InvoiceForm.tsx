"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/Surfaces";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { Field, TextInput } from "@/components/ui/Field";
import { differenceFromLoad, invoiceTotal, type InvoiceInput } from "@/lib/invoices";
import { invoiceMoney } from "@/lib/invoicePdf";
import { createInvoiceAction, updateInvoiceAction } from "../../invoiceActions";

type Values = Record<keyof InvoiceInput, string>;

const toValues = (i: InvoiceInput): Values => ({
  bill_to_name: i.bill_to_name,
  bill_to_email: i.bill_to_email,
  bill_to_address: i.bill_to_address,
  broker_load_number: i.broker_load_number,
  invoice_date: i.invoice_date,
  net_days: String(i.net_days),
  pickup_date: i.pickup_date,
  origin: i.origin,
  destination: i.destination,
  linehaul: i.linehaul ? i.linehaul.toFixed(2) : "",
  fuel_surcharge: i.fuel_surcharge ? i.fuel_surcharge.toFixed(2) : "",
  accessorials: i.accessorials ? i.accessorials.toFixed(2) : "",
  notes: i.notes,
});

const num = (s: string) => {
  const n = Number(s.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

/**
 * A new invoice from a load, or changes to an unpaid one. The amounts start
 * as the load's pay; editing them here never changes the load, and the form
 * says when the two no longer match.
 */
export function InvoiceForm({
  mode,
  loadId,
  invoiceId,
  initial,
  loadGrossUsd,
}: {
  mode: "new" | "edit";
  loadId?: string;
  invoiceId?: string;
  initial: InvoiceInput;
  /** The load's full pay, to compare against; null when the load is gone. */
  loadGrossUsd: number | null;
}) {
  const router = useRouter();
  const [v, setV] = useState<Values>(toValues(initial));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof Values) => (e: { target: { value: string } }) =>
    setV((cur) => ({ ...cur, [k]: e.target.value }));

  const total = invoiceTotal({
    linehaul: num(v.linehaul),
    fuel_surcharge: num(v.fuel_surcharge),
    accessorials: num(v.accessorials),
  });
  const diff = loadGrossUsd == null ? 0 : differenceFromLoad(total, loadGrossUsd);

  function submit() {
    setError(null);
    start(async () => {
      if (mode === "new" && loadId) {
        const r = await createInvoiceAction(loadId, v);
        if (!r.ok) return setError(r.error);
        router.push(`/loads/invoices/${r.id}`);
      } else if (mode === "edit" && invoiceId) {
        const r = await updateInvoiceAction(invoiceId, v);
        if (!r.ok) return setError(r.error);
        router.push(`/loads/invoices/${invoiceId}`);
        router.refresh();
      }
    });
  }

  const money = (k: "linehaul" | "fuel_surcharge" | "accessorials") => (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted">$</span>
      <TextInput value={v[k]} onChange={set(k)} inputMode="decimal" maxLength={12} placeholder="0.00" />
    </div>
  );

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Card>
        <CardHeader title="Bill to" description="Who pays this load — the broker, not the shipper." />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Broker" className="sm:col-span-2">
            <TextInput value={v.bill_to_name} onChange={set("bill_to_name")} required maxLength={120} />
          </Field>
          <Field label="Billing email" hint="Where invoices go. Remembered for this broker.">
            <TextInput value={v.bill_to_email} onChange={set("bill_to_email")} type="email" maxLength={200} />
          </Field>
          <Field label="Broker's load number" hint="Brokers won't pay an invoice without it.">
            <TextInput value={v.broker_load_number} onChange={set("broker_load_number")} maxLength={60} />
          </Field>
          <Field label="Broker's address (optional)" className="sm:col-span-2">
            <textarea className="pr-control min-h-[4.5rem]" value={v.bill_to_address} onChange={set("bill_to_address")} maxLength={300} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Invoice" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Invoice date">
            <TextInput type="date" value={v.invoice_date} onChange={set("invoice_date")} required />
          </Field>
          <Field label="Payment terms" hint="0 means due on receipt.">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted">Net</span>
              <TextInput value={v.net_days} onChange={set("net_days")} inputMode="numeric" maxLength={3} className="max-w-[6rem]" />
              <span className="text-sm text-muted">days</span>
            </div>
          </Field>
          <Field label="Pickup date">
            <TextInput type="date" value={v.pickup_date} onChange={set("pickup_date")} />
          </Field>
          <div className="hidden sm:block" />
          <Field label="From">
            <TextInput value={v.origin} onChange={set("origin")} maxLength={120} />
          </Field>
          <Field label="To">
            <TextInput value={v.destination} onChange={set("destination")} maxLength={120} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Charges" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Line haul">{money("linehaul")}</Field>
          <Field label="Fuel surcharge">{money("fuel_surcharge")}</Field>
          <Field label="Other (detention, stops…)">{money("accessorials")}</Field>
        </div>
        <div className="mt-4 flex items-baseline justify-between border-t border-border pt-3">
          <span className="font-semibold">Total due</span>
          <span className="pr-figure text-xl font-bold text-[var(--pr-rig-green)]">{invoiceMoney(total)}</span>
        </div>
        {loadGrossUsd != null && diff !== 0 && (
          <p className="mt-2 text-sm text-muted">
            That&apos;s {invoiceMoney(Math.abs(diff))} {diff > 0 ? "more" : "less"} than this
            load&apos;s pay ({invoiceMoney(loadGrossUsd)}). The load stays as it is — change it on
            the load if the pay was wrong.
          </p>
        )}
        <Field label="Notes (optional)" className="mt-4">
          <textarea className="pr-control min-h-[4rem]" value={v.notes} onChange={set("notes")} maxLength={500} />
        </Field>
      </Card>

      {error && <Notice tone="error">{error}</Notice>}
      <div>
        <Button type="submit" variant="primary" size="lg" pending={pending}>
          {mode === "new" ? "Create invoice" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
