"use client";

import { Notice } from "@/components/ui/Notice";
import { Button, ButtonLink } from "@/components/ui/Button";
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
    <Notice className="mb-4">
      <p className="font-display font-bold text-[var(--pr-rig-green)]">
        Finish your profile in 30 seconds
      </p>
      <p className="text-xs mt-0.5">
        Add your name, phone, and what you haul so ProfitRig can send tips
        matched to your operation.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <ButtonLink href="/profile" variant="dark" size="sm">
          Open profile
        </ButtonLink>
        <Button variant="secondary" size="sm" onClick={dismiss}>
          Later
        </Button>
      </div>
    </Notice>
  );
}
