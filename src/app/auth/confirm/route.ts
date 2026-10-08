import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { confirmType, safeNext } from "@/lib/authFlow";

/**
 * Where the link in "Confirm your ProfitRig account" lands. It proves the
 * email, signs the driver in, and opens the Calculator.
 *
 * Two kinds of link arrive here:
 * - ?token_hash=…&type=email — ProfitRig's own email template. Works on any
 *   device, so a driver can sign up on a laptop and confirm on their phone.
 * - ?code=… — Supabase's default email, before the template is changed.
 *   Works in the browser they signed up in.
 * Anything else, or an expired link, goes to the sign-in page with a way to
 * get a new one.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = confirmType(url.searchParams.get("type"));
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));
  const supabase = await createSupabaseServerClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) redirect(next);
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) redirect(next);
  }
  redirect("/login?confirm=expired");
}
