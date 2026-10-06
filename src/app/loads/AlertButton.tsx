"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setLoadCheckAction } from "../actions";

/**
 * "This is right" on one alert — or "Undo" on one already marked. The mark
 * is the alert's exact wording, so a later change to the load's figures
 * brings the alert back by itself.
 */
export function MarkRightButton({
  loadId,
  wording,
  confirmed = false,
}: {
  loadId: string;
  wording: string;
  confirmed?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2">
      <button
        type="button"
        className="pr-link pr-hit text-sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await setLoadCheckAction(loadId, wording, !confirmed);
            if (!r.ok) setError(r.error);
            else router.refresh();
          })
        }
      >
        {pending ? "Saving…" : confirmed ? "Undo" : "This is right"}
      </button>
      {error && (
        <span role="alert" className="text-xs text-[var(--pr-loss-deep)]">
          {error}
        </span>
      )}
    </span>
  );
}
