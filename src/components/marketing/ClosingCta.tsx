import { ButtonLink } from "@/components/ui/Button";

/**
 * LEVEL 1 — the American Iron language comes back to close the page.
 *
 * The same approved master as the hero, cropped to its scenic upper band:
 * sky, the ghosted engraved bison, the ridge line. Cropped, never stretched
 * — the trucks are not repeated at a size that would misrepresent their
 * proportions.
 *
 * Lazy-loaded: it is far below the opening visual and must not compete with
 * it for the first bytes.
 */
export function ClosingCta() {
  return (
    <section className="pr-mk-band pr-mk-dark pr-mk-art-band">
      <div className="pr-mk-art" aria-hidden="true">
        <picture>
          <source
            type="image/avif"
            sizes="100vw"
            srcSet="/brand/american-iron-closing-960.avif 960w, /brand/american-iron-closing-1672.avif 1672w"
          />
          <source
            type="image/webp"
            sizes="100vw"
            srcSet="/brand/american-iron-closing-960.webp 960w, /brand/american-iron-closing-1672.webp 1672w"
          />
          <img
            src="/brand/american-iron-closing-960.webp"
            alt=""
            width={1672}
            height={489}
            loading="lazy"
            decoding="async"
          />
        </picture>
      </div>
      <div className="pr-mk-scrim pr-mk-scrim-soft" aria-hidden="true" />

      <div className="pr-mk-inner py-16 text-center sm:py-24 lg:py-28">
        <p className="pr-mk-eyebrow">Know your numbers. Take control.</p>
        <h2 className="pr-mk-h1 mx-auto mt-4 max-w-[16ch] text-white">
          A more profitable
          <br />
          next mile.
        </h2>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <ButtonLink href="/login" variant="primary">
            Start Free
          </ButtonLink>
          <ButtonLink href="/calculator" variant="secondary">
            Use Free Calculator
          </ButtonLink>
        </div>
        <p className="mt-5 text-sm text-white/90">
          Free calculator, no account. Pro is $99 a year with a 7-day trial.
        </p>
      </div>
    </section>
  );
}
