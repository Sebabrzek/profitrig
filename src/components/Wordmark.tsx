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
 * Until that SVG arrives, this renders the approved DIRECTION in type we
 * already have: heavy, wide, geometric, PROFIT in Rig Green and RIG in Sage.
 * It is deliberately not exported as an SVG, so nothing can mistake it for
 * the real mark.
 *
 * TO REPLACE IT: swap the inner markup of this component for the supplied
 * <svg>, keep the same `size` prop and the same block dimensions, and delete
 * this comment. No caller needs to change — every header, and the login page,
 * already go through here.
 */

type Props = {
  size?: "sm" | "md" | "lg";
};

const SIZES: Record<NonNullable<Props["size"]>, string> = {
  sm: "text-xl",
  md: "text-2xl",
  lg: "text-4xl",
};

export function Wordmark({ size = "md" }: Props) {
  return (
    <div
      className={`${SIZES[size]} font-display uppercase leading-none select-none`}
      style={{ fontWeight: 900, letterSpacing: "-0.01em" }}
      aria-label="ProfitRig"
      role="img"
    >
      <span style={{ color: "var(--pr-rig-green)" }}>Profit</span>
      <span style={{ color: "var(--pr-sage)" }}>Rig</span>
    </div>
  );
}
