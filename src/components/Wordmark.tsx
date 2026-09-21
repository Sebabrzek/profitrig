import Image from "next/image";

type Props = {
  size?: "sm" | "md" | "lg";
  /** Off White and Sage artwork for Rig Green surfaces. */
  tone?: "light" | "dark";
};

// Approved compact lockup: never shrink below 200 CSS px. Padding adds
// at least half the wordmark cap height outside the SVG's own canvas.
const SIZES = {
  sm: { width: 200, padding: 10 },
  md: { width: 200, padding: 10 },
  lg: { width: 240, padding: 12 },
} as const;

export function Wordmark({ size = "md", tone = "light" }: Props) {
  const { width, padding } = SIZES[size];
  return (
    <div className="shrink-0 select-none" style={{ padding }}>
      <Image
        src={`/brand/profitrig-horizontal${tone === "dark" ? "-reversed" : ""}.svg`}
        alt="ProfitRig"
        width={1426}
        height={198}
        unoptimized
        loading="eager"
        style={{ display: "block", width, height: "auto" }}
      />
    </div>
  );
}
