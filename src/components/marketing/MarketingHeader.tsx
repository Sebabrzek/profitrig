import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { Wordmark } from "@/components/Wordmark";

/**
 * The public header. It sits on the hero's Rig Green band, so it carries the
 * approved reversed lockup and has no surface of its own.
 *
 * "Use Free Calculator" is deliberately a button and not a nav link: the
 * calculator is the promise the page is making, and it stays one tap away
 * from the top of every screen size.
 */
export function MarketingHeader() {
  return (
    <header className="pr-mk-inner flex flex-wrap items-center gap-x-3 gap-y-3 pt-5 pb-2 sm:pt-6">
      <Link
        href="/"
        aria-label="ProfitRig home"
        className="shrink-0 rounded-[var(--pr-radius-button)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--pr-sage)]"
      >
        <Wordmark size="md" tone="dark" />
      </Link>

      <div className="ml-auto flex flex-wrap items-center gap-2 sm:gap-3">
        <Link
          href="/login"
          className="inline-flex min-h-11 items-center px-1 font-display text-sm font-semibold text-white/80 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pr-sage)]"
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
