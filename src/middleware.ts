import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Static image formats never need a session. AVIF belongs here with the
    // rest: without it the marketing hero's AVIF sources were answered with
    // a redirect to /login, and the browser, having already committed to
    // that <source>, showed nothing at all.
    "/((?!_next/static|_next/image|favicon.ico|icons/|brand/|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)",
  ],
};
