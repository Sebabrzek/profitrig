/**
 * Landing headline for signed-out visitors (cold ad traffic).
 * Sits above the calculator so the tool stays instantly usable — the
 * visitor was promised a free calculator, so we deliver it immediately
 * and just frame it. Phase 5 kept that promise deliberately: no brand
 * band, no illustration, nothing between the visitor and the numbers.
 *
 * Rig Green carries the headline and the ticks. Profit Green is reserved
 * for the one action on the page and for money that is actually earned,
 * so it is not spent on a subheading.
 */
export function VisitorHero() {
  return (
    <div className="pt-1 pb-5">
      <h1 className="font-display text-[length:var(--pr-text-xl)] sm:text-[length:var(--pr-text-2xl)] lg:text-[length:var(--pr-text-3xl)] font-bold leading-tight tracking-tight">
        Free Rate Per Mile Calculator
        <span className="block text-[var(--pr-rig-green)]">
          for Owner Operators
        </span>
      </h1>
      <p className="text-sm sm:text-base text-muted mt-2.5 leading-snug max-w-[68ch]">
        Know your true break-even in about two minutes. Put in your real
        numbers and see the lowest rate you can haul for without losing
        money.
      </p>
      <div className="flex flex-wrap gap-x-5 gap-y-2 mt-3.5">
        <Check>Free to use</Check>
        <Check>No credit card</Check>
        <Check>No signup to try it</Check>
      </div>
    </div>
  );
}

function Check({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-[var(--pr-rig-green)] shrink-0"
        aria-hidden="true"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
      {children}
    </span>
  );
}
