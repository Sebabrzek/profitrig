import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // A confirmation link from Supabase's default email lands on the home page
  // (the Site URL) carrying ?code= or ?token_hash=. Send it on to the page
  // that signs the driver in, with everything it carried.
  if (
    pathname === "/" &&
    (request.nextUrl.searchParams.has("code") || request.nextUrl.searchParams.has("token_hash"))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/confirm";
    return NextResponse.redirect(url);
  }
  const isAuthRoute =
    pathname.startsWith("/login") || pathname.startsWith("/auth");
  // Stripe webhook is signature-verified and must stay reachable without
  // a Supabase session.
  // /api/chat runs its own auth check and answers with JSON — it must not be
  // redirected to the HTML login page, or an expired session would stream
  // login-page markup back into the chat widget as an "answer". /api/scan
  // likewise: the Scan button reads its JSON, as does attaching paperwork to
  // an invoice (/api/invoices). /api/email-in is Postmark delivering email;
  // it has no session and proves itself with a secret.
  const isPublicApi =
    pathname.startsWith("/api/stripe") ||
    pathname.startsWith("/api/chat") ||
    pathname.startsWith("/api/scan") ||
    pathname.startsWith("/api/email-in") ||
    pathname.startsWith("/api/invoices");
  // Two public pages: the marketing home, and the calculator itself.
  // Visitors can play with the math; saving prompts an account. /loads,
  // /fuel, /tax, /profile, /admin remain auth-gated below.
  const isPublicPage = pathname === "/" || pathname === "/calculator";

  if (!user && !isAuthRoute && !isPublicApi && !isPublicPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // A signed-in driver has no use for the sales pitch: both the login page
  // and the marketing home take them to their calculator, which is what "/"
  // did for them before the marketing page existed.
  if (user && (pathname.startsWith("/login") || pathname === "/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/calculator";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
