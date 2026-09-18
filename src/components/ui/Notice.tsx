import type { ReactNode } from "react";

/**
 * Two treatments, and only two:
 *
 *   tone="notice"  something the driver should set up, confirm or check.
 *                  White, hairline border, a Sage rule on the left, a Rig
 *                  Green title. Works on the Off White page and inside a
 *                  white card alike.
 *   tone="error"   an error, a failed save, a validation failure, or a real
 *                  financial loss. Loss Wash with Deep Loss text — the
 *                  board's alert, 5.35:1 contrast.
 *
 * Helper and explanatory copy is NOT a notice; it stays plain text. Amber and
 * yellow are not in the palette and are not used.
 */
export function Notice({
  tone = "notice",
  title,
  size = "md",
  className = "",
  children,
}: {
  tone?: "notice" | "error";
  title?: ReactNode;
  /** "sm" for a notice that sits under a single field or line. */
  size?: "md" | "sm";
  className?: string;
  children?: ReactNode;
}) {
  const surface =
    tone === "error"
      ? "bg-[var(--pr-loss-wash)] text-[var(--pr-loss-deep)]"
      : "border border-border border-l-[3px] border-l-[var(--pr-sage)] bg-white text-[var(--pr-text)]";
  const spacing = size === "sm" ? "px-3 py-2.5 text-xs" : "p-4 text-sm";
  return (
    <div
      // An error appears after the driver does something; say it aloud.
      role={tone === "error" ? "alert" : undefined}
      className={`rounded-[var(--pr-radius-input)] leading-snug ${surface} ${spacing} ${className}`}
    >
      {title && (
        <p
          className={`font-display font-bold ${
            tone === "error" ? "" : "text-[var(--pr-rig-green)]"
          }`}
        >
          {title}
        </p>
      )}
      {children != null && children !== false && (
        <div className={title ? "mt-1" : ""}>{children}</div>
      )}
    </div>
  );
}
