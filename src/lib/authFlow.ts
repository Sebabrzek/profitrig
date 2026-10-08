/**
 * Signing up and signing in, the parts worth testing: what a driver is told
 * when Supabase says no, which confirmation links are accepted, and where a
 * link may send them afterwards.
 *
 * Supabase's "Confirm email" is on, so a new account has no session until
 * its owner clicks the link in their email. Sign-up must say so — before
 * this, it sent them to the Calculator as if they were signed in.
 */

/** The link types a confirmation email can carry. */
export const CONFIRM_TYPES = ["email", "signup", "magiclink", "recovery", "invite", "email_change"] as const;
export type ConfirmType = (typeof CONFIRM_TYPES)[number];

export function confirmType(v: string | null): ConfirmType | null {
  return (CONFIRM_TYPES as readonly string[]).includes(v ?? "") ? (v as ConfirmType) : null;
}

/** Where a confirmed driver lands: one of our own pages, never another site. */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return "/calculator";
  return next;
}

type AuthErr = { code?: string | null; message?: string | null; status?: number | null };

/** Signing in before clicking the confirmation link. */
export function isUnconfirmed(err: AuthErr | null | undefined): boolean {
  return Boolean(err) && (err!.code === "email_not_confirmed" || /email not confirmed/i.test(err!.message ?? ""));
}

/** What Supabase's refusals mean, in a driver's words. */
export function friendlyAuthError(err: AuthErr | null | undefined): string {
  if (!err) return "Something went wrong. Try again.";
  const code = err.code ?? "";
  const msg = err.message ?? "";
  if (isUnconfirmed(err)) return "Confirm your email first — we sent you a link when you signed up.";
  if (code === "invalid_credentials" || /invalid login credentials/i.test(msg)) {
    return "That email and password don't match.";
  }
  if (code === "user_already_exists" || /already registered/i.test(msg)) {
    return "There's already an account with that email. Sign in instead.";
  }
  if (code === "weak_password" || /password should/i.test(msg)) {
    return "Pick a longer password — at least 6 characters.";
  }
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit" || err.status === 429 || /rate limit/i.test(msg)) {
    return "Too many tries. Wait a minute, then try again.";
  }
  if (code === "email_address_invalid" || /invalid.*email|email.*invalid/i.test(msg)) {
    return "That email address doesn't look right.";
  }
  return msg || "Something went wrong. Try again.";
}
