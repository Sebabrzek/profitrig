import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/ui/Surfaces";
import { Notice } from "@/components/ui/Notice";
import { ButtonLink } from "@/components/ui/Button";
import { loadFromRow } from "@/lib/loads";
import { draftInvoice, invoiceSettingsFromRow, loadGross } from "@/lib/invoices";
import { InvoiceForm } from "../InvoiceForm";
import { invoicingContext, UUID } from "../context";

/** A new invoice, filled in from one of the driver's loads. */
export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ load?: string }>;
}) {
  const { load: loadId } = await searchParams;
  const { supabase, user, today, account } = await invoicingContext();
  if (!loadId || !UUID.test(loadId)) notFound();

  const [{ data: loadRow }, { data: settingsRow }, { data: scanRows }, { data: existing }] = await Promise.all([
    supabase.from("loads").select("*").eq("id", loadId).eq("user_id", user.id).maybeSingle(),
    supabase.from("invoice_settings").select("*").eq("user_id", user.id).maybeSingle(),
    // The rate con it was scanned from: where the broker's load number is.
    supabase
      .from("scans")
      .select("extracted")
      .eq("user_id", user.id)
      .eq("load_id", loadId)
      .eq("status", "read")
      .order("created_at", { ascending: true })
      .limit(1),
    supabase
      .from("invoices")
      .select("id,number")
      .eq("user_id", user.id)
      .eq("load_id", loadId)
      .neq("status", "void")
      .limit(1),
  ]);
  if (!loadRow) notFound();
  const load = loadFromRow(loadRow);
  const settings = invoiceSettingsFromRow(settingsRow);

  // The billing email and address last used for this broker.
  let last: { bill_to_email: string | null; bill_to_address: string | null } | null = null;
  if (load.broker.trim()) {
    const { data } = await supabase
      .from("invoices")
      .select("bill_to_email,bill_to_address")
      .eq("user_id", user.id)
      .ilike("bill_to_name", load.broker.trim().replace(/[%_\\]/g, (c) => `\\${c}`))
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    last = data;
  }

  return (
    <AppShell width="form" account={account}>
      <PageHeader
        title="New invoice"
        action={
          <Link href={`/loads/${loadId}`} className="pr-link pr-hit text-sm">
            ← Back to the load
          </Link>
        }
      />
      {!settings ? (
        <Notice title="Add your invoice details first">
          <p>Your company name, MC number and address go at the top of every invoice. You fill them in once.</p>
          <ButtonLink href="/profile#invoice-details" variant="dark" size="sm" className="mt-3">
            Open invoice details
          </ButtonLink>
        </Notice>
      ) : (
        <>
          {existing && existing.length > 0 && (
            <Notice className="mb-4" size="sm">
              This load already has{" "}
              <Link href={`/loads/invoices/${existing[0].id}`} className="pr-link font-semibold">
                Invoice #{existing[0].number}
              </Link>
              . Make another only for something billed separately.
            </Notice>
          )}
          <InvoiceForm
            mode="new"
            loadId={loadId}
            loadGrossUsd={loadGross(load)}
            initial={draftInvoice(load, settings, {
              today,
              scanExtracted: scanRows?.[0]?.extracted ?? null,
              lastBillToEmail: last?.bill_to_email ?? null,
              lastBillToAddress: last?.bill_to_address ?? null,
            })}
          />
        </>
      )}
    </AppShell>
  );
}
