"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "profitrig.profileBannerDismissed";

export function ProfileBanner({ profileComplete }: { profileComplete: boolean }) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (profileComplete) return;
    try {
      setDismissed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, [profileComplete]);

  if (profileComplete || dismissed) return null;

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {}
    setDismissed(true);
  }

  return (
    <div className="bg-brand-soft border border-brand/30 rounded-2xl p-4 mb-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-sm">
            Finish your profile in 30 seconds
          </p>
          <p className="text-xs text-foreground/80 mt-0.5">
            Add your name, phone, and what you haul so HelloTrucker can send
            tips matched to your operation.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 text-xs text-muted hover:text-foreground px-2"
          aria-label="Dismiss"
        >
          Later
        </button>
      </div>
      <div className="mt-3">
        <Link
          href="/profile"
          className="inline-flex items-center justify-center h-10 px-4 rounded-xl bg-brand hover:bg-brand-dark text-white font-semibold text-sm"
        >
          Open profile
        </Link>
      </div>
    </div>
  );
}
