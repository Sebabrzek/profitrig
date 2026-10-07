import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { EmptyState, PageHeader } from "@/components/ui/Surfaces";
import { Notice } from "@/components/ui/Notice";
import { Chip } from "@/components/ui/Chip";
import { StatTile } from "@/components/instruments/Instruments";
import { invoiceStanding, summarizeInvoices, type InvoiceStatus } from "@/lib/invoices";
import { invoiceDay, invoiceMoney } from "@/lib/invoicePdf";
import { invoicingContext } from "./context";

/**
 * Every invoice the driver has made: what is owed, what is late, and what
 * came in lately. Overdue first among the unpaid, then newest.
 */
export default async function InvoicesPage() {
  const { supabase, user, today, account } = await invoicingContext();
  const { data, error } = await supabase
    .from("invoices")
    .select("id,number,status,bill_to_name,total,invoice_date,due_date,paid_at,broker_load_number")
    .eq("user_id", user.id)
    .order("invoice_date", { ascending: false })
    .order("number", { ascending: false });

  const rows = (data ?? []).map((r) => ({
    id: String(r.id),
    number: Number(r.number),
    status: r.status as InvoiceStatus,
    billTo: String(r.bill_to_name),
    total: Number(r.total) || 0,
    invoice_date: String(r.invoice_date),
    due_date: String(r.due_date),
    paid_at: r.paid_at ? String(r.paid_at) : null,
    loadNumber: r.broker_load_number ? String(r.broker_load_number) : "",
  }));
  const summary = summarizeInvoices(rows, today);
  const rank = (r: (typeof rows)[number]) => {
    const s = invoiceStanding(r, today).label;
    return s === "Overdue" ? 0 : s === "Open" ? 1 : s === "Paid" ? 2 : 3;
  };
  const ordered = [...rows].sort((a, b) => rank(a) - rank(b));

  return (
    <AppShell width="standard" account={account}>
      <PageHeader
        title="Invoices"
        description="Make an invoice from any load: open the load and tap Create invoice."
        action={
          <Link href="/loads" className="pr-link pr-hit text-sm">
            ← Loads
          </Link>
        }
      />
      {error ? (
        <Notice>Invoicing isn&apos;t switched on yet.</Notice>
      ) : (
        <>
          <section className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatTile
              label="Owed to you"
              value={invoiceMoney(summary.owed)}
              context={`${summary.openCount} unpaid`}
            />
            <StatTile
              label="Overdue"
              value={invoiceMoney(summary.overdue)}
              outcome={summary.overdueCount > 0 ? "loss" : undefined}
              context={`${summary.overdueCount} invoice${summary.overdueCount === 1 ? "" : "s"}`}
            />
            <StatTile label="Paid, last 30 days" value={invoiceMoney(summary.paidLast30)} />
          </section>

          {ordered.length === 0 ? (
            <EmptyState title="No invoices yet.">
              Open a load and tap <span className="font-semibold text-foreground">Create invoice</span>.
            </EmptyState>
          ) : (
            <ul className="flex flex-col divide-y divide-border rounded-[var(--pr-radius-card)] border border-border bg-white">
              {ordered.map((r) => {
                const s = invoiceStanding(r, today);
                return (
                  <li key={r.id}>
                    <Link
                      href={`/loads/invoices/${r.id}`}
                      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 hover:bg-[var(--pr-surface-muted)]"
                    >
                      <span className="min-w-0">
                        <span className="font-semibold">#{r.number}</span> · {r.billTo}
                        <span className="block text-xs text-muted">
                          {invoiceDay(r.invoice_date)}
                          {r.loadNumber ? ` · Load # ${r.loadNumber}` : ""}
                        </span>
                      </span>
                      <span className="flex items-center gap-3">
                        <Chip tone={s.label === "Overdue" ? "loss" : "neutral"}>
                          {s.label === "Overdue"
                            ? `Overdue ${s.daysLate}d`
                            : s.label === "Open"
                              ? `${s.daysOut}d out`
                              : s.label}
                        </Chip>
                        <span className="pr-figure font-semibold">{invoiceMoney(r.total)}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </AppShell>
  );
}
