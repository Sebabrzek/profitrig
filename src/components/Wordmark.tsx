type Props = {
  size?: "sm" | "md" | "lg";
};

export function Wordmark({ size = "md" }: Props) {
  const cls =
    size === "lg"
      ? "text-4xl"
      : size === "sm"
      ? "text-xl"
      : "text-2xl";
  return (
    <div
      className={`${cls} font-display uppercase tracking-tight leading-none select-none`}
      aria-label="ProfitRig"
    >
      <span className="text-foreground" style={{ fontWeight: 500 }}>
        Profit
      </span>
      <span className="text-brand" style={{ fontWeight: 900 }}>
        Rig
      </span>
    </div>
  );
}
