import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { EmptyState, PageHeader, SectionHeading } from "@/components/ui/Surfaces";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { fetchSubscription, isPro } from "@/lib/subscription";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fetchAiBudget } from "@/lib/aiBudget";
import type { AiBudgetStatus } from "@/lib/aiGuard";
import { proPlusOnSale } from "@/lib/stripe/server";
import { AiAllowanceCard } from "./AiAllowanceCard";
import { EmailInCard, type EmailInLogRow } from "./EmailInCard";
import { aiTier } from "@/lib/aiGuard";
import { scanLimitsForTier } from "@/lib/scan";
import { addressFor, freshGmailCode } from "@/lib/emailIn";
import { InvoiceSettingsCard } from "./InvoiceSettingsCard";
import { EmailPreferencesCard } from "./EmailPreferencesCard";
import { wantsUpdates } from "@/lib/messages";
import {
  EMPTY_INVOICE_SETTINGS,
  canInvoice,
  invoiceSettingsFromRow,
  type InvoiceSettings,
} from "@/lib/invoices";
import { EMPTY_DRIVER_PROFILE, type DriverProfile } from "@/lib/profile";
import { ProfileForm, type PastLoadsWithoutSplit } from "./ProfileForm";
import { FeedbackCard } from "./FeedbackCard";
import { HistoryList, type Snapshot } from "./HistoryList";

export default async function ProfilePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let initial: DriverProfile = EMPTY_DRIVER_PROFILE;
  let email = "";
  let userIsPro = false;
  let pastLoads: PastLoadsWithoutSplit = { count: 0, from: null, to: null };
  let snapshots: Snapshot[] = [];
  let aiStatus: AiBudgetStatus | null = null;
  let emailIn: {
    address: string | null;
    canUse: boolean;
    gmail: { code: string; from: string | null } | null;
    log: EmailInLogRow[];
  } | null = null;
  let invoiceSettings: { initial: InvoiceSettings; saved: boolean } | null = null;
  let emailPrefs: { productUpdates: boolean; unsubscribed: boolean } | null = null;
  if (user) {
    email = user.email ?? "";
    const sub = await fetchSubscription(supabase, user.id);
    userIsPro = isPro(sub);
    // Drivers cannot read ai_usage themselves; the server reads their own
    // rows for them. No meter if that is not possible.
    const admin = createSupabaseAdminClient();
    aiStatus = admin ? await fetchAiBudget(admin, user.id, sub, new Date()) : null;

    // Email-in: their address and what arrived. Both tables are theirs to
    // read; before migration 021 they are missing and the card stays away.
    const [addressRes, logRes] = await Promise.all([
      supabase.from("email_in_addresses").select("local_part").eq("user_id", user.id).maybeSingle(),
      supabase
        .from("email_in_messages")
        .select("id,received_at,from_email,from_name,subject,detail,outcome,gmail_code,gmail_from")
        .eq("user_id", user.id)
        .order("received_at", { ascending: false })
        .limit(10),
    ]);
    if (!addressRes.error && !logRes.error) {
      const rows = logRes.data ?? [];
      emailIn = {
        address: addressRes.data ? addressFor(String(addressRes.data.local_part)) : null,
        canUse: scanLimitsForTier(aiTier(sub, userIsPro)) !== null,
        gmail: freshGmailCode(rows, new Date()),
        log: rows.map((m) => ({
          id: String(m.id),
          when: new Date(String(m.received_at)).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          }),
          from: String(m.from_name || m.from_email || ""),
          subject: String(m.subject ?? ""),
          detail: String(m.detail ?? ""),
        })),
      };
    }
    const { data } = await supabase
      .from("driver_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) {
      initial = {
        first_name: data.first_name ?? "",
        last_name: data.last_name ?? "",
        phone: data.phone ?? "",
        company_name: data.company_name ?? "",
        domicile_city: data.domicile_city ?? "",
        domicile_state: data.domicile_state ?? "",
        carrier_name: data.carrier_name ?? "",
        authority_type: data.authority_type ?? "",
        trailer_type: data.trailer_type ?? "",
        marketing_opt_in: Boolean(data.marketing_opt_in),
        carrier_pct: data.carrier_pct == null ? null : Number(data.carrier_pct),
      };
    }

    // Loads logged before the driver set a carrier %. Profile asks once what
    // to do with them. Any error — such as before migration 013 — just means
    // there is nothing to ask about.
    const unsplit = () =>
      supabase
        .from("loads")
        .select("load_date", { count: "exact" })
        .eq("user_id", user.id)
        .is("carrier_pct", null);
    const [first, last, snapRes] = await Promise.all([
      unsplit().order("load_date", { ascending: true }).limit(1),
      unsplit().order("load_date", { ascending: false }).limit(1),
      // Every column, so snapshots still list before migration 014 adds
      // the carrier columns.
      supabase
        .from("cost_profile_snapshots")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
    ]);
    snapshots = (snapRes.data ?? []).map((s) => ({
      id: s.id,
      label: s.label ?? null,
      total_cpm: Number(s.total_cpm) || 0,
      required_rate: Number(s.required_rate) || 0,
      monthly_miles: Number(s.monthly_miles) || 0,
      desired_profit_per_mile: Number(s.desired_profit_per_mile) || 0,
      created_at: s.created_at,
      carrier_name: s.carrier_name ?? null,
      carrier_pct: s.carrier_pct == null ? null : Number(s.carrier_pct),
    }));
    if (!first.error && !last.error) {
      pastLoads = {
        count: first.count ?? 0,
        from: first.data?.[0]?.load_date ?? null,
        to: last.data?.[0]?.load_date ?? null,
      };
    }
  }

  // Their email switch. Missing before migration 023, and then the card
  // stays away.
  if (user) {
    const { data: pref, error } = await supabase
      .from("email_preferences")
      .select("product_updates,unsubscribed_at")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!error) {
      emailPrefs = {
        productUpdates: wantsUpdates({
          pro: userIsPro,
          marketingOptIn: initial.marketing_opt_in,
          productUpdates: typeof pref?.product_updates === "boolean" ? pref.product_updates : null,
        }),
        unsubscribed: Boolean(pref?.unsubscribed_at),
      };
    }
  }

  // Invoice details: for Pro drivers who aren't leased. Missing before
  // migration 022, and then the card stays away.
  if (user && userIsPro && canInvoice(initial.authority_type)) {
    const { data: row, error } = await supabase
      .from("invoice_settings")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!error) {
      const saved = invoiceSettingsFromRow(row);
      invoiceSettings = {
        saved: Boolean(saved),
        // A first visit starts from what the driver already told us.
        initial: saved ?? {
          ...EMPTY_INVOICE_SETTINGS,
          company_name: initial.company_name,
          phone: initial.phone,
          city: initial.domicile_city,
          state: initial.domicile_state,
          email,
        },
      };
    }
  }

  return (
    <AppShell
      width="form"
      account={{
        email: email,
        isPro: userIsPro,
        isAdmin: isAdminEmail(email),
      }}
    >
        <PageHeader
          title="Your Profile"
          description="Quick info about you and your operation. All optional. Helps us send tips that actually match what you haul."
        />
        <ProfileForm initial={initial} email={email} pastLoads={pastLoads} />
        {emailIn && (
          <div id="email-in" className="mt-4 scroll-mt-20">
            <EmailInCard {...emailIn} />
          </div>
        )}
        {invoiceSettings && (
          <div id="invoice-details" className="mt-4 scroll-mt-20">
            <InvoiceSettingsCard {...invoiceSettings} />
          </div>
        )}
        {emailPrefs && (
          <div id="emails" className="mt-4 scroll-mt-20">
            <EmailPreferencesCard {...emailPrefs} />
          </div>
        )}
        {aiStatus && (
          <div className="mt-4">
            <AiAllowanceCard status={aiStatus} proPlusOnSale={proPlusOnSale()} />
          </div>
        )}
        <div className="mt-4">
          <FeedbackCard />
        </div>

        <section id="history" className="mt-8 scroll-mt-20">
          <SectionHeading
            title="Carrier & rate history"
            description="Every snapshot you save on the calculator, newest first: who you were driving for, your cost per mile, and your target rate. Load one back into the calculator anytime."
          />
          {snapshots.length === 0 ? (
            <EmptyState title="No snapshots yet.">
              On the{" "}
              <Link href="/calculator" className="pr-link">
                calculator
              </Link>
              , tap{" "}
              <span className="font-semibold text-foreground">
                Save a dated snapshot
              </span>{" "}
              to record your first one.
            </EmptyState>
          ) : (
            <HistoryList snapshots={snapshots} />
          )}
        </section>
    </AppShell>
  );
}
