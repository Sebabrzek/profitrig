/**
 * Email-in: every driver can have their own address — dennis@in.profitrig.com
 * — and anything sent or forwarded to it with a rate con or ticket attached
 * becomes a DRAFT load for them to check, exactly like the Scan button.
 *
 * Pure functions only — no database, no network — so every rule is tested
 * (npm test). The webhook that receives mail is app/api/email-in/route.ts;
 * the reading itself is the scanner's (lib/scanRun).
 */
import { SCAN_MAX_BYTES, type ScanMimeType } from "./scan";

/** Where drivers' addresses live. Its MX record points at Postmark. */
export const EMAIL_IN_DOMAIN = "in.profitrig.com";

/** At most this many documents are read from one email. */
export const EMAIL_IN_MAX_ATTACHMENTS = 3;

/**
 * Smaller images are logos and signature graphics, not paperwork. A phone
 * photo of a rate con is hundreds of kilobytes at the least.
 */
export const EMAIL_IN_MIN_IMAGE_BYTES = 40 * 1024;

/** Names nobody may take: they would pass for ProfitRig itself, or for mail infrastructure. */
export const RESERVED_NAMES = new Set([
  "abuse", "admin", "administrator", "billing", "contact", "help", "hostmaster",
  "info", "legal", "mail", "mailer-daemon", "no-reply", "noreply", "postmaster",
  "privacy", "profitrig", "root", "sales", "security", "support", "team",
  "webmaster", "www",
]);

// ─────────────────────────────────────────────────────────────────────
// Choosing an address
// ─────────────────────────────────────────────────────────────────────

/** "Dennis Jr." → "dennis.jr" — what a typed name becomes before it is checked. */
export function normalizeName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/@.*$/, "")
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9.-]/g, "")
    .replace(/[.-]{2,}/g, (m) => m[0])
    .replace(/^[.-]+|[.-]+$/g, "");
}

export type NameCheck = { ok: true; name: string } | { ok: false; error: string };

/**
 * Whether a name can be an address: 3–30 letters, numbers, dots or dashes,
 * starting and ending with a letter or number, and not one of the reserved
 * names. The same rule is a CHECK in migration 021.
 */
export function checkName(raw: string): NameCheck {
  const name = normalizeName(raw);
  if (name.length < 3) return { ok: false, error: "Use at least 3 letters or numbers." };
  if (name.length > 30) return { ok: false, error: "Keep it to 30 characters or fewer." };
  if (!/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/.test(name) || /[.-]{2}/.test(name)) {
    return { ok: false, error: "Use letters, numbers, dots or dashes." };
  }
  if (RESERVED_NAMES.has(name)) return { ok: false, error: "That name is reserved. Try another." };
  return { ok: true, name };
}

/**
 * The name itself if it is free; otherwise the first of name2, name3, … that
 * is. `taken` holds the names already in use that start with this one.
 */
export function firstFreeName(name: string, taken: Set<string>): string | null {
  if (!taken.has(name)) return name;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${name}${n}`;
    if (candidate.length > 30) return null;
    if (!taken.has(candidate)) return candidate;
  }
  return null;
}

export function addressFor(name: string): string {
  return `${name}@${EMAIL_IN_DOMAIN}`;
}

// ─────────────────────────────────────────────────────────────────────
// What arrived
// ─────────────────────────────────────────────────────────────────────

type Party = { Email?: string; Name?: string; MailboxHash?: string };

/** The parts of Postmark's inbound JSON that ProfitRig uses. */
export type InboundEmail = {
  MessageID?: string;
  From?: string;
  FromName?: string;
  FromFull?: Party;
  OriginalRecipient?: string;
  ToFull?: Party[];
  CcFull?: Party[];
  BccFull?: Party[];
  Subject?: string;
  TextBody?: string;
  Attachments?: {
    Name?: string;
    Content?: string;
    ContentType?: string;
    ContentLength?: number;
    ContentID?: string;
  }[];
};

/**
 * Which driver an email is for: the address at in.profitrig.com it was
 * delivered to. A forwarded email is still addressed to the driver's own
 * inbox, so the delivery address (OriginalRecipient) comes first. Anything
 * after a "+" is ignored, so dennis+tql@ still reaches Dennis.
 */
export function recipientName(email: InboundEmail, domain = EMAIL_IN_DOMAIN): string | null {
  const candidates = [
    email.OriginalRecipient,
    ...(email.ToFull ?? []).map((p) => p.Email),
    ...(email.CcFull ?? []).map((p) => p.Email),
    ...(email.BccFull ?? []).map((p) => p.Email),
  ];
  for (const c of candidates) {
    const m = typeof c === "string" ? c.trim().toLowerCase().match(/^([^@\s]+)@([^@\s]+)$/) : null;
    if (m && m[2] === domain) return m[1].split("+")[0];
  }
  return null;
}

/**
 * What a file really is, from its first bytes — never from the name or the
 * type the sender claimed, which anyone can set.
 */
export function sniffType(bytes: Uint8Array): ScanMimeType | null {
  const b = bytes;
  if (b.length >= 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return "application/pdf";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

export type PickedAttachment = { name: string; mime: ScanMimeType; bytes: Uint8Array };

/**
 * The attachments worth reading: real PDFs and photos, logos and signature
 * images left out, nothing over the scanner's size limit, at most three.
 * `skipped` counts what was left out, for the driver's email log.
 */
export function pickAttachments(email: InboundEmail): {
  picked: PickedAttachment[];
  skipped: number;
  extra: number;
} {
  const picked: PickedAttachment[] = [];
  let skipped = 0;
  let extra = 0;
  for (const a of email.Attachments ?? []) {
    if (typeof a.Content !== "string" || !a.Content) {
      skipped++;
      continue;
    }
    let bytes: Uint8Array;
    try {
      bytes = Uint8Array.from(atob(a.Content.replace(/\s+/g, "")), (c) => c.charCodeAt(0));
    } catch {
      skipped++;
      continue;
    }
    const mime = sniffType(bytes);
    const tooSmallImage = mime !== "application/pdf" && bytes.length < EMAIL_IN_MIN_IMAGE_BYTES;
    if (!mime || tooSmallImage || bytes.length > SCAN_MAX_BYTES) {
      skipped++;
      continue;
    }
    if (picked.length >= EMAIL_IN_MAX_ATTACHMENTS) {
      extra++;
      continue;
    }
    picked.push({ name: String(a.Name ?? "attachment").slice(0, 120), mime, bytes });
  }
  return { picked, skipped, extra };
}

/**
 * Gmail asks the new address to confirm before it will forward anything:
 * "(#123456789) Gmail Forwarding Confirmation - Receive Mail from x@gmail.com".
 * ProfitRig shows the driver the code so they can finish the set-up. Only
 * digits and an address are kept — never a link — so a forged message can
 * do nothing but show a wrong number.
 */
export function gmailConfirmation(email: InboundEmail): { code: string; from: string | null } | null {
  const sender = (email.FromFull?.Email ?? email.From ?? "").toLowerCase();
  const subject = email.Subject ?? "";
  if (!sender.endsWith("@google.com") || !/gmail forwarding confirmation/i.test(subject)) return null;
  const code =
    subject.match(/\(#(\d{6,12})\)/)?.[1] ??
    (email.TextBody ?? "").match(/confirmation code:\s*(\d{6,12})/i)?.[1] ??
    null;
  if (!code) return null;
  const from = subject.match(/receive mail from\s+([^\s@]+@[^\s@]+\.[a-z]{2,})/i)?.[1] ?? null;
  return { code, from: from ? from.toLowerCase().slice(0, 120) : null };
}

/**
 * The Gmail confirmation code to show, if one arrived in the last week —
 * newest first. Older codes have expired in Gmail anyway.
 */
export function freshGmailCode(
  rows: { outcome?: unknown; gmail_code?: unknown; gmail_from?: unknown; received_at?: unknown }[],
  now: Date
): { code: string; from: string | null } | null {
  const weekAgo = now.getTime() - 7 * 86_400_000;
  for (const r of rows) {
    if (r.outcome !== "gmail_confirmation" || typeof r.gmail_code !== "string") continue;
    const at = new Date(String(r.received_at)).getTime();
    if (!Number.isFinite(at) || at < weekAgo) continue;
    return { code: r.gmail_code, from: typeof r.gmail_from === "string" ? r.gmail_from : null };
  }
  return null;
}

/** What the driver's email log says happened, in one plain sentence. */
export type EmailOutcome =
  | "scanned"
  | "duplicate"
  | "no_attachment"
  | "not_on_plan"
  | "over_limit"
  | "gmail_confirmation"
  | "failed";

export function describeOutcome(
  outcome: EmailOutcome,
  counts: { read?: number; skipped?: number; extra?: number } = {}
): string {
  const read = counts.read ?? 0;
  const tail = [
    counts.extra ? `${counts.extra} more attachment${counts.extra === 1 ? "" : "s"} not read (3 per email)` : "",
  ]
    .filter(Boolean)
    .join(" ");
  switch (outcome) {
    case "scanned":
      return `${read} document${read === 1 ? "" : "s"} read — waiting on your Loads page.${tail ? ` ${tail}.` : ""}`;
    case "duplicate":
      return "Already received — nothing new to read.";
    case "no_attachment":
      return "No PDF or photo attached. If the email has a link, open it, save the PDF, and scan it.";
    case "not_on_plan":
      return "Scanning comes with ProfitRig Pro.";
    case "over_limit":
      return "Not read — this month's AI allowance or today's scans are used up.";
    case "gmail_confirmation":
      return "Gmail asked to confirm forwarding — the code is on your Profile.";
    case "failed":
      return "Couldn't be read. Scan it from Add a Load instead.";
  }
}
