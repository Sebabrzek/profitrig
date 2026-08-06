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
  const isAuthRoute =
    pathname.startsWith("/login") || pathname.startsWith("/auth");
  // Stripe webhook is signature-verified and must stay reachable without
  // a Supabase session.
  // /api/chat runs its own auth check and answers with JSON — it must not be
  // redirected to the HTML login page, or an expired session would stream
  // login-page markup back into the chat widget as an "answer".
  const isPublicApi =
    pathname.startsWith("/api/stripe") || pathname.startsWith("/api/chat");
  // Phase 0.6: the calculator landing page is public. Visitors can play
  // with the math; saving prompts an account. /loads, /history, /profile,
  // /admin remain auth-gated below.
  const isPublicPage = pathname === "/";

  if (!user && !isAuthRoute && !isPublicApi && !isPublicPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && pathname.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
