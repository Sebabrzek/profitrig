import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { Card, CardHeader, PageHeader } from "@/components/ui/Surfaces";
import { Notice } from "@/components/ui/Notice";
import { Chip } from "@/components/ui/Chip";
import { ButtonLink, buttonClass } from "@/components/ui/Button";
import { loadFromRow } from "@/lib/loads";
import { differenceFromLoad, invoiceStanding, loadGross } from "@/lib/invoices";
import { invoiceDay, invoiceLines, invoiceMoney } from "@/lib/invoicePdf";
import { SCAN_DOCUMENT_LABEL, type ScanDocumentType } from "@/lib/scan";
import { InvoiceStatusControls, PaperworkCard, type PaperworkItem } from "../InvoiceControls";
import { invoicingContext, UUID } from "../context";

/** One invoice: what it says, where it stands, its paperwork, and the PDF. */
export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user, today, account } = await invoicingContext();
  if (!UUID.test(id)) notFound();

  const { data: r } = await supabase.from("invoices").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!r) notFound();
  const [loadRes, scansRes, docsRes] = await Promise.all([
    r.load_id
      ? supabase.from("loads").select("*").eq("id", r.load_id).eq("user_id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    r.load_id
      ? supabase
          .from("scans")
          .select("id,document_type")
          .eq("user_id", user.id)
          .eq("load_id", r.load_id)
          .order("created_at", { ascending: true })
          .limit(2)
      : Promise.resolve({ data: [] as { id: string; document_type: string | null }[] }),
    supabase
      .from("invoice_documents")
      .select("id,mime_type,created_at")
      .eq("user_id", user.id)
      .eq("invoice_id", id)
      .order("created_at", { ascending: true }),
  ]);

  const n = (v: unknown) => Number(v) || 0;
  const total = n(r.total);
  const load = loadRes.data ? loadFromRow(loadRes.data) : null;
  const diff = load ? differenceFromLoad(total, loadGross(load)) : 0;
  const standing = invoiceStanding(
    { status: r.status, invoice_date: String(r.invoice_date), due_date: String(r.due_date) },
    today
  );
  const items: PaperworkItem[] = [
    ...(scansRes.data ?? []).map((s) => ({
      id: String(s.id),
      label: `The ${SCAN_DOCUMENT_LABEL[(s.document_type ?? "other") as ScanDocumentType] ?? "document"} this load was scanned from`,
      href: `/api/scan/${s.id}/file`,
      removable: false,
    })),
    ...(docsRes.data ?? []).map((d, i) => ({
      id: String(d.id),
      label: `BOL / POD ${i + 1}${d.mime_type === "image/webp" ? " (WebP — not added to the PDF)" : ""}`,
      href: `/api/invoices/documents/${d.id}/file`,
      removable: true,
    })),
  ];

  return (
    <AppShell width="form" account={account}>
      <PageHeader
        eyebrow={String(r.bill_to_name)}
        title={`Invoice #${r.number}`}
        action={
          <Link href="/loads/invoices" className="pr-link pr-hit text-sm">
            ← All invoices
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Chip tone={standing.label === "Overdue" ? "loss" : "neutral"}>
          {standing.label === "Overdue"
            ? `Overdue ${standing.daysLate} day${standing.daysLate === 1 ? "" : "s"}`
            : standing.label === "Open"
              ? `Open · ${standing.daysOut} day${standing.daysOut === 1 ? "" : "s"} out`
              : standing.label === "Paid"
                ? `Paid ${invoiceDay(String(r.paid_at))}`
                : "Cancelled"}
        </Chip>
        <a href={`/loads/invoices/${id}/pdf`} className={buttonClass({ variant: "primary", size: "sm" })}>
          Download PDF
        </a>
        {r.status === "open" && (
          <ButtonLink href={`/loads/invoices/${id}/edit`} variant="secondary" size="sm">
            Edit
          </ButtonLink>
        )}
      </div>

      {load && diff !== 0 && (
        <Notice className="mb-4" size="sm">
          This invoice is {invoiceMoney(Math.abs(diff))} {diff > 0 ? "more" : "less"} than the
          load&apos;s pay ({invoiceMoney(loadGross(load))}). Your Loads and Tax numbers use the
          load —{" "}
          <Link href={`/loads/${load.id}`} className="pr-link">
            change it there
          </Link>{" "}
          if the pay was wrong.
        </Notice>
      )}

      <Card className="mb-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="pr-record-label mb-1">Bill to</p>
            <p className="font-semibold">{String(r.bill_to_name)}</p>
            {r.bill_to_address && <p className="whitespace-pre-line text-sm">{String(r.bill_to_address)}</p>}
            {r.bill_to_email && <p className="text-sm text-muted">{String(r.bill_to_email)}</p>}
          </div>
          <div className="text-sm sm:text-right">
            <p>Invoice date {invoiceDay(String(r.invoice_date))}</p>
            <p>
              Due {invoiceDay(String(r.due_date))} ({Number(r.net_days) > 0 ? `Net ${r.net_days}` : "on receipt"})
            </p>
            {r.broker_load_number ? <p>Load # {String(r.broker_load_number)}</p> : <p className="text-[var(--pr-loss-deep)]">No broker load # — brokers need it</p>}
          </div>
        </div>
        <ul className="mt-4 flex flex-col border-t border-border">
          {invoiceLines({
            linehaul: n(r.linehaul),
            fuelSurcharge: n(r.fuel_surcharge),
            accessorials: n(r.accessorials),
            origin: String(r.origin ?? ""),
            destination: String(r.destination ?? ""),
          }).map((l) => (
            <li key={l.label} className="flex justify-between gap-4 border-b border-border py-2 text-sm">
              <span>{l.label}</span>
              <span className="pr-figure">{invoiceMoney(l.amount)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-baseline justify-between">
          <span className="font-semibold">Total due</span>
          <span className="pr-figure text-xl font-bold text-[var(--pr-rig-green)]">{invoiceMoney(total)}</span>
        </div>
        <div className="mt-4 grid gap-4 border-t border-border pt-3 text-sm sm:grid-cols-2">
          <div>
            <p className="pr-record-label mb-1">From</p>
            <p className="font-semibold">{String(r.from_company)}</p>
            {r.from_mc && <p>MC {String(r.from_mc)}</p>}
            {r.from_address && <p className="whitespace-pre-line">{String(r.from_address)}</p>}
          </div>
          <div>
            <p className="pr-record-label mb-1">Remit payment to</p>
            <p className="whitespace-pre-line">{String(r.remit_to)}</p>
          </div>
        </div>
        {r.notes && <p className="mt-3 whitespace-pre-line text-sm text-muted">{String(r.notes)}</p>}
      </Card>

      <Card className="mb-4">
        <CardHeader title="Payment" className="mb-3" />
        <InvoiceStatusControls invoiceId={id} status={r.status} today={today} />
      </Card>

      <PaperworkCard invoiceId={id} items={items} />
    </AppShell>
  );
}
