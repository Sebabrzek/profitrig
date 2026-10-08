"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin";
import { todayIsoIn } from "@/lib/loads";
import {
  buildMessage,
  checkCampaign,
  checkMessageSettings,
  inAudience,
  type MessageSettings,
} from "@/lib/messages";
import { isSuppressed, postmarkConfig, sendBatch } from "@/lib/postmark";
import { loadPeople } from "./people";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const admin = createSupabaseAdminClient();
  if (!user || !isAdminEmail(user.email) || !admin) return null;
  return { user, admin };
}

async function readySettings(admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>) {
  const { data } = await admin.from("message_settings").select("*").eq("id", 1).maybeSingle();
  const checked = checkMessageSettings({
    from_name: data?.from_name ?? "",
    reply_to: data?.reply_to ?? "",
    mailing_address: data?.mailing_address ?? "",
  });
  return checked.ok ? checked.settings : null;
}

/** Sender name, reply-to, and the mailing address every bulk email carries. */
export async function saveMessageSettingsAction(raw: Record<string, unknown>): Promise<Result> {
  const ctx = await requireAdmin();
  if (!ctx) return { ok: false, error: "Admins only." };
  const checked = checkMessageSettings(raw ?? {});
  if (!checked.ok) return { ok: false, error: checked.error };
  const { error } = await ctx.admin
    .from("message_settings")
    .upsert({ id: 1, ...checked.settings, reply_to: checked.settings.reply_to || null, updated_at: new Date().toISOString() });
  if (error) return { ok: false, error: "Messages aren't switched on yet (migration 023)." };
  revalidatePath("/admin/messages");
  return { ok: true };
}

/** The message, exactly as drivers will get it, to the admin's own inbox. */
export async function sendTestAction(raw: Record<string, unknown>): Promise<Result<{ to: string }>> {
  const ctx = await requireAdmin();
  if (!ctx) return { ok: false, error: "Admins only." };
  const checked = checkCampaign({ ...raw, audience: "all", sendEmail: true, showInApp: false });
  if (!checked.ok) return { ok: false, error: checked.error };
  const config = postmarkConfig();
  if (!config) return { ok: false, error: "Add POSTMARK_SERVER_TOKEN in Vercel first." };
  const settings = await readySettings(ctx.admin);
  if (!settings) return { ok: false, error: "Fill in Sender settings first." };
  const { data: me } = await ctx.admin.from("driver_profiles").select("first_name").eq("user_id", ctx.user.id).maybeSingle();
  const to = ctx.user.email ?? "";
  const msg = buildMessage(
    { id: "test", subject: `[Test] ${checked.campaign.subject}`, body: checked.campaign.body },
    { userId: ctx.user.id, email: to, firstName: String(me?.first_name ?? "") },
    settings,
    config.stream
  );
  const [r] = await sendBatch(config.token, [msg]);
  if (!r?.ok) return { ok: false, error: `Postmark said: ${r?.message || "no answer"}` };
  return { ok: true, to };
}

/**
 * Send an announcement to an audience, and/or show it as an in-app banner.
 * Who gets it is worked out here, never taken from the browser, and nobody
 * who opted out is ever included.
 */
export async function sendCampaignAction(
  raw: Record<string, unknown>
): Promise<Result<{ sent: number; skipped: number; failed: number; banner: boolean }>> {
  const ctx = await requireAdmin();
  if (!ctx) return { ok: false, error: "Admins only." };
  const checked = checkCampaign(raw ?? {});
  if (!checked.ok) return { ok: false, error: checked.error };
  const c = checked.campaign;
  const sendEmail = c.sendEmail;

  let campaignId: string | null = null;
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  if (sendEmail) {
    const config = postmarkConfig();
    if (!config) return { ok: false, error: "Add POSTMARK_SERVER_TOKEN in Vercel first." };
    const settings: MessageSettings | null = await readySettings(ctx.admin);
    if (!settings) return { ok: false, error: "Fill in Sender settings first — the mailing address is required." };
    const today = todayIsoIn("America/Chicago");
    const recipients = (await loadPeople(ctx.admin)).filter((p) => inAudience(p, c.audience, today));
    if (recipients.length === 0) return { ok: false, error: "Nobody in that audience gets updates." };

    const { data: campaign, error } = await ctx.admin
      .from("campaigns")
      .insert({ created_by: ctx.user.id, subject: c.subject, body: c.body, audience: c.audience, recipients: recipients.length })
      .select("id")
      .single();
    if (error || !campaign) return { ok: false, error: "Messages aren't switched on yet (migration 023)." };
    campaignId = String(campaign.id);

    const results = await sendBatch(
      config.token,
      recipients.map((p) => buildMessage({ id: campaignId!, subject: c.subject, body: c.body }, p, settings, config.stream))
    );
    const rows = recipients.map((p, i) => {
      const r = results[i];
      const status = r?.ok ? "sent" : r && isSuppressed(r) ? "suppressed" : "failed";
      if (status === "sent") sent++;
      else if (status === "suppressed") skipped++;
      else failed++;
      return {
        campaign_id: campaignId,
        user_id: p.userId,
        email: p.email,
        status,
        postmark_message_id: r?.messageId ?? null,
        error: r?.ok ? null : (r?.message ?? "").slice(0, 300) || null,
        updated_at: new Date().toISOString(),
      };
    });
    for (let i = 0; i < rows.length; i += 500) {
      await ctx.admin.from("campaign_recipients").upsert(rows.slice(i, i + 500), { onConflict: "campaign_id,user_id" });
    }
    await ctx.admin
      .from("campaigns")
      .update({
        status: sent === 0 && failed > 0 ? "failed" : "sent",
        sent_at: new Date().toISOString(),
        error: failed > 0 ? `${failed} not sent: ${rows.find((r) => r.status === "failed")?.error ?? ""}`.slice(0, 300) : null,
      })
      .eq("id", campaignId);
  }

  if (c.showInApp) {
    const ends = new Date(Date.now() + c.bannerDays * 86_400_000).toISOString();
    const { error } = await ctx.admin
      .from("announcements")
      .insert({ title: c.subject.replace(/\{\{\s*first_name\s*\}\}/gi, "").trim().slice(0, 150), body: c.bannerText, ends_at: ends, campaign_id: campaignId });
    if (error) return { ok: false, error: "The email went out, but the banner couldn't be saved. Try the banner again." };
  }

  revalidatePath("/admin/messages");
  return { ok: true, sent, skipped, failed, banner: c.showInApp };
}

/** Take a banner down now. */
export async function endAnnouncementAction(id: string): Promise<Result> {
  const ctx = await requireAdmin();
  if (!ctx) return { ok: false, error: "Admins only." };
  const { error } = await ctx.admin.from("announcements").update({ ends_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: "Couldn't take it down. Try again." };
  revalidatePath("/admin/messages");
  return { ok: true };
}
