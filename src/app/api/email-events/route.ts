import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fromPostmark } from "@/lib/postmarkAuth";
import { postmarkConfig } from "@/lib/postmark";

export const runtime = "nodejs";

type Event = {
  RecordType?: string;
  MessageID?: string | null;
  MessageStream?: string;
  Recipient?: string;
  Email?: string;
  Type?: string;
  SuppressSending?: boolean;
  ChangedAt?: string;
};

/**
 * What happened to announcements after they left: Postmark reports each
 * delivery, bounce, spam complaint and unsubscribe here, so Admin's history
 * is true and anyone who unsubscribed is never mailed again. Only Postmark
 * gets in (the same basic-auth secret as email-in; 403 stops its retries).
 */
export async function POST(request: Request) {
  const secret = process.env.POSTMARK_WEBHOOK_SECRET || process.env.POSTMARK_INBOUND_SECRET;
  if (!secret) return NextResponse.json({ error: "not configured" }, { status: 503 });
  if (!fromPostmark(request, secret)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let e: Event;
  try {
    e = (await request.json()) as Event;
  } catch {
    return NextResponse.json({ error: "bad payload" }, { status: 400 });
  }
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  const broadcast = postmarkConfig()?.stream ?? process.env.POSTMARK_BROADCAST_STREAM ?? "broadcast";
  // Only announcements are tracked here; transactional mail has its own life.
  if (e.MessageStream && e.MessageStream !== broadcast) return NextResponse.json({ ok: true, note: "other stream" });

  const now = new Date().toISOString();
  const byMessage = (fields: Record<string, unknown>) =>
    e.MessageID
      ? admin.from("campaign_recipients").update({ ...fields, updated_at: now }).eq("postmark_message_id", e.MessageID)
      : Promise.resolve({ error: null });

  /** Never mail this person again until they switch updates back on themselves. */
  const optOut = async (email: string | undefined, at: string) => {
    if (!email) return;
    const { data } = await admin
      .from("campaign_recipients")
      .select("user_id")
      .ilike("email", email.replace(/[%_\\]/g, (c) => `\\${c}`))
      .limit(1)
      .maybeSingle();
    if (!data) return;
    await admin
      .from("email_preferences")
      .upsert(
        { user_id: data.user_id, product_updates: false, weekly_summary: false, unsubscribed_at: at, updated_at: now },
        { onConflict: "user_id" }
      );
  };

  switch (e.RecordType) {
    case "Delivery":
      await byMessage({ status: "delivered" });
      break;
    case "Bounce":
      await byMessage({ status: "bounced", error: String(e.Type ?? "Bounce").slice(0, 120) });
      break;
    case "SpamComplaint":
      await byMessage({ status: "bounced", error: "Marked as spam", unsubscribed_at: now });
      await optOut(e.Email ?? e.Recipient, now);
      break;
    case "SubscriptionChange":
      if (e.SuppressSending === true) {
        await byMessage({ unsubscribed_at: e.ChangedAt ?? now });
        await optOut(e.Recipient, e.ChangedAt ?? now);
      }
      break;
  }
  return NextResponse.json({ ok: true });
}
