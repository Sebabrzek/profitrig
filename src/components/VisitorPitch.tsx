import Link from "next/link";

/**
 * Conversion section shown to signed-out visitors BELOW the calculator.
 * By this point they've seen their own number — this is the "now what?"
 * moment, so it pitches the paid tracker rather than re-explaining the
 * calculator.
 */
export function VisitorPitch() {
  return (
    <div className="mt-6 space-y-4">
      <div className="bg-white border border-border rounded-2xl p-5">
        <h2 className="text-xl font-black leading-tight">
          You know your number. Now make sure every load beats it.
        </h2>
        <p className="text-sm text-muted mt-1.5 leading-snug">
          Knowing your cost per mile is step one. ProfitRig Pro tracks what
          you actually made, load by load, so the number stops being a guess.
        </p>

        <ul className="mt-4 space-y-3.5">
          <Feature title="Every load, real profit">
            Log a load in under a minute. See what you truly cleared after
            fuel, tolls, lumpers, and that load&apos;s share of your monthly
            bills — not just gross pay.
          </Feature>
          <Feature title="Your week and month, always current">
            Monday-to-Sunday totals that match how you actually get settled.
            Export to Excel or Google Sheets any time.
          </Feature>
          <Feature title="Tax records your accountant can use">
            Categorized expenses, per diem nights, and capital purchases kept
            separate — with a clean year-end report to hand over. Organized
            records, not tax advice.
          </Feature>
          <Feature title="Ask ProfitRig, built in">
            Not sure where something goes? Ask in plain English and get an
            answer without digging through a help site.
          </Feature>
        </ul>
      </div>

      <div className="bg-gradient-to-br from-brand to-brand-dark text-white rounded-2xl p-5">
        <p className="text-xs uppercase tracking-wider opacity-80 font-semibold">
          ProfitRig Pro
        </p>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0 mt-1">
          <span className="text-4xl font-black leading-none">$99</span>
          <span className="text-base font-semibold opacity-90">/ year</span>
          <span className="text-sm opacity-75">or $9.99 / month</span>
        </div>
        <p className="text-sm mt-2 opacity-90 leading-snug">
          Try it free for 7 days. Cancel any time from your profile — no
          phone call, no runaround.
        </p>
        <Link
          href="/login"
          className="mt-4 h-12 w-full inline-flex items-center justify-center rounded-xl bg-white text-brand-dark font-bold hover:bg-brand-soft transition"
        >
          Create free account
        </Link>
        <p className="text-xs opacity-75 mt-2 text-center">
          The calculator stays free either way.
        </p>
      </div>
    </div>
  );
}

function Feature({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="shrink-0 mt-0.5 text-brand">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
      <div>
        <p className="text-sm font-bold leading-snug">{title}</p>
        <p className="text-sm text-muted leading-snug mt-0.5">{children}</p>
      </div>
    </li>
  );
}
