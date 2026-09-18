"use client";

import type { ReactNode } from "react";

/**
 * One choice out of a few — the week a driver's pay runs, a billing
 * period. The chosen option is Rig Green: choosing is neutral, so it is
 * never Profit Green. Each option is a 44px button that says whether it is
 * pressed. Styles: globals.css, "Selection".
 */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled = false,
  block = false,
}: {
  /** What is being chosen, for screen readers. */
  label: string;
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  /** Stretch across the container, options sharing the width. */
  block?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`pr-segmented ${block ? "flex w-full" : ""}`}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={`pr-segment ${block ? "flex-1" : ""}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
