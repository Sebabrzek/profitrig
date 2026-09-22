import { ButtonLink } from "@/components/ui/Button";
import { MarketingHeader } from "./MarketingHeader";

/**
 * LEVEL 1 — the hero, built as a poster around Hero4edited.
 *
 * The artwork is a studio portrait of the tractor on plain paper, not a
 * landscape, so there is no scene to sit inside. Instead the statement is
 * set across the top, the tractor stands in front of it, and the actions sit
 * on clean paper beneath.
 *
 * From 1024px the headline is behind the truck. The plate's background has
 * been knocked out to transparency — the drawing is untouched — and across
 * its top quarter the only ink is two exhaust stacks roughly 2% of the width
 * each, plus two hair-thin antennas. They cross the words the way a real
 * object crosses something behind it, which is the whole idea.
 *
 * Phones get the plain order: headline, tractor, actions. At that width the
 * stacks would cut the type instead of layering with it.
 *
 * Everything readable is live HTML. Nothing is baked into the image.
 */

const TRUCK_AVIF =
  "/brand/hero4-truck-720.avif 720w, /brand/hero4-truck-1000.avif 1000w, /brand/hero4-truck-1400.avif 1400w";
const TRUCK_WEBP =
  "/brand/hero4-truck-720.webp 720w, /brand/hero4-truck-1000.webp 1000w, /brand/hero4-truck-1400.webp 1400w";
const TRUCK_MOBILE_AVIF =
  "/brand/hero4-truck-mobile-520.avif 520w, /brand/hero4-truck-mobile-780.avif 780w, /brand/hero4-truck-mobile-1040.avif 1040w";
const TRUCK_MOBILE_WEBP =
  "/brand/hero4-truck-mobile-520.webp 520w, /brand/hero4-truck-mobile-780.webp 780w, /brand/hero4-truck-mobile-1040.webp 1040w";

const TRUCK_ALT =
  "A custom long-hood conventional tractor, drawn as an engraving.";

export function Hero() {
  return (
    <section className="pr-hero">
      <MarketingHeader />

      <div className="pr-hero-stage">
        <div className="pr-hero-words">
          <div className="pr-hero-words-inner">
            <p className="pr-mk-eyebrow">American Iron × Financial Precision</p>
            <h1 className="pr-mk-h1 mt-3 text-[var(--pr-rig-green)]">
              Know your numbers.
              <br />
              Take control.
            </h1>
          </div>
        </div>

        <picture>
          <source
            type="image/avif"
            media="(min-width: 1024px)"
            sizes="min(92vw, 1120px)"
            srcSet={TRUCK_AVIF}
          />
          <source
            type="image/webp"
            media="(min-width: 1024px)"
            sizes="min(92vw, 1120px)"
            srcSet={TRUCK_WEBP}
          />
          <source
            type="image/avif"
            sizes="92vw"
            srcSet={TRUCK_MOBILE_AVIF}
          />
          <source
            type="image/webp"
            sizes="92vw"
            srcSet={TRUCK_MOBILE_WEBP}
          />
          <img
            className="pr-hero-truck"
            src="/brand/hero4-truck-1000.webp"
            alt={TRUCK_ALT}
            width={1424}
            height={771}
            decoding="async"
            fetchPriority="high"
          />
        </picture>
      </div>

      <div className="pr-hero-below pr-mk-inner">
        <p className="pr-mk-lead pr-hero-note max-w-[34rem] text-[var(--pr-mk-paper-muted)]">
          What a mile really costs, what a load really paid, and what is left
          at the end of the week.
        </p>
        <div className="pr-hero-actions">
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
        <p className="pr-hero-note mt-4 max-w-[34rem] text-sm text-[var(--pr-mk-paper-muted)]">
          The calculator is free and needs no account.
        </p>
      </div>
    </section>
  );
}
