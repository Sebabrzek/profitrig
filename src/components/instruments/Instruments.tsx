import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

/**
 * ProfitRig's financial instruments (design system §8–9, component board 02).
 *
 *   InstrumentPanel   the dark Rig Green surface where ProfitRig presents an
 *                     answer. Flat: no gradient, no boxes inside, no red
 *                     panel for a loss.
 *   Reading           one measurement: small label, the number, one line of
 *                     context. Works on the dark panel and on light cards.
 *   ReadingGrid       the secondary readings under a hero reading, separated
 *                     by a hairline rather than by boxes.
 *   StatTile          a single reading on a white tile (Tax, Admin).
 *
 * Colour never carries the meaning alone. A profit is its signed number,
 * "+$987.33", and nothing more. A loss is "−$142" with "↓ LOSS" and a Loss
 * Red bar, while the panel stays Rig Green and the number stays Off White
 * (Loss Red on Rig Green fails contrast; see LOGO_AND_COMPONENT_GUIDE.md).
 *
 * JetBrains Mono (`figure`) is for financial answers — money, rates, MPG.
 * Counts and miles are readings too, but stay in Inter.
 */

type Outcome = "profit" | "loss";

export function InstrumentPanel({ children }: { children: ReactNode }) {
  return (
    <div className="pr-instrument @container mb-4 rounded-[var(--pr-radius-large)] bg-[var(--pr-surface-dark)] p-5 text-[var(--pr-text-dark-surface)] sm:p-6">
      {children}
    </div>
  );
}

/** A line under the readings: totals, footnotes — already-present context. */
export function PanelNote({ children }: { children: ReactNode }) {
  return (
    <p className="mt-4 text-[13px] leading-snug text-[var(--pr-reading-context)]">
      {children}
    </p>
  );
}

export function ReadingGrid({
  children,
  wideColumns = 3,
}: {
  children: ReactNode;
  /** Columns once the panel is 560px or wider; two below that. */
  wideColumns?: 2 | 3;
}) {
  return (
    <div
      className={`mt-5 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-[var(--pr-reading-rule)] pt-5 ${
        wideColumns === 3 ? "@min-[560px]:grid-cols-3" : ""
      }`}
    >
      {children}
    </div>
  );
}

export function Reading({
  label,
  value,
  unit,
  context,
  outcome,
  size = "secondary",
  figure = true,
  fullRowWhenNarrow = false,
  children,
}: {
  label: ReactNode;
  /** Already formatted (lib/format). */
  value: string;
  /** Smaller suffix: "MPG", "/ mi". */
  unit?: string;
  context?: ReactNode;
  outcome?: Outcome;
  size?: "hero" | "secondary";
  /** JetBrains Mono. False for counts and miles. */
  figure?: boolean;
  /** Take the whole row while the grid has two columns. */
  fullRowWhenNarrow?: boolean;
  /** Extra controls under the number (e.g. the MANUAL override). */
  children?: ReactNode;
}) {
  const hero = size === "hero";
  // Sizing lives in globals.css (.pr-reading-value): full size whenever the
  // number fits its column, shrinking only when it would not.
  const chars = value.length + (unit ? unit.length + 1 : 0);
  return (
    <div
      className={`pr-reading min-w-0 ${
        fullRowWhenNarrow ? "col-span-2 @min-[560px]:col-span-1" : ""
      }`}
    >
      <p className="font-display text-[12px] font-semibold uppercase leading-tight tracking-[0.06em] text-[var(--pr-reading-label)]">
        {label}
      </p>
      <p
        className={`pr-reading-value mt-1.5 whitespace-nowrap leading-none text-[var(--pr-reading-value)] ${
          figure ? "pr-figure" : "font-sans"
        } ${hero ? "is-hero font-bold" : figure ? "font-semibold" : "font-bold"}`}
        style={{ "--pr-chars": chars } as CSSProperties}
      >
        {value}
        {unit && (
          <span
            className={`ml-1.5 font-semibold ${
              hero ? "text-[18px]" : "text-[13px]"
            } text-[var(--pr-reading-context)]`}
          >
            {unit}
          </span>
        )}
      </p>
      {(outcome === "loss" || context) && (
        <p
          className={`${hero ? "mt-2.5 text-[14px]" : "mt-1.5 text-[13px]"} leading-snug text-[var(--pr-reading-context)]`}
        >
          {outcome === "loss" && <LossTag />}
          {outcome === "loss" && context ? " · " : null}
          {context}
        </p>
      )}
      {children}
      {outcome === "loss" && (
        <span
          aria-hidden="true"
          className="mt-3 block h-[3px] rounded-full bg-[var(--pr-loss)]"
        />
      )}
    </div>
  );
}

// A profit needs no tag: its "+" sign says it. A loss says it three ways.
function LossTag() {
  return (
    <span className="font-display font-bold uppercase tracking-[0.06em]">
      <span aria-hidden="true">↓ </span>
      Loss
    </span>
  );
}

/** A single reading on a white tile. Optionally a link into its section. */
export function StatTile({
  href,
  ...reading
}: Omit<Parameters<typeof Reading>[0], "size" | "fullRowWhenNarrow"> & {
  href?: string;
}) {
  const body = <Reading {...reading} />;
  const tile =
    "block rounded-[var(--pr-radius-card)] border border-border bg-white p-4";
  return href ? (
    <Link
      href={href}
      className={`${tile} transition-colors hover:border-[var(--pr-rig-green)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pr-rig-green)]`}
    >
      {body}
    </Link>
  ) : (
    <div className={tile}>{body}</div>
  );
}
