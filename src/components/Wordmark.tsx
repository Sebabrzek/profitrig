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
      className={`${cls} font-display font-bold italic tracking-tight leading-none select-none`}
      aria-label="ProfitRig"
    >
      <span className="text-foreground">Profit</span>
      <span className="text-brand">Rig</span>
    </div>
  );
}
