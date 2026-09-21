import { ButtonLink } from "@/components/ui/Button";
import { MarketingHeader } from "./MarketingHeader";

/**
 * LEVEL 1 — the full American Iron illustration.
 *
 * The approved artwork runs full bleed behind a flat Rig Green scrim. The
 * scrim is there so Off White type clears contrast over the illustration's
 * cream sky; it is flat rather than a gradient, and it is the only thing
 * between the reader and the art.
 *
 * This is the one image on the page that is not lazy-loaded: it is the
 * opening visual, so it is fetched at high priority and the smaller widths
 * are offered first. Everything below waits its turn.
 */
export function Hero() {
  return (
    <section className="pr-mk-band pr-mk-dark pr-mk-art-band">
      <div className="pr-mk-art" aria-hidden="true">
        <picture>
          <source
            type="image/avif"
            sizes="100vw"
            srcSet="/brand/american-iron-hero-640.avif 640w, /brand/american-iron-hero-960.avif 960w, /brand/american-iron-hero-1280.avif 1280w, /brand/american-iron-hero-1672.avif 1672w"
          />
          <source
            type="image/webp"
            sizes="100vw"
            srcSet="/brand/american-iron-hero-640.webp 640w, /brand/american-iron-hero-960.webp 960w, /brand/american-iron-hero-1280.webp 1280w, /brand/american-iron-hero-1672.webp 1672w"
          />
          <img
            src="/brand/american-iron-hero-1280.webp"
            alt=""
            width={1672}
            height={941}
            decoding="async"
            fetchPriority="high"
          />
        </picture>
      </div>
      <div className="pr-mk-scrim" aria-hidden="true" />

      <MarketingHeader />

      <div className="pr-mk-inner pb-14 pt-10 sm:pb-20 sm:pt-16 lg:pb-28 lg:pt-20">
        <p className="pr-mk-eyebrow">American Iron × Financial Precision</p>
        <h1 className="pr-mk-h1 mt-4 max-w-[18ch] text-white">
          Know your numbers.
          <br />
          Take control.
        </h1>
        <p className="pr-mk-lead mt-5 text-white/90">
          ProfitRig tells an owner-operator what a mile really costs, what a
          load really paid, and what is left at the end of the week. Your
          numbers, worked out from what you actually spent.
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
        <p className="mt-4 text-sm text-white/90">
          The calculator is free and needs no account.
        </p>
      </div>
      <hr className="pr-mk-rule" />
    </section>
  );
}
