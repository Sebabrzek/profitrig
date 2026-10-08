/**
 * Messages: what Sebastian sends drivers from Admin — announcements by
 * email, and the same news as a banner inside the app.
 *
 * WHO GETS AN EMAIL: a Pro driver, because it's about the service they pay
 * for; a free user only if they ticked "Send me ProfitRig emails". Anyone
 * who unsubscribed, or switched updates off on Profile, gets nothing. A
 * driver's own switch always wins over the default for their plan.
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
  free: "Free users who opted in",
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
  /** "Send me ProfitRig emails" on Profile. */
  marketingOptIn: boolean;
  authorityType: string;
  /** The driver's own switch; null means "the default for my plan". */
  productUpdates: boolean | null;
  /** YYYY-MM-DD of their newest load, or null. */
  lastLoadDate: string | null;
};

/** Whether someone gets announcements at all. Their own switch wins. */
export function wantsUpdates(p: Pick<Person, "pro" | "marketingOptIn" | "productUpdates">): boolean {
  if (p.productUpdates === false) return false;
  if (p.productUpdates === true) return true;
  return p.pro || p.marketingOptIn;
}

const daysBetween = (fromIso: string, toIso: string) =>
  Math.round(
    (new Date(`${toIso}T12:00:00Z`).getTime() - new Date(`${fromIso}T12:00:00Z`).getTime()) / 86_400_000
  );

/** Whether one person is in an audience today. Never anyone who opted out. */
export function inAudience(p: Person, audience: Audience, today: string): boolean {
  if (!p.email || !wantsUpdates(p)) return false;
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

export function audienceCounts(people: Person[], today: string): Record<Audience, number> {
  const counts = Object.fromEntries(AUDIENCES.map((a) => [a, 0])) as Record<Audience, number>;
  for (const p of people) for (const a of AUDIENCES) if (inAudience(p, a, today)) counts[a]++;
  return counts;
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

/**
 * The whole email: the ProfitRig name at the top, the message, and a footer
 * with Postmark's unsubscribe link and the business's mailing address (the
 * law asks for both on any bulk email).
 */
export function emailHtml({ bodyHtml, mailingAddress }: { bodyHtml: string; mailingAddress: string }): string {
  const address = escapeHtml(mailingAddress).replace(/\n/g, "<br>");
  // The character set is declared in the email itself: some mail apps ignore
  // the header, and then an arrow or a "·" comes out garbled.
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;padding:0;background:#f9f5e9;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9f5e9;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e5e2d8;border-radius:14px;">
<tr><td style="padding:24px 28px 8px;font-family:Helvetica,Arial,sans-serif;font-size:20px;font-weight:800;color:#173c2b;letter-spacing:-0.01em;">ProfitRig</td></tr>
<tr><td style="padding:8px 28px 12px;font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55;color:#1f2937;">${bodyHtml}</td></tr>
<tr><td style="padding:0 28px 24px;"><a href="https://www.profitrig.com/loads" style="display:inline-block;background:#173c2b;color:#ffffff;font-family:Helvetica,Arial,sans-serif;font-weight:700;font-size:15px;text-decoration:none;padding:12px 18px;border-radius:10px;">Open ProfitRig</a></td></tr>
</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;"><tr><td style="padding:16px 28px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:#667085;">
You're getting this because you have a ProfitRig account. <a href="{{{ pm:unsubscribe }}}" style="color:#667085;">Unsubscribe</a> · <a href="https://www.profitrig.com/profile#emails" style="color:#667085;">Email preferences</a><br>${address}<br><span style="font-weight:700;letter-spacing:0.08em;color:#173c2b;">KNOW YOUR NUMBERS. TAKE CONTROL.</span>
</td></tr></table>
</td></tr></table></body></html>`;
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
