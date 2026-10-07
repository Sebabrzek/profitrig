"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/Surfaces";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { TextInput } from "@/components/ui/Field";
import { SCAN_MAX_BYTES } from "@/lib/scan";
import { shrinkPhoto } from "@/lib/shrinkPhoto";
import { removeInvoiceDocumentAction, setInvoiceStatusAction } from "../../invoiceActions";

/** Paid on a day, back to unpaid, or cancelled (the number is kept, never reused). */
export function InvoiceStatusControls({
  invoiceId,
  status,
  today,
}: {
  invoiceId: string;
  status: "open" | "paid" | "void";
  today: string;
}) {
  const router = useRouter();
  const [paidOn, setPaidOn] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function set(next: "open" | "paid" | "void") {
    if (next === "void" && !confirm("Cancel this invoice? It stays on record as cancelled, and its number isn't reused.")) return;
    setError(null);
    start(async () => {
      const r = await setInvoiceStatusAction(invoiceId, next, next === "paid" ? paidOn : undefined);
      if (!r.ok) setError(r.error);
      else router.refresh();
    });
  }

  return (
    <div>
      {status === "open" && (
        <div className="flex flex-wrap items-end gap-3">
          <label className="pr-field">
            <span className="pr-field-label">Paid on</span>
            <TextInput type="date" value={paidOn} max={today} onChange={(e) => setPaidOn(e.target.value)} />
          </label>
          <Button variant="dark" onClick={() => set("paid")} pending={pending}>
            Mark paid
          </Button>
          <button type="button" className="pr-link pr-hit text-sm" onClick={() => set("void")} disabled={pending}>
            Cancel invoice
          </button>
        </div>
      )}
      {status !== "open" && (
        <button type="button" className="pr-link pr-hit text-sm" onClick={() => set("open")} disabled={pending}>
          {status === "paid" ? "Mark unpaid" : "Reopen invoice"}
        </button>
      )}
      {error && (
        <Notice tone="error" className="mt-3">
          {error}
        </Notice>
      )}
    </div>
  );
}

export type PaperworkItem = { id: string; label: string; href: string; removable: boolean };

/**
 * The paperwork that goes behind the invoice in its PDF: the rate con the
 * load was scanned from, and any BOL/POD photos the driver adds. Nothing
 * attached here is read by the AI, so it costs nothing.
 */
export function PaperworkCard({ invoiceId, items }: { invoiceId: string; items: PaperworkItem[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  async function upload(file: File) {
    setError(null);
    setBusy(true);
    try {
      let body: Blob = file;
      let name = file.name || "paperwork";
      if (file.type !== "application/pdf") {
        try {
          body = await shrinkPhoto(file);
          name = "paperwork.jpg";
        } catch {
          setError("That photo couldn't be opened here. Take a new photo, or save it as a JPG first.");
          return;
        }
      }
      if (body.size > SCAN_MAX_BYTES) {
        setError("That file is over 4 MB. Take a photo instead.");
        return;
      }
      const form = new FormData();
      form.append("file", body, name);
      const res = await fetch(`/api/invoices/${invoiceId}/documents`, { method: "POST", body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "Couldn't add that file. Try again.");
        return;
      }
      router.refresh();
    } catch {
      setError("Couldn't reach ProfitRig. Check your connection and try again.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <Card>
      <CardHeader
        title="Paperwork"
        description="Goes behind the invoice in the PDF. Brokers usually want the rate con and the signed BOL or POD."
      />
      {items.length === 0 ? (
        <p className="mb-3 text-sm text-muted">Nothing attached yet.</p>
      ) : (
        <ul className="mb-4 flex flex-col gap-2 text-sm">
          {items.map((it) => (
            <li key={it.id} className="flex flex-wrap items-baseline justify-between gap-x-4">
              <span>{it.label}</span>
              <span className="flex gap-4">
                <a href={it.href} target="_blank" rel="noopener noreferrer" className="pr-link pr-hit">
                  View
                </a>
                {it.removable && (
                  <button
                    type="button"
                    className="pr-link pr-hit"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const r = await removeInvoiceDocumentAction(it.id);
                        if (!r.ok) setError(r.error);
                        else router.refresh();
                      })
                    }
                  >
                    Remove
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*,application/pdf"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
        }}
      />
      <Button variant="secondary" onClick={() => input.current?.click()} pending={busy}>
        {busy ? "Adding…" : "Add BOL or POD photo"}
      </Button>
      {error && (
        <Notice tone="error" className="mt-3">
          {error}
        </Notice>
      )}
    </Card>
  );
}
