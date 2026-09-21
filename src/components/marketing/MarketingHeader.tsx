import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { Wordmark } from "@/components/Wordmark";

/**
 * The public header, sitting on the hero's ivory field: the approved lockup
 * in its standard colours, and nothing behind it.
 *
 * "Use Free Calculator" is deliberately a button and not a nav link: the
 * calculator is the promise the page is making, and it stays one tap away
 * from the top of every screen size.
 */
export function MarketingHeader() {
  return (
    <header className="pr-mk-inner relative z-10 flex flex-wrap items-center gap-x-3 gap-y-3 pt-5 pb-2 sm:pt-6">
      <Link
        href="/"
        aria-label="ProfitRig home"
        className="shrink-0 rounded-[var(--pr-radius-button)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--pr-rig-green)]"
      >
        <Wordmark size="md" />
      </Link>

      <div className="ml-auto flex flex-wrap items-center gap-2 sm:gap-3">
        <Link
          href="/login"
          className="inline-flex min-h-11 items-center px-1 font-display text-sm font-semibold text-[var(--pr-rig-green)] transition-colors hover:text-[var(--pr-action-dark-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pr-rig-green)]"
        >
          Sign In
        </Link>
        <ButtonLink
          href="/calculator"
          variant="secondary"
          size="sm"
          className="whitespace-nowrap"
        >
          Use Free Calculator
        </ButtonLink>
        {/* On a phone the header keeps only the calculator: "Start Free" is
            a few hundred pixels below in the hero itself, and three wrapped
            rows of buttons would push the artwork off the screen. */}
        <ButtonLink
          href="/login"
          variant="primary"
          size="sm"
          className="hidden whitespace-nowrap sm:inline-flex"
        >
          Start Free
        </ButtonLink>
      </div>
    </header>
  );
}
