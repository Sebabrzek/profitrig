"use client";

import { useEffect, useState } from "react";

type Announcement = { id: string; title: string; body: string };

/**
 * News from ProfitRig at the top of the page — the same announcement Sebastian
 * emails, for every signed-in driver, emails or not. Fetched after the page
 * shows, so it never slows a page down. Closing it closes it everywhere.
 */
export function AnnouncementBanner() {
  const [item, setItem] = useState<Announcement | null>(null);

  useEffect(() => {
    let gone = false;
    fetch("/api/announcements", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!gone && d?.announcement) setItem(d.announcement as Announcement);
      })
      .catch(() => {
        // No banner is fine.
      });
    return () => {
      gone = true;
    };
  }, []);

  if (!item) return null;
  return (
    <div role="status" className="pr-announcement mb-4 flex items-start justify-between gap-3 rounded-[var(--pr-radius-card)] border border-border bg-white px-4 py-3">
      <div className="min-w-0 text-sm leading-snug">
        <p className="font-display font-bold text-[var(--pr-rig-green)]">{item.title}</p>
        <p className="mt-0.5">{item.body}</p>
      </div>
      <button
        type="button"
        className="pr-link pr-hit shrink-0 text-sm"
        onClick={() => {
          const id = item.id;
          setItem(null);
          fetch("/api/announcements", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id }),
          }).catch(() => {});
        }}
      >
        Close
      </button>
    </div>
  );
}
