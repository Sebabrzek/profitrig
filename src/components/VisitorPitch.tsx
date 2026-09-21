import { ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Surfaces";

/**
 * Conversion section shown to signed-out visitors BELOW the calculator.
 * By this point they've seen their own number — this is the "now what?"
 * moment, so it pitches the paid tracker rather than re-explaining the
 * calculator.
 *
 * The plan panel is flat Rig Green: a dark surface carries meaning here
 * (what Pro is), and gradients are not part of the system. The price is
 * Satoshi, not JetBrains Mono — mono is what a driver's own operating
 * numbers look like, and what ProfitRig charges is not one of them.
 */
export function VisitorPitch() {
  return (
    <div className="mt-6 space-y-4">
      <Card>
        <CardHeader
          title="You know your number. Now make sure every load beats it."
          description="Knowing your cost per mile is step one. ProfitRig Pro tracks what you actually made, load by load, so the number stops being a guess."
        />

        <ul className="space-y-3.5">
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
      </Card>

      <section className="rounded-[var(--pr-radius-card)] bg-[var(--pr-surface-dark)] text-white p-4 sm:p-5 lg:p-6">
        <p className="font-display text-xs font-bold uppercase tracking-[0.12em] text-[var(--pr-sage)]">
          ProfitRig Pro
        </p>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0 mt-2">
          <span className="font-display text-[length:var(--pr-text-3xl)] font-bold leading-none tracking-tight">
            $99
          </span>
          <span className="font-display text-base font-bold">/ year</span>
          <span className="text-sm text-[var(--pr-sage)]">
            or $9.99 / month
          </span>
        </div>
        <p className="text-sm mt-3 leading-snug text-white/90">
          Try it free for 7 days. Cancel any time from your profile — no
          phone call, no runaround.
        </p>
        <ButtonLink href="/login" variant="secondary" block className="mt-5">
          Create free account
        </ButtonLink>
        <p className="text-xs text-[var(--pr-sage)] mt-2.5 text-center">
          The calculator stays free either way.
        </p>
      </section>
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
      <span className="shrink-0 mt-0.5 text-[var(--pr-rig-green)]">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
      <div>
        <p className="font-display text-sm font-bold leading-snug">{title}</p>
        <p className="text-sm text-muted leading-snug mt-0.5">{children}</p>
      </div>
    </li>
  );
}
