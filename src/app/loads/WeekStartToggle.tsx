"use client";

import { useState, useTransition } from "react";
import { saveWeekStartAction } from "../actions";
import type { WeekStart } from "@/lib/loads";

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
        <div className="inline-flex rounded-lg border border-border bg-white p-0.5">
          {OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              aria-pressed={selected === o.value}
              disabled={pending}
              onClick={() => choose(o.value)}
              className={`px-2.5 py-1 rounded-md font-semibold transition disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                selected === o.value
                  ? "bg-brand text-white"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
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
