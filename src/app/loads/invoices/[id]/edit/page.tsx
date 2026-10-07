import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/ui/Surfaces";
import { loadFromRow } from "@/lib/loads";
import { loadGross, type InvoiceInput } from "@/lib/invoices";
import { InvoiceForm } from "../../InvoiceForm";
import { invoicingContext, UUID } from "../../context";

/** Change an unpaid invoice. Its number and business details stay as issued. */
export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user, account } = await invoicingContext();
  if (!UUID.test(id)) notFound();
  const { data: r } = await supabase.from("invoices").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!r) notFound();
  if (r.status !== "open") redirect(`/loads/invoices/${id}`);
  const { data: loadRow } = r.load_id
    ? await supabase.from("loads").select("*").eq("id", r.load_id).eq("user_id", user.id).maybeSingle()
    : { data: null };

  const n = (v: unknown) => Number(v) || 0;
  const initial: InvoiceInput = {
    bill_to_name: String(r.bill_to_name ?? ""),
    bill_to_email: String(r.bill_to_email ?? ""),
    bill_to_address: String(r.bill_to_address ?? ""),
    broker_load_number: String(r.broker_load_number ?? ""),
    invoice_date: String(r.invoice_date),
    net_days: Number(r.net_days),
    pickup_date: String(r.pickup_date ?? ""),
    origin: String(r.origin ?? ""),
    destination: String(r.destination ?? ""),
    linehaul: n(r.linehaul),
    fuel_surcharge: n(r.fuel_surcharge),
    accessorials: n(r.accessorials),
    notes: String(r.notes ?? ""),
  };

  return (
    <AppShell width="form" account={account}>
      <PageHeader
        title={`Edit invoice #${r.number}`}
        action={
          <Link href={`/loads/invoices/${id}`} className="pr-link pr-hit text-sm">
            ← Back
          </Link>
        }
      />
      <InvoiceForm
        mode="edit"
        invoiceId={id}
        initial={initial}
        loadGrossUsd={loadRow ? loadGross(loadFromRow(loadRow)) : null}
      />
    </AppShell>
  );
}
