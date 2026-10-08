import "server-only";
import { batches } from "./messages";

/**
 * Sending through Postmark. Announcements go on the broadcast stream, kept
 * apart from transactional mail so a bulk send can never hurt the delivery of
 * invoices or email-in. Needs POSTMARK_SERVER_TOKEN (Postmark → Server → API
 * Tokens); the stream id defaults to "broadcast".
 */
export function postmarkConfig(): { token: string; stream: string } | null {
  const token = process.env.POSTMARK_SERVER_TOKEN;
  if (!token) return null;
  return { token, stream: process.env.POSTMARK_BROADCAST_STREAM || "broadcast" };
}

export type SendResult = { to: string; ok: boolean; messageId: string | null; errorCode: number; message: string };

/**
 * Postmark's codes for an address that must not be mailed — unsubscribed,
 * bounced, marked spam. These are skipped, not failures.
 */
const SUPPRESSED = new Set([406]);

export function isSuppressed(r: Pick<SendResult, "errorCode">): boolean {
  return SUPPRESSED.has(r.errorCode);
}

/** Send many messages, 500 per call, and return one result per message, in order. */
export async function sendBatch(token: string, messages: Record<string, unknown>[]): Promise<SendResult[]> {
  const out: SendResult[] = [];
  for (const chunk of batches(messages)) {
    try {
      const res = await fetch("https://api.postmarkapp.com/email/batch", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Postmark-Server-Token": token,
        },
        body: JSON.stringify(chunk),
      });
      const data = (await res.json().catch(() => null)) as
        | { ErrorCode?: number; Message?: string; MessageID?: string; To?: string }[]
        | { ErrorCode?: number; Message?: string }
        | null;
      if (!res.ok || !Array.isArray(data)) {
        const msg = data && !Array.isArray(data) ? String(data.Message ?? res.statusText) : res.statusText;
        for (const m of chunk) out.push({ to: String(m.To), ok: false, messageId: null, errorCode: res.status, message: msg });
        continue;
      }
      chunk.forEach((m, i) => {
        const r = data[i] ?? {};
        out.push({
          to: String(m.To),
          ok: r.ErrorCode === 0,
          messageId: r.MessageID ?? null,
          errorCode: Number(r.ErrorCode ?? -1),
          message: String(r.Message ?? ""),
        });
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "network error";
      for (const m of chunk) out.push({ to: String(m.To), ok: false, messageId: null, errorCode: -1, message: msg });
    }
  }
  return out;
}

/**
 * Let someone who unsubscribed receive announcements again — only ever
 * because they switched updates back on themselves, on Profile. Best effort:
 * Postmark refuses to reactivate a spam complaint, and that is right.
 */
export async function reactivate(token: string, stream: string, email: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.postmarkapp.com/message-streams/${encodeURIComponent(stream)}/suppressions/delete`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": token,
      },
      body: JSON.stringify({ Suppressions: [{ EmailAddress: email }] }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
