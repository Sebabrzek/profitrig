import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/ui/Surfaces";
import { SCAN_DOCUMENT_LABEL, type ScanDocumentType } from "@/lib/scan";
import { canInvoice, invoiceStanding } from "@/lib/invoices";
import { invoiceMoney } from "@/lib/invoicePdf";
import { driverToday } from "@/lib/driverClock";
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { fetchSubscription, isPro } from "@/lib/subscription";
import { type CostProfile } from "@/app/actions";
import {
  endOfMonth,
  isoDate,
  loadFromRow,
  startOfMonth,
  type Load,
} from "@/lib/loads";
import { fetchDriverSettings } from "@/lib/driverSettings";
import { LoadForm, type PartialOf } from "../LoadForm";
import { MAX_PARTIALS, tripLabel } from "@/lib/partials";

const EMPTY_PROFILE: CostProfile = {
  truck_payment: 0,
  trailer_payment: 0,
  insurance: 0,
  eld_subscriptions: 0,
  permits_irp_ifta: 0,
  office_misc: 0,
  load_board_per_month: 0,
  other_monthly_bill: 0,
  other_label: "",
  monthly_miles: 0,
  mpg: 0,
  fuel_price_per_gallon: 0,
  maintenance_per_mile: 0,
  tires_per_mile: 0,
  def_per_mile: 0,
  driver_pay_per_mile: 0,
  tolls_misc_per_mile: 0,
  desired_profit_per_mile: 0,
  real_cpm_override: null,
};

export default async function EditLoadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const sub = await fetchSubscription(supabase, user.id);
  if (!isPro(sub)) redirect("/upgrade");

  const [loadRes, costRes, settings, scansRes, invoicesRes, { iso: today }] = await Promise.all([
    supabase
      .from("loads")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("cost_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle(),
    fetchDriverSettings(supabase, user.id),
    // The documents this load was scanned from. Empty before migration 020.
    supabase
      .from("scans")
      .select("id,document_type,created_at")
      .eq("load_id", id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true }),
    // Its invoice, if it has one. Empty before migration 022.
    supabase
      .from("invoices")
      .select("id,number,status,total,invoice_date,due_date")
      .eq("load_id", id)
      .eq("user_id", user.id)
      .neq("status", "void")
      .order("created_at", { ascending: false })
      .limit(1),
    driverToday(),
  ]);

  if (!loadRes.data) notFound();
  const scans = (scansRes.data ?? []) as { id: string; document_type: string | null }[];
  const invoice = invoicesRes.error ? null : (invoicesRes.data ?? [])[0] ?? null;
  const showInvoicing = !invoicesRes.error && canInvoice(settings.authorityType);
  const r = loadRes.data;

  // Other loads logged in this load's same calendar month, excluding this
  // load itself — used to compute MTD-based fixed-cost allocation live.
  const loadDateObj = new Date(r.load_date + "T12:00:00");
  const monthFrom = startOfMonth(loadDateObj);
  const monthTo = endOfMonth(loadDateObj);
  const { data: monthLoadsData } = await supabase
    .from("loads")
    .select("id,load_date,loaded_miles,deadhead_miles")
    .eq("user_id", user.id)
    .gte("load_date", isoDate(monthFrom))
    .lte("load_date", isoDate(monthTo));
  const otherMonthMiles = (monthLoadsData ?? [])
    .filter((row) => row.id !== id)
    .reduce(
      (acc: number, row) =>
        acc +
        (Number(row.loaded_miles) || 0) +
        (Number(row.deadhead_miles) || 0),
      0
    );
  // Earliest day this driver logged anything in the load's month — the start
  // of the run-rate window.
  const monthFirstDay = (monthLoadsData ?? []).reduce(
    (min: number, row) =>
      Math.min(min, Number(String(row.load_date).slice(8, 10)) || 31),
    31
  );

  const initial: Load = loadFromRow(r);

  // Migration 017 adds parent_load_id to every row; until it runs there is
  // no such key, and partials do not exist yet.
  const partialsReady = "parent_load_id" in r;
  const dateLabelOf = (iso: string) =>
    new Date(iso + "T12:00:00").toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

  // A partial is edited as one, and names the load it rides with.
  let partialOf: PartialOf | undefined;
  if (initial.parent_load_id) {
    const { data: primary } = await supabase
      .from("loads")
      .select("id,load_date,broker,origin,destination,loaded_miles,deadhead_miles")
      .eq("id", initial.parent_load_id)
      .eq("user_id", user.id)
      .maybeSingle();
    partialOf = {
      id: initial.parent_load_id,
      label: primary
        ? tripLabel({
            broker: primary.broker ?? "",
            origin: primary.origin ?? "",
            destination: primary.destination ?? "",
          })
        : "the load it rides with",
      dateLabel: dateLabelOf(primary?.load_date ?? initial.load_date),
      miles: primary
        ? (Number(primary.loaded_miles) || 0) + (Number(primary.deadhead_miles) || 0)
        : undefined,
    };
  }

  // A primary shows its trip, its partials, and the way to add one.
  let trip: { partials: Load[]; canAdd: boolean } | undefined;
  if (partialsReady && !partialOf) {
    const { data: partialRows } = await supabase
      .from("loads")
      .select("*")
      .eq("user_id", user.id)
      .eq("parent_load_id", id)
      .order("created_at", { ascending: true });
    const partials = (partialRows ?? []).map((row) => loadFromRow(row));
    trip = { partials, canAdd: partials.length < MAX_PARTIALS };
  }

  const costData = costRes.data;
  const profile: CostProfile = costData
    ? {
        truck_payment: Number(costData.truck_payment) || 0,
        trailer_payment: Number(costData.trailer_payment) || 0,
        insurance: Number(costData.insurance) || 0,
        eld_subscriptions: Number(costData.eld_subscriptions) || 0,
        permits_irp_ifta: Number(costData.permits_irp_ifta) || 0,
        office_misc: Number(costData.office_misc) || 0,
        load_board_per_month: Number(costData.load_board_per_month) || 0,
        other_monthly_bill: Number(costData.other_monthly_bill) || 0,
        other_label: costData.other_label ?? "",
        monthly_miles: Number(costData.monthly_miles) || 0,
        mpg: Number(costData.mpg) || 0,
        fuel_price_per_gallon: Number(costData.fuel_price_per_gallon) || 0,
        maintenance_per_mile: Number(costData.maintenance_per_mile) || 0,
        tires_per_mile: Number(costData.tires_per_mile) || 0,
        def_per_mile: Number(costData.def_per_mile) || 0,
        driver_pay_per_mile: Number(costData.driver_pay_per_mile) || 0,
        tolls_misc_per_mile: Number(costData.tolls_misc_per_mile) || 0,
        desired_profit_per_mile:
          Number(costData.desired_profit_per_mile) || 0,
        real_cpm_override:
          costData.real_cpm_override == null
            ? null
            : Number(costData.real_cpm_override),
      }
    : EMPTY_PROFILE;

  return (
    <AppShell
      width="standard"
      account={{
        email: user.email ?? "",
        isPro: true,
        isAdmin: isAdminEmail(user.email),
      }}
    >
        <PageHeader
          title={partialOf ? "Edit Partial" : "Edit Load"}
          action={
            <Link
              href={partialOf ? `/loads/${partialOf.id}` : "/loads"}
              className="pr-link pr-hit text-sm"
            >
              ← Back
            </Link>
          }
        />
        {showInvoicing && (
          <p className="mb-3 text-sm">
            {invoice ? (
              <>
                <Link href={`/loads/invoices/${invoice.id}`} className="pr-link font-semibold">
                  Invoice #{invoice.number}
                </Link>{" "}
                · {invoiceMoney(Number(invoice.total))} ·{" "}
                {(() => {
                  const st = invoiceStanding(
                    { status: invoice.status, invoice_date: String(invoice.invoice_date), due_date: String(invoice.due_date) },
                    today
                  );
                  return st.label === "Paid"
                    ? "Paid"
                    : st.label === "Overdue"
                      ? `Overdue ${st.daysLate} day${st.daysLate === 1 ? "" : "s"}`
                      : `Open, ${st.daysOut} day${st.daysOut === 1 ? "" : "s"} out`;
                })()}
              </>
            ) : (
              <Link href={`/loads/invoices/new?load=${id}`} className="pr-link font-semibold">
                Create invoice
              </Link>
            )}
          </p>
        )}
        {scans.length > 0 && (
          <p className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {scans.map((sc, i) => (
              <a
                key={sc.id}
                href={`/api/scan/${sc.id}/file`}
                target="_blank"
                rel="noopener noreferrer"
                className="pr-link font-semibold"
              >
                View the original{" "}
                {SCAN_DOCUMENT_LABEL[(sc.document_type ?? "other") as ScanDocumentType] ??
                  "document"}
                {scans.length > 1 ? ` ${i + 1}` : ""}
              </a>
            ))}
          </p>
        )}
        <LoadForm
          initial={initial}
          costProfile={profile}
          loadId={id}
          otherMonthMiles={otherMonthMiles}
          monthFirstDay={monthFirstDay}
          leased={settings.carrierPct != null}
          partialOf={partialOf}
          trip={trip}
        />
    </AppShell>
  );
}
