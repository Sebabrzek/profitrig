import { Montserrat } from "next/font/google";

/**
 * TEMPORARY WORDMARK — not the production asset.
 *
 * The approved identity is Option 01 (see
 * docs/design/assets/logos/references/APPROVED-OPTION-01-REFERENCE.png,
 * upper-left panel, and IDENTITY_REFERENCE.md beside it). Its production
 * vector has not been supplied yet; the only reference available is a
 * ~290x32px raster, which is not enough to vectorise faithfully. The two
 * PENDING.md manifests under docs/design/assets/logos/ record what is owed.
 *
 * Until that SVG arrives this renders the approved DIRECTION in Montserrat
 * Black, the construction reference Option 01 was built from — heavy, wide,
 * geometric, tightly set, PROFIT in Rig Green and RIG in Sage.
 *
 * MONTSERRAT IS A TEMPORARY CONSTRUCTION SUBSTITUTE FOR THIS COMPONENT ONLY.
 * It is loaded here, applied here, and exposed nowhere else — it is not a
 * ProfitRig token, not in the @theme block, and not part of the application
 * typography system, which remains Satoshi for UI, Inter for body copy and
 * JetBrains Mono for financial figures. Typing PROFITRIG in Montserrat does
 * not reproduce the approved custom geometry and must never be exported as
 * an SVG or treated as a production asset.
 *
 * TO REPLACE IT: swap the inner markup for the supplied <svg> (and its
 * white variant for tone="dark" — both are listed in wordmark/PENDING.md),
 * keep the `size` and `tone` props and the same block dimensions, delete the
 * Montserrat import and this comment. No caller changes — the top bar, the
 * sidebar and the login page already go through here.
 */

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: "900",
  display: "swap",
});

type Props = {
  size?: "sm" | "md" | "lg";
  /** "dark" is for Rig Green surfaces: PROFIT in Off White, RIG stays Sage
      (design system, Appendix A — logo colours on Rig Green). */
  tone?: "light" | "dark";
};

const SIZES: Record<NonNullable<Props["size"]>, string> = {
  sm: "text-xl",
  md: "text-2xl",
  lg: "text-4xl",
};

export function Wordmark({ size = "md", tone = "light" }: Props) {
  return (
    <div
      className={`${montserrat.className} ${SIZES[size]} uppercase leading-none select-none`}
      style={{ letterSpacing: "-0.035em" }}
      aria-label="ProfitRig"
      role="img"
    >
      <span
        style={{
          color:
            tone === "dark" ? "var(--pr-off-white)" : "var(--pr-rig-green)",
        }}
      >
        Profit
      </span>
      <span style={{ color: "var(--pr-sage)" }}>Rig</span>
    </div>
  );
}
