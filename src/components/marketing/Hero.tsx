import { ButtonLink } from "@/components/ui/Button";
import { MarketingHeader } from "./MarketingHeader";

/**
 * LEVEL 1 — the locked hero artwork, FinalHero1.
 *
 * The plate is placed and nothing is done to it: no mask, no dissolve, no
 * scrim, no tint, no mirror, no crop on the desktop frame. The fade from
 * engraving into open paper is drawn into the illustration itself, and the
 * page behind it is set to that same paper (#F9F7ED, read off the artwork's
 * own left third), so the plate bleeds into the page with no edge anywhere.
 *
 * The copy sits on the quiet ivory the artwork already leaves on the left.
 * Everything readable is live: lockup, navigation, headline, paragraph and
 * both buttons. Nothing is baked into the image.
 *
 * On a phone the plate becomes a band beneath the copy, framed on the
 * tractor — a phone has no room to spend on the open paper the desktop copy
 * needs — so the headline and both calls to action come first.
 */

const PLATE_AVIF =
  "/brand/hero-final-900.avif 900w, /brand/hero-final-1200.avif 1200w, /brand/hero-final-1672.avif 1672w";
const PLATE_WEBP =
  "/brand/hero-final-900.webp 900w, /brand/hero-final-1200.webp 1200w, /brand/hero-final-1672.webp 1672w";
const BAND_AVIF =
  "/brand/hero-final-mobile-640.avif 640w, /brand/hero-final-mobile-900.avif 900w, /brand/hero-final-mobile-1052.avif 1052w";
const BAND_WEBP =
  "/brand/hero-final-mobile-640.webp 640w, /brand/hero-final-mobile-900.webp 900w, /brand/hero-final-mobile-1052.webp 1052w";

const PLATE_ALT =
  "A custom long-hood tractor and trailer on a mountain highway, drawn as an engraving.";

export function Hero() {
  return (
    <section className="pr-hero">
      {/* Desktop: the plate is the field the copy sits on. */}
      <div className="pr-hero-plate hidden lg:block" aria-hidden="true">
        <picture>
          <source type="image/avif" sizes="100vw" srcSet={PLATE_AVIF} />
          <source type="image/webp" sizes="100vw" srcSet={PLATE_WEBP} />
          <img
            src="/brand/hero-final-1200.webp"
            alt=""
            width={1672}
            height={941}
            decoding="async"
            fetchPriority="high"
          />
        </picture>
      </div>

      <MarketingHeader />

      <div className="pr-hero-copy pr-mk-inner">
        <div className="pr-hero-copy-inner">
          <p className="pr-mk-eyebrow">American Iron × Financial Precision</p>
          <h1 className="pr-mk-h1 mt-4 text-[var(--pr-rig-green)]">
            Know your numbers.
            <br />
            Take control.
          </h1>
          <p className="pr-mk-lead mt-5 max-w-[21rem] text-[var(--pr-hero-muted)]">
            What a mile really costs, what a load really paid, and what is
            left at the end of the week.
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
          <p className="mt-4 max-w-[21rem] text-sm text-[var(--pr-hero-muted)]">
            The calculator is free and needs no account.
          </p>
        </div>
      </div>

      {/* Phones: the same plate, framed on the tractor, under the copy. */}
      <div className="pr-hero-band lg:hidden">
        <picture>
          <source type="image/avif" sizes="100vw" srcSet={BAND_AVIF} />
          <source type="image/webp" sizes="100vw" srcSet={BAND_WEBP} />
          <img
            src="/brand/hero-final-mobile-900.webp"
            alt={PLATE_ALT}
            width={1052}
            height={660}
            decoding="async"
            fetchPriority="high"
          />
        </picture>
      </div>
    </section>
  );
}
