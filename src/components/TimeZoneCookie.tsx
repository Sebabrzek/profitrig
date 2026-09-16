"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { TZ_COOKIE } from "@/lib/loads";

/**
 * Tells the server what time zone the driver is in, so "today" is the
 * driver's day and not the server's UTC one. Renders nothing. When the zone
 * is new or has changed (a driver crossing into Mountain time) it saves it
 * and re-renders the page once with the right date.
 */
export function TimeZoneCookie() {
  const router = useRouter();

  useEffect(() => {
    let tz = "";
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
    } catch {
      return;
    }
    if (!tz) return;

    const saved = document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${TZ_COOKIE}=`))
      ?.slice(TZ_COOKIE.length + 1);
    if (saved === tz) return;

    // IANA names are cookie-safe as-is (letters, "/", "_", "-", "+").
    document.cookie = `${TZ_COOKIE}=${tz}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }, [router]);

  return null;
}
