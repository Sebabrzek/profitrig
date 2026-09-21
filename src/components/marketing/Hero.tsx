import { ButtonLink } from "@/components/ui/Button";
import { MarketingHeader } from "./MarketingHeader";

/**
 * LEVEL 1 — the American Iron plate, on paper.
 *
 * Ivory field on the left carrying real HTML, the single-truck engraving on
 * the right. Nothing is baked into the artwork: the lockup, the navigation,
 * the headline, the copy and both buttons are all live text and controls.
 *
 * There is no scrim. The plate keeps its own ivory sky and the field behind
 * the copy is that same paper colour, so the two meet as one surface; where
 * they meet, four bands of ivory hatching dissolve the plate's edge in hard
 * steps (globals.css, "THE HERO"). Engraving, not a gradient.
 *
 * On a phone the plate becomes a band beneath the copy — a deliberate crop
 * framed on the tractor, not the desktop plate shrunk — so the headline and
 * both calls to action come first and nothing sits behind the text.
 *
 * The opening visual is the only image on the page fetched eagerly.
 */

const DESKTOP_AVIF =
  "/brand/hero-single-900.avif 900w, /brand/hero-single-1200.avif 1200w, /brand/hero-single-1500.avif 1500w, /brand/hero-single-1774.avif 1774w";
const DESKTOP_WEBP =
  "/brand/hero-single-900.webp 900w, /brand/hero-single-1200.webp 1200w, /brand/hero-single-1500.webp 1500w, /brand/hero-single-1774.webp 1774w";
const MOBILE_AVIF =
  "/brand/hero-single-mobile-640.avif 640w, /brand/hero-single-mobile-960.avif 960w, /brand/hero-single-mobile-1220.avif 1220w";
const MOBILE_WEBP =
  "/brand/hero-single-mobile-640.webp 640w, /brand/hero-single-mobile-960.webp 960w, /brand/hero-single-mobile-1220.webp 1220w";

export function Hero() {
  return (
    <section className="pr-hero">
      <MarketingHeader />

      <div className="pr-hero-body">
        <div className="pr-hero-copy">
          <div className="pr-hero-copy-inner">
            <p className="pr-mk-eyebrow">American Iron × Financial Precision</p>
            <h1 className="pr-mk-h1 mt-4 text-[var(--pr-rig-green)]">
              Know your numbers.
              <br />
              Take control.
            </h1>
            <p className="pr-mk-lead mt-5 text-[var(--pr-text)]">
              ProfitRig tells an owner-operator what a mile really costs, what
              a load really paid, and what is left at the end of the week.
              Your numbers, worked out from what you actually spent.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <ButtonLink href="/login" variant="primary" className="sm:w-auto">
                Start Free
              </ButtonLink>
              <ButtonLink
                href="/calculator"
                variant="secondary"
                className="sm:w-auto"
              >
                Use Free Calculator
              </ButtonLink>
            </div>
            <p className="mt-4 text-sm text-[var(--pr-hero-muted)]">
              The calculator is free and needs no account.
            </p>
          </div>
        </div>

        <div className="pr-hero-plate">
          <picture>
            <source
              type="image/avif"
              media="(min-width: 1024px)"
              sizes="50vw"
              srcSet={DESKTOP_AVIF}
            />
            <source
              type="image/webp"
              media="(min-width: 1024px)"
              sizes="50vw"
              srcSet={DESKTOP_WEBP}
            />
            <source type="image/avif" sizes="100vw" srcSet={MOBILE_AVIF} />
            <source type="image/webp" sizes="100vw" srcSet={MOBILE_WEBP} />
            <img
              src="/brand/hero-single-mobile-960.webp"
              alt="A custom long-hood tractor and trailer on a mountain highway, drawn as an engraving."
              width={1774}
              height={887}
              decoding="async"
              fetchPriority="high"
            />
          </picture>
          <div className="pr-hero-seam" aria-hidden="true" />
        </div>
      </div>
      <hr className="pr-mk-rule" />
    </section>
  );
}
