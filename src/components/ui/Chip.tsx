import type { ReactNode } from "react";

/**
 * A compact status label (design system §13, component board 03). A chip
 * states something that is true — a plan, an override, a data flag — and is
 * never a button or a link.
 *
 *   neutral  Off White with Rig Green text — the board's PROFITABLE / PAID
 *   loss     Loss Wash with Deep Loss text — the board's LOSS; also used for
 *            ProfitRig's own validation flags
 *   onDark   for Rig Green surfaces (the Calculator's MANUAL chip is drawn
 *            this way inside its locked 3a panel)
 *
 * The words carry the meaning; the colour only reinforces it.
 */
export function Chip({
  tone = "neutral",
  title,
  children,
}: {
  tone?: "neutral" | "loss" | "onDark";
  /** A longer explanation on hover. */
  title?: string;
  children: ReactNode;
}) {
  const colours = {
    neutral: "bg-pr-surface-muted text-[var(--pr-rig-green)]",
    loss: "bg-[var(--pr-loss-wash)] text-[var(--pr-loss-deep)]",
    onDark:
      "border border-[var(--pr-border-dark)] bg-white/10 text-[var(--pr-off-white)]",
  }[tone];
  return (
    <span
      title={title}
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 font-display text-[11px] font-bold uppercase leading-4 tracking-[0.06em] ${colours}`}
    >
      {children}
    </span>
  );
}
