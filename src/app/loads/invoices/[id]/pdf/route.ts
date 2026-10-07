import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { renderInvoicePdf, type InvoiceDoc, type Paperwork } from "@/lib/invoicePdf";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The invoice as one PDF: the invoice page, then the rate con the load was
 * scanned from, then the BOL/POD the driver attached — the packet a broker's
 * billing desk asks for. Only the driver's own invoice (row-level security).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!UUID.test(id)) return new Response("Not found", { status: 404 });
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Not signed in", { status: 401 });

  const { data: r } = await supabase
    .from("invoices")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!r) return new Response("Not found", { status: 404 });

  // The paperwork behind the invoice: rate con first, then the BOL/POD.
  const [scansRes, docsRes] = await Promise.all([
    r.load_id
      ? supabase
          .from("scans")
          .select("storage_path,mime_type")
          .eq("user_id", user.id)
          .eq("load_id", r.load_id)
          .order("created_at", { ascending: true })
          .limit(2)
      : Promise.resolve({ data: [] as { storage_path: string; mime_type: string }[] }),
    supabase
      .from("invoice_documents")
      .select("storage_path,mime_type")
      .eq("user_id", user.id)
      .eq("invoice_id", id)
      .order("created_at", { ascending: true }),
  ]);
  const files = [...(scansRes.data ?? []), ...(docsRes.data ?? [])];
  const admin = createSupabaseAdminClient();
  const paperwork: Paperwork[] = [];
  if (admin) {
    for (const f of files) {
      const { data: blob } = await admin.storage.from("scans").download(String(f.storage_path));
      if (blob) paperwork.push({ mime: String(f.mime_type), bytes: new Uint8Array(await blob.arrayBuffer()) });
    }
  }

  const n = (v: unknown) => Number(v) || 0;
  const doc: InvoiceDoc = {
    number: Number(r.number),
    invoiceDate: String(r.invoice_date),
    dueDate: String(r.due_date),
    netDays: Number(r.net_days),
    from: {
      company: String(r.from_company ?? ""),
      mc: String(r.from_mc ?? ""),
      address: String(r.from_address ?? ""),
      phone: String(r.from_phone ?? ""),
      email: String(r.from_email ?? ""),
    },
    billTo: {
      name: String(r.bill_to_name ?? ""),
      address: String(r.bill_to_address ?? ""),
      email: String(r.bill_to_email ?? ""),
    },
    brokerLoadNumber: String(r.broker_load_number ?? ""),
    pickupDate: String(r.pickup_date ?? ""),
    origin: String(r.origin ?? ""),
    destination: String(r.destination ?? ""),
    linehaul: n(r.linehaul),
    fuelSurcharge: n(r.fuel_surcharge),
    accessorials: n(r.accessorials),
    remitTo: String(r.remit_to ?? ""),
    notes: String(r.notes ?? ""),
    status: r.status as InvoiceDoc["status"],
  };
  const { bytes } = await renderInvoicePdf(doc, paperwork);
  const who = doc.billTo.name.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Invoice-${doc.number}${who ? `-${who}` : ""}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
