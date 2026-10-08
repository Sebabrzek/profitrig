import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/Surfaces";
import { Notice } from "@/components/ui/Notice";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin";
import { todayIsoIn } from "@/lib/loads";
import {
  AUDIENCE_LABEL,
  DEFAULT_FROM_NAME,
  audienceCounts,
  checkMessageSettings,
  isShowing,
  type Audience,
} from "@/lib/messages";
import { postmarkConfig } from "@/lib/postmark";
import { Composer, EndBannerButton, SenderSettingsForm } from "./Composer";
import { PRESETS } from "./presets";
import { loadPeople } from "./people";

// Sending to a few hundred drivers is one Postmark call, but give it room.
export const maxDuration = 60;

const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

/**
 * Admin → Messages: write to drivers. Announcements by email to an audience
 * (never anyone who opted out), the same news as an in-app banner, and what
 * happened to each send. Admins only.
 */
export default async function MessagesPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) notFound();
  const admin = createSupabaseAdminClient();
  if (!admin) notFound();

  const [settingsRes, campaignsRes, recipientsRes, bannersRes, people, meRes] = await Promise.all([
    admin.from("message_settings").select("*").eq("id", 1).maybeSingle(),
    admin.from("campaigns").select("*").order("created_at", { ascending: false }).limit(20),
    admin.from("campaign_recipients").select("campaign_id,status,unsubscribed_at").limit(10000),
    admin.from("announcements").select("*").order("created_at", { ascending: false }).limit(10),
    loadPeople(admin),
    admin.from("driver_profiles").select("first_name").eq("user_id", user.id).maybeSingle(),
  ]);
  const account = { email: user.email ?? "", isPro: true, isAdmin: true };
  const header = (
    <PageHeader
      eyebrow="Admin"
      title="Messages"
      description="Announcements to drivers by email and in the app. Nobody who opted out is ever sent to."
      action={
        <Link href="/admin" className="pr-link pr-hit text-sm">
          ← Users
        </Link>
      }
    />
  );
  if (settingsRes.error) {
    return (
      <AppShell width="standard" account={account}>
        {header}
        <Notice>Messages aren&apos;t switched on yet. Run migration 023 in Supabase.</Notice>
      </AppShell>
    );
  }

  const settings = {
    from_name: String(settingsRes.data?.from_name ?? DEFAULT_FROM_NAME),
    reply_to: String(settingsRes.data?.reply_to ?? user.email ?? ""),
    mailing_address: String(settingsRes.data?.mailing_address ?? ""),
  };
  const settingsOk = checkMessageSettings(settings).ok && Boolean(settingsRes.data);
  const config = postmarkConfig();
  const ready = settingsOk && Boolean(config);
  const counts = audienceCounts(people, todayIsoIn("America/Chicago"));

  const stats = new Map<string, Record<string, number>>();
  for (const r of recipientsRes.data ?? []) {
    const s = stats.get(String(r.campaign_id)) ?? {};
    s[String(r.status)] = (s[String(r.status)] ?? 0) + 1;
    if (r.unsubscribed_at) s.unsubscribed = (s.unsubscribed ?? 0) + 1;
    stats.set(String(r.campaign_id), s);
  }
  const showing = (bannersRes.data ?? []).filter((b) => isShowing(b, new Date()));

  return (
    <AppShell width="standard" account={account}>
      {header}
      <div className="flex flex-col gap-5">
        {!ready && (
          <Card>
            <CardHeader title="Before the first email" />
            <ul className="flex flex-col gap-2 text-sm">
              <li>{config ? "✓" : "✗"} Postmark key in Vercel (<code>POSTMARK_SERVER_TOKEN</code>)</li>
              <li>{settingsOk ? "✓" : "✗"} Sender settings saved, with your mailing address (below)</li>
              <li>
                · A Postmark broadcast stream with the id <code>{config?.stream ?? "broadcast"}</code>, and its webhook pointing at
                /api/email-events — set up in Postmark
              </li>
            </ul>
          </Card>
        )}

        <Composer
          counts={counts}
          ready={ready}
          previewName={String(meRes.data?.first_name ?? "") || "Dennis"}
          mailingAddress={settings.mailing_address}
          presets={PRESETS}
        />

        <section>
          <h2 className="mb-3 font-display text-lg font-bold text-[var(--pr-rig-green)]">Banners showing now</h2>
          {showing.length === 0 ? (
            <p className="text-sm text-muted">None.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {showing.map((b) => (
                <li key={String(b.id)} className="flex flex-wrap items-baseline justify-between gap-3 rounded-[var(--pr-radius-card)] border border-border bg-white px-4 py-3 text-sm">
                  <span className="min-w-0">
                    <span className="font-semibold">{String(b.title)}</span> — {String(b.body)}
                    <span className="block text-xs text-muted">Until {day(String(b.ends_at))}</span>
                  </span>
                  <EndBannerButton id={String(b.id)} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-3 font-display text-lg font-bold text-[var(--pr-rig-green)]">History</h2>
          {(campaignsRes.data ?? []).length === 0 ? (
            <EmptyState title="Nothing sent yet." />
          ) : (
            <div className="-mx-1 overflow-x-auto px-1">
              <table className="w-full text-sm">
                <caption className="sr-only">Announcements sent</caption>
                <thead>
                  <tr className="border-b border-border text-left">
                    {["Sent", "Subject", "To", "Recipients", "Delivered", "Bounced", "Skipped", "Unsubscribed", "Failed"].map((h) => (
                      <th key={h} scope="col" className="pr-record-label whitespace-nowrap py-2 pr-4">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(campaignsRes.data ?? []).map((c) => {
                    const s = stats.get(String(c.id)) ?? {};
                    return (
                      <tr key={String(c.id)} className="border-b border-border last:border-0">
                        <td className="whitespace-nowrap py-2 pr-4 text-muted">{day(c.sent_at ?? c.created_at)}</td>
                        <th scope="row" className="py-2 pr-4 text-left font-medium">{String(c.subject)}</th>
                        <td className="whitespace-nowrap py-2 pr-4">{AUDIENCE_LABEL[c.audience as Audience] ?? c.audience}</td>
                        <td className="py-2 pr-4 tabular-nums">{c.recipients}</td>
                        <td className="py-2 pr-4 tabular-nums">{s.delivered ?? 0}</td>
                        <td className="py-2 pr-4 tabular-nums">{s.bounced ?? 0}</td>
                        <td className="py-2 pr-4 tabular-nums">{s.suppressed ?? 0}</td>
                        <td className="py-2 pr-4 tabular-nums">{s.unsubscribed ?? 0}</td>
                        <td className="py-2 pr-4 tabular-nums">{s.failed ?? 0}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-muted">
                Delivered and bounced fill in as Postmark reports back. Skipped means Postmark already knew the address had unsubscribed or bounced.
              </p>
            </div>
          )}
        </section>

        <SenderSettingsForm initial={settings} />
      </div>
    </AppShell>
  );
}
