"use client";

import { useState, useTransition } from "react";
import { saveWeekStartAction } from "../actions";
import type { WeekStart } from "@/lib/loads";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

const OPTIONS: { value: WeekStart; label: string }[] = [
  { value: "monday", label: "Mon–Sun" },
  { value: "sunday", label: "Sun–Sat" },
];

export function WeekStartToggle({ value }: { value: WeekStart }) {
  const [selected, setSelected] = useState<WeekStart>(value);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function choose(next: WeekStart) {
    if (next === selected || pending) return;
    const previous = selected;
    setSelected(next);
    setError("");
    startTransition(async () => {
      const res = await saveWeekStartAction(next);
      if (!res.ok) {
        setSelected(previous);
        setError(res.error);
      }
    });
  }

  return (
    <div className="mb-3 text-center">
      <div className="inline-flex items-center gap-2 text-xs">
        <span className="text-muted">Your week runs</span>
        <SegmentedControl
          label="Your week runs"
          options={OPTIONS}
          value={selected}
          onChange={choose}
          disabled={pending}
        />
      </div>
      <p className="text-[11px] text-muted mt-1">
        {error ? (
          <span role="alert" className="text-[var(--pr-loss-deep)] font-semibold">
            {error}
          </span>
        ) : (
          "Leased? Pick the days your settlement covers."
        )}
      </p>
    </div>
  );
}
