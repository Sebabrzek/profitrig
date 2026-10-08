"use client";

import { useState, useTransition } from "react";
import { Card, CardHeader } from "@/components/ui/Surfaces";
import { Notice } from "@/components/ui/Notice";
import { setProductUpdatesAction } from "../emailPrefsActions";

/** Whether ProfitRig may email this driver its news. Their choice always wins. */
export function EmailPreferencesCard({ productUpdates, unsubscribed }: { productUpdates: boolean; unsubscribed: boolean }) {
  const [on, setOn] = useState(productUpdates);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  return (
    <Card>
      <CardHeader
        title="Emails from ProfitRig"
        description="Invoices and anything you send yourself always go out. This is only about news from us."
      />
      <label className="flex items-start gap-3">
        <input
          id="product-updates"
          type="checkbox"
          className="mt-1 h-5 w-5 rounded border-border accent-[var(--pr-rig-green)]"
          checked={on}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.checked;
            setOn(next);
            setError(null);
            setSaved(false);
            start(async () => {
              const r = await setProductUpdatesAction(next);
              if (!r.ok) {
                setOn(!next);
                setError(r.error);
              } else setSaved(true);
            });
          }}
        />
        <span className="text-sm">
          <span className="font-semibold">New features and updates</span>
          <br />
          <span className="text-muted">What&apos;s new in ProfitRig, a few times a month at most.</span>
        </span>
      </label>
      {unsubscribed && !on && (
        <p className="mt-2 text-xs text-muted">You unsubscribed from one of our emails. Tick the box to get them again.</p>
      )}
      {saved && (
        <p role="status" className="mt-2 text-xs font-semibold text-[var(--pr-rig-green)]">
          Saved
        </p>
      )}
      {error && (
        <Notice tone="error" className="mt-3">
          {error}
        </Notice>
      )}
    </Card>
  );
}
