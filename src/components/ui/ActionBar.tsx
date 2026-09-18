import type { ReactNode } from "react";

/**
 * A page's persistent save bar. The shell positions it (.pr-action-bar in
 * globals.css): on the bottom nav on a phone, beside the sidebar on a
 * desktop. It stays quiet — white, a hairline top border, no shadow — so
 * the one action in it is what the eye lands on. Status on the left, the
 * action on the right, at every width.
 */
export function ActionBar({
  status,
  tone = "default",
  children,
}: {
  /** What saving does, or what just happened. Announced when it changes. */
  status: ReactNode;
  tone?: "default" | "success" | "error";
  children: ReactNode;
}) {
  const colour = {
    default: "text-muted",
    success: "font-semibold text-[var(--pr-rig-green)]",
    error: "text-[var(--pr-loss-deep)]",
  }[tone];
  return (
    <div className="pr-action-bar z-20 border-t border-border bg-white px-4 pt-3">
      <div className="pr-action-bar-inner flex items-center gap-3">
        <p role="status" className={`min-w-0 flex-1 text-xs leading-snug ${colour}`}>
          {status}
        </p>
        <div className="shrink-0">{children}</div>
      </div>
    </div>
  );
}
