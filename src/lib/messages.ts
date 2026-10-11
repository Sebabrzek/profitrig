/**
 * Messages: what Sebastian sends drivers from Admin — announcements by
 * email, and the same news as a banner inside the app.
 *
 * WHO GETS AN EMAIL: everyone whose account is confirmed, unless they
 * unsubscribed or switched updates off on Profile — that "no" always wins
 * and is never undone for them. Someone who never confirmed their email has
 * never been in the app, and their address may be a typo: they get a fresh
 * sign-up link instead (needsConfirmLink), never the news.
 *
 * Unsubscribing is Postmark's: every email carries Postmark's one-click
 * unsubscribe link and headers ({{{ pm:unsubscribe }}}), and Postmark tells
 * ProfitRig when someone uses it (api/email-events), so both agree.
 *
 * Pure functions only — no database, no network — so every rule is tested
 * (npm test).
 */

export const AUDIENCES = ["all", "pro", "free", "own_authority", "leased", "inactive"] as const;
export type Audience = (typeof AUDIENCES)[number];

export const AUDIENCE_LABEL: Record<Audience, string> = {
  all: "Everyone who gets updates",
  pro: "Pro drivers",
  free: "Free users",
  own_authority: "Own authority",
  leased: "Leased drivers",
  inactive: "Pro, no load logged in 14 days",
};

/** Where every announcement comes from. profitrig.com is verified in Postmark. */
export const FROM_ADDRESS = "updates@profitrig.com";
export const DEFAULT_FROM_NAME = "Sebastian at ProfitRig";

export const MAX_SUBJECT = 150;
export const MAX_BODY = 20_000;
export const MAX_BANNER = 280;
export const DEFAULT_BANNER_DAYS = 14;
export const INACTIVE_DAYS = 14;

export type Person = {
  userId: string;
  email: string;
  firstName: string;
  pro: boolean;
  /** They confirmed their email, so the address is real and theirs. */
  confirmed: boolean;
  authorityType: string;
  /** The driver's own switch; null means they never touched it — "yes". */
  productUpdates: boolean | null;
  /** YYYY-MM-DD of their newest load, or null. */
  lastLoadDate: string | null;
};

/** Whether someone gets announcements at all: yes, unless they said no. */
export function wantsUpdates(p: Pick<Person, "productUpdates">): boolean {
  return p.productUpdates !== false;
}

const daysBetween = (fromIso: string, toIso: string) =>
  Math.round(
    (new Date(`${toIso}T12:00:00Z`).getTime() - new Date(`${fromIso}T12:00:00Z`).getTime()) / 86_400_000
  );

/** Whether one person is in an audience today. Never anyone who opted out. */
export function inAudience(p: Person, audience: Audience, today: string): boolean {
  if (!p.email || !p.confirmed || !wantsUpdates(p)) return false;
  switch (audience) {
    case "all":
      return true;
    case "pro":
      return p.pro;
    case "free":
      return !p.pro;
    case "own_authority":
      return p.authorityType !== "leased";
    case "leased":
      return p.authorityType === "leased";
    case "inactive":
      return p.pro && (!p.lastLoadDate || daysBetween(p.lastLoadDate, today) >= INACTIVE_DAYS);
  }
}

/** How many each audience reaches — leaving out anyone in `skip`. */
export function audienceCounts(people: Person[], today: string, skip: ReadonlySet<string> = new Set()): Record<Audience, number> {
  const counts = Object.fromEntries(AUDIENCES.map((a) => [a, 0])) as Record<Audience, number>;
  for (const p of people) {
    if (skip.has(p.userId)) continue;
    for (const a of AUDIENCES) if (inAudience(p, a, today)) counts[a]++;
  }
  return counts;
}

/**
 * Who an earlier announcement reached, so the next one can leave them out:
 * anyone it was sent or delivered to. A failed or bounced send didn't reach
 * them, so they stay in.
 */
export function alreadyGot(rows: { campaign_id: unknown; user_id: unknown; status: unknown }[], campaignId: string): Set<string> {
  const got = new Set<string>();
  for (const r of rows) {
    if (String(r.campaign_id) === campaignId && (r.status === "sent" || r.status === "delivered")) got.add(String(r.user_id));
  }
  return got;
}

// ─────────────────────────────────────────────────────────────────────
// Sign-ups that never confirmed
// ─────────────────────────────────────────────────────────────────────

/** A fresh sign-up link goes out at most once a day per person. */
export const CONFIRM_LINK_EVERY_HOURS = 24;

/**
 * Whether someone who signed up but never confirmed should get a fresh
 * sign-up link now: they have an email, it isn't confirmed, and they
 * haven't been sent one in the last day.
 */
export function needsConfirmLink(
  u: { email?: string | null; email_confirmed_at?: string | null; confirmation_sent_at?: string | null },
  now: Date
): boolean {
  if (!u.email || u.email_confirmed_at) return false;
  if (!u.confirmation_sent_at) return true;
  const sent = new Date(u.confirmation_sent_at).getTime();
  return !Number.isFinite(sent) || now.getTime() - sent >= CONFIRM_LINK_EVERY_HOURS * 3_600_000;
}

// ─────────────────────────────────────────────────────────────────────
// Writing it
// ─────────────────────────────────────────────────────────────────────

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** "{{first_name}}" becomes the driver's first name, or "there". */
export function personalize(text: string, firstName: string): string {
  const name = firstName.trim() || "there";
  return text.replace(/\{\{\s*first_name\s*\}\}/gi, name);
}

const LINK = /\[([^\]\n]{1,120})\]\((https:\/\/[^\s)]{1,500})\)|(https:\/\/[^\s<>()]{1,500})/g;

/** One line of plain text, made safe, with **bold** and https links. */
function inline(line: string): string {
  let out = "";
  let last = 0;
  for (const m of line.matchAll(LINK)) {
    out += boldOnly(line.slice(last, m.index));
    const href = m[2] ?? m[3];
    const label = m[1] ?? m[3];
    out += `<a href="${escapeHtml(href)}" style="color:#173c2b;font-weight:600;">${escapeHtml(label)}</a>`;
    last = (m.index ?? 0) + m[0].length;
  }
  return out + boldOnly(line.slice(last));
}
const boldOnly = (s: string) => escapeHtml(s).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

/**
 * The few things Sebastian writes with — paragraphs, "- " bullet lists,
 * **bold**, and links — as email HTML. Everything else is shown as typed;
 * nothing a driver's name or a pasted snippet contains can become markup.
 */
export function renderBody(text: string): string {
  const isItem = (l: string) => /^\s*[-•]\s+/.test(l);
  const blocks = text.replace(/\r/g, "").trim().split(/\n{2,}/);
  return blocks
    .map((block) => {
      // Runs of "- " lines become a list wherever they sit; the lines
      // around them stay a paragraph.
      const out: string[] = [];
      let run: string[] = [];
      let listRun = false;
      const flush = () => {
        if (run.length === 0) return;
        out.push(
          listRun
            ? `<ul style="margin:0 0 16px;padding-left:22px;">${run
                .map((l) => `<li style="margin:0 0 6px;">${inline(l.replace(/^\s*[-•]\s+/, ""))}</li>`)
                .join("")}</ul>`
            : `<p style="margin:0 0 16px;">${run.map(inline).join("<br>")}</p>`
        );
        run = [];
      };
      for (const line of block.split("\n").map((l) => l.trimEnd())) {
        if (isItem(line) !== listRun) {
          flush();
          listRun = isItem(line);
        }
        run.push(line);
      }
      flush();
      return out.join("");
    })
    .join("");
}

/** The same text, plain: links as "label (url)", bold marks dropped. */
export function renderText(text: string): string {
  return text
    .replace(/\r/g, "")
    .trim()
    .replace(/\[([^\]\n]{1,120})\]\((https:\/\/[^\s)]{1,500})\)/g, "$1 ($2)")
    .replace(/\*\*([^*]+)\*\*/g, "$1");
}

/** Where the email's pictures live. Mail apps need full addresses. */
export const EMAIL_SITE = "https://www.profitrig.com";

/**
 * The frame every ProfitRig email shares: the approved logo on a Rig Green
 * band, the engraved truck on the paper canvas, the content on white, and a
 * Profit Green button. Pictures are copies of the approved artwork with
 * their backgrounds filled in (public/brand/email), so a dark-mode mail app
 * can't make the logo vanish. Mail apps can't load our fonts; text falls
 * back to Helvetica/Arial. The Supabase sign-up email
 * (docs/email-templates/supabase-confirm-signup.html) uses the same frame.
 */
export function emailFrame({ content, footer, assetBase = EMAIL_SITE }: { content: string; footer: string; assetBase?: string }): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"></head><body style="margin:0;padding:0;background:#f9f5e9;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9f5e9;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e5e2d8;border-radius:14px;border-collapse:separate;">
<tr><td bgcolor="#173c2b" style="background:#173c2b;padding:20px 28px;border-radius:13px 13px 0 0;"><img src="${assetBase}/brand/email/profitrig-lockup-reversed-480.png" width="240" alt="ProfitRig" style="display:block;width:240px;max-width:100%;height:auto;border:0;color:#f6f7f4;font-family:Helvetica,Arial,sans-serif;font-size:22px;font-weight:800;"></td></tr>
<tr><td bgcolor="#f9f5e9" style="background:#f9f5e9;padding:12px 20px 0;"><img src="${assetBase}/brand/email/truck-1040.jpg" width="520" alt="" style="display:block;width:100%;max-width:520px;height:auto;border:0;"></td></tr>
${content}
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;"><tr><td style="padding:16px 28px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:#667085;">
${footer}<br><span style="font-weight:700;letter-spacing:0.12em;color:#173c2b;">KNOW YOUR NUMBERS. TAKE CONTROL.</span>
</td></tr></table>
</td></tr></table></body></html>`;
}

/** A Profit Green button, as mail apps draw it. */
export function emailButton(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;background:#16a34a;color:#ffffff;font-family:Helvetica,Arial,sans-serif;font-weight:700;font-size:17px;text-decoration:none;padding:13px 22px;border-radius:10px;">${escapeHtml(label)}</a>`;
}

/**
 * An announcement: the message in the frame, a button into ProfitRig, and
 * a footer with Postmark's unsubscribe link and the business's mailing
 * address (the law asks for both on any bulk email).
 */
export function emailHtml({ bodyHtml, mailingAddress, assetBase }: { bodyHtml: string; mailingAddress: string; assetBase?: string }): string {
  const address = escapeHtml(mailingAddress).replace(/\n/g, "<br>");
  // The character set is declared in the email itself: some mail apps ignore
  // the header, and then an arrow or a "·" comes out garbled.
  return emailFrame({
    assetBase,
    content: `<tr><td style="padding:24px 28px 8px;font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55;color:#1f2937;">${bodyHtml}</td></tr>
<tr><td style="padding:4px 28px 28px;">${emailButton(`${EMAIL_SITE}/loads`, "Open ProfitRig")}</td></tr>`,
    footer: `You're getting this because you have a ProfitRig account. <a href="{{{ pm:unsubscribe }}}" style="color:#667085;">Unsubscribe</a> · <a href="${EMAIL_SITE}/profile#emails" style="color:#667085;">Email preferences</a><br>${address}`,
  });
}

export function emailText({ bodyText, mailingAddress }: { bodyText: string; mailingAddress: string }): string {
  return `${bodyText}\n\nOpen ProfitRig: https://www.profitrig.com/loads\n\n--\nYou're getting this because you have a ProfitRig account.\nUnsubscribe: {{{ pm:unsubscribe }}}\nEmail preferences: https://www.profitrig.com/profile#emails\n${mailingAddress}`;
}

export type MessageSettings = { from_name: string; reply_to: string; mailing_address: string };

/** One Postmark message for one person — personalized, safe, with the footer. */
export function buildMessage(
  c: { id: string; subject: string; body: string },
  p: Pick<Person, "userId" | "email" | "firstName">,
  s: MessageSettings,
  stream: string
) {
  const body = personalize(c.body, p.firstName);
  return {
    From: `${s.from_name.replace(/[<>"]/g, "") || DEFAULT_FROM_NAME} <${FROM_ADDRESS}>`,
    To: p.email,
    ...(s.reply_to ? { ReplyTo: s.reply_to } : {}),
    Subject: personalize(c.subject, p.firstName),
    HtmlBody: emailHtml({ bodyHtml: renderBody(body), mailingAddress: s.mailing_address }),
    TextBody: emailText({ bodyText: renderText(body), mailingAddress: s.mailing_address }),
    MessageStream: stream,
    Tag: "announcement",
    Metadata: { campaign_id: c.id, user_id: p.userId },
    TrackOpens: false,
  };
}

/** Postmark takes at most 500 messages per call. */
export function batches<T>(items: T[], size = 500): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** The in-app banner, by default: the message's first paragraph, plain, short. */
export function defaultBanner(body: string): string {
  const first = renderText(personalize(body, "")).split(/\n{2,}/)[0] ?? "";
  const flat = first.replace(/^\s*hi\s+there\s*[,—-]?\s*/i, "").replace(/\s+/g, " ").trim();
  return flat.length <= MAX_BANNER ? flat : `${flat.slice(0, MAX_BANNER - 1).trimEnd()}…`;
}

/** Whether a banner is showing at a moment. */
export function isShowing(b: { starts_at: unknown; ends_at: unknown }, at: Date): boolean {
  const t = at.getTime();
  return new Date(String(b.starts_at)).getTime() <= t && new Date(String(b.ends_at)).getTime() > t;
}

export type CampaignInput = {
  sendEmail: boolean;
  subject: string;
  body: string;
  audience: Audience;
  showInApp: boolean;
  bannerText: string;
  bannerDays: number;
};

export type CampaignCheck = { ok: true; campaign: CampaignInput } | { ok: false; error: string };

export function checkCampaign(raw: Record<string, unknown>): CampaignCheck {
  const subject = typeof raw.subject === "string" ? raw.subject.replace(/\s+/g, " ").trim() : "";
  const body = typeof raw.body === "string" ? raw.body.replace(/\r/g, "").trim() : "";
  const audience = AUDIENCES.includes(raw.audience as Audience) ? (raw.audience as Audience) : null;
  const sendEmail = raw.sendEmail !== false;
  const showInApp = raw.showInApp === true;
  const bannerText = typeof raw.bannerText === "string" ? raw.bannerText.replace(/\s+/g, " ").trim() : "";
  const days = Number(raw.bannerDays);
  const bannerDays = Number.isFinite(days) ? Math.floor(days) : DEFAULT_BANNER_DAYS;
  if (!sendEmail && !showInApp) return { ok: false, error: "Send it by email, show it in the app, or both." };
  if (!subject) return { ok: false, error: "Add a subject line." };
  if (subject.length > MAX_SUBJECT) return { ok: false, error: `Keep the subject under ${MAX_SUBJECT} characters.` };
  if (sendEmail && !body) return { ok: false, error: "Write the message." };
  if (body.length > MAX_BODY) return { ok: false, error: "That message is too long for one email." };
  if (!audience) return { ok: false, error: "Pick who gets it." };
  if (showInApp) {
    if (!bannerText) return { ok: false, error: "Add the short text for the in-app banner." };
    if (bannerText.length > MAX_BANNER) return { ok: false, error: `Keep the banner under ${MAX_BANNER} characters.` };
    if (bannerDays < 1 || bannerDays > 60) return { ok: false, error: "Show the banner for 1 to 60 days." };
  }
  return { ok: true, campaign: { sendEmail, subject, body, audience, showInApp, bannerText, bannerDays } };
}

export function checkMessageSettings(raw: Record<string, unknown>):
  | { ok: true; settings: MessageSettings }
  | { ok: false; error: string } {
  const from_name = typeof raw.from_name === "string" ? raw.from_name.replace(/[<>"]/g, "").trim().slice(0, 80) : "";
  const reply_to = typeof raw.reply_to === "string" ? raw.reply_to.trim().toLowerCase().slice(0, 200) : "";
  const mailing_address =
    typeof raw.mailing_address === "string"
      ? raw.mailing_address
          .replace(/\r/g, "")
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean)
          .join("\n")
          .slice(0, 300)
      : "";
  if (!from_name) return { ok: false, error: "Add the sender name drivers will see." };
  if (reply_to && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(reply_to)) return { ok: false, error: "That reply-to email doesn't look right." };
  if (!mailing_address) return { ok: false, error: "Add your business mailing address — the law requires it on bulk email." };
  return { ok: true, settings: { from_name, reply_to, mailing_address } };
}
