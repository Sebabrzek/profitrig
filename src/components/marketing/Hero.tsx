import { ButtonLink } from "@/components/ui/Button";
import { MarketingHeader } from "./MarketingHeader";

/**
 * LEVEL 1 — the hero artwork, HERO2edited.
 *
 * The plate is placed and nothing is done to it: no mask, no dissolve, no
 * scrim, no tint, no mirror. Its edges are already faded to its own paper,
 * and the page behind it is set to that same stock (#F9F7ED), so the plate
 * has no edge anywhere — it simply stops being ink.
 *
 * The tractor is centred, so the copy is centred above it, in the open sky
 * the artwork keeps almost free of ink (0.00% across its top third). Every
 * word and control is live HTML; nothing is baked into the image.
 *
 * On a phone the plate becomes a band beneath the copy, cropped close on the
 * tractor — at 2.4:1 the full plate would leave it too small to read — so
 * the headline and both calls to action come first.
 */

const PLATE_AVIF =
  "/brand/hero2-1000.avif 1000w, /brand/hero2-1400.avif 1400w, /brand/hero2-1942.avif 1942w";
const PLATE_WEBP =
  "/brand/hero2-1000.webp 1000w, /brand/hero2-1400.webp 1400w, /brand/hero2-1942.webp 1942w";
const BAND_AVIF =
  "/brand/hero2-mobile-560.avif 560w, /brand/hero2-mobile-840.avif 840w, /brand/hero2-mobile-1080.avif 1080w";
const BAND_WEBP =
  "/brand/hero2-mobile-560.webp 560w, /brand/hero2-mobile-840.webp 840w, /brand/hero2-mobile-1080.webp 1080w";

const PLATE_ALT =
  "A custom long-hood tractor and trailer on an open highway, drawn as an engraving.";

export function Hero() {
  return (
    <section className="pr-hero">
      {/* Desktop: the plate sits against the bottom, the copy in its sky. */}
      <div className="pr-hero-plate hidden lg:block" aria-hidden="true">
        <picture>
          <source type="image/avif" sizes="100vw" srcSet={PLATE_AVIF} />
          <source type="image/webp" sizes="100vw" srcSet={PLATE_WEBP} />
          <img
            src="/brand/hero2-1400.webp"
            alt=""
            width={1942}
            height={809}
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
          <p className="pr-mk-lead pr-hero-note mt-5 max-w-[30rem] text-[var(--pr-hero-muted)]">
            What a mile really costs, what a load really paid, and what is
            left at the end of the week.
          </p>
          <div className="pr-hero-actions mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
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
          <p className="pr-hero-note mt-4 max-w-[30rem] text-sm text-[var(--pr-hero-muted)]">
            The calculator is free and needs no account.
          </p>
        </div>
      </div>

      {/* Phones: the tractor, framed close, under the copy. */}
      <div className="pr-hero-band lg:hidden">
        <picture>
          <source type="image/avif" sizes="100vw" srcSet={BAND_AVIF} />
          <source type="image/webp" sizes="100vw" srcSet={BAND_WEBP} />
          <img
            src="/brand/hero2-mobile-840.webp"
            alt={PLATE_ALT}
            width={854}
            height={615}
            decoding="async"
            fetchPriority="high"
          />
        </picture>
      </div>
    </section>
  );
}
