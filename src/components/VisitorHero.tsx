/**
 * Landing headline for signed-out visitors (cold ad traffic).
 * Sits above the calculator so the tool stays instantly usable — the
 * visitor was promised a free calculator, so we deliver it immediately
 * and just frame it.
 */
export function VisitorHero() {
  return (
    <div className="max-w-2xl mx-auto px-4 pt-5 pb-1">
      <h1 className="text-2xl sm:text-3xl font-black leading-tight tracking-tight">
        Free Rate Per Mile Calculator
        <span className="block text-brand">for Owner Operators</span>
      </h1>
      <p className="text-sm sm:text-base text-muted mt-2 leading-snug">
        Know your true break-even in about two minutes. Put in your real
        numbers and see the lowest rate you can haul for without losing
        money.
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
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
        className="text-brand shrink-0"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
      {children}
    </span>
  );
}
