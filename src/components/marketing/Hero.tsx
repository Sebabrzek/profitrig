import { ButtonLink } from "@/components/ui/Button";
import { MarketingHeader } from "./MarketingHeader";

/**
 * LEVEL 1 — one engraved composition, printed on ivory paper.
 *
 * The plate is not a picture beside the copy: it spans the whole hero and
 * dissolves into the page toward the left, so the mountains, road and
 * engraving lines carry faintly across behind the words and there is no
 * edge where "the image starts". That dissolve is baked into the plate's
 * own alpha channel — an irregular, noise-driven stipple across the middle
 * third of the frame — so nothing masks or filters anything at runtime.
 *
 * The artwork is mirrored from the approved master so the tractor holds the
 * lower right and the valley opens under the copy. Proportions are
 * untouched; only the handedness changes.
 *
 * Everything readable is live: the lockup, the navigation, the headline, the
 * paragraph and both buttons. Nothing is baked into the image.
 *
 * On a phone the plate leaves the background and becomes a band beneath the
 * copy, its top edge dissolving into the same paper, so the headline and
 * both calls to action come first with nothing behind them.
 */

const PLATE_AVIF =
  "/brand/hero-plate-1200.avif 1200w, /brand/hero-plate-1700.avif 1700w, /brand/hero-plate-2100.avif 2100w";
const PLATE_WEBP =
  "/brand/hero-plate-1200.webp 1200w, /brand/hero-plate-1700.webp 1700w, /brand/hero-plate-2100.webp 2100w";
const BAND_AVIF =
  "/brand/hero-plate-mobile-640.avif 640w, /brand/hero-plate-mobile-960.avif 960w, /brand/hero-plate-mobile-1220.avif 1220w";
const BAND_WEBP =
  "/brand/hero-plate-mobile-640.webp 640w, /brand/hero-plate-mobile-960.webp 960w, /brand/hero-plate-mobile-1220.webp 1220w";

const PLATE_ALT =
  "A custom long-hood tractor and trailer on a mountain highway, drawn as an engraving.";

export function Hero() {
  return (
    <section className="pr-hero">
      {/* Desktop: the plate is the field the copy sits on. */}
      <div className="pr-hero-plate hidden xl:block" aria-hidden="true">
        <picture>
          <source type="image/avif" sizes="100vw" srcSet={PLATE_AVIF} />
          <source type="image/webp" sizes="100vw" srcSet={PLATE_WEBP} />
          <img
            src="/brand/hero-plate-1700.webp"
            alt=""
            width={2394}
            height={1097}
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
          <p className="pr-mk-lead mt-5 max-w-[26rem] text-[var(--pr-hero-muted)]">
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
          <p className="mt-4 max-w-[26rem] text-sm text-[var(--pr-hero-muted)]">
            The calculator is free and needs no account.
          </p>
        </div>
      </div>

      {/* Phones: the same plate, framed on the tractor, under the copy. */}
      <div className="pr-hero-band xl:hidden">
        <picture>
          <source type="image/avif" sizes="100vw" srcSet={BAND_AVIF} />
          <source type="image/webp" sizes="100vw" srcSet={BAND_WEBP} />
          <img
            src="/brand/hero-plate-mobile-960.webp"
            alt={PLATE_ALT}
            width={1220}
            height={687}
            decoding="async"
            fetchPriority="high"
          />
        </picture>
      </div>
    </section>
  );
}
