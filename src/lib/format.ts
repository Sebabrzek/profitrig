/**
 * How ProfitRig shows money on screen (design system §28).
 *
 * DISPLAY ONLY. Nothing here rounds a stored value, a calculation, a saved
 * number, an input, an export or a CSV — the exports keep their own
 * formatting. The only thing removed is a meaningless ".00".
 *
 *   formatMoney(9454)                  "$9,454"       .00 dropped
 *   formatMoney(2150.5)                "$2,150.50"    real cents kept
 *   formatMoney(-142)                  "−$142"        true minus sign
 *   formatMoney(987, { signed: true }) "+$987"        profit reads as profit
 *   formatRate(2.456)                  "$2.46"        rates always show cents
 *   formatRate(2.46, { unit: "mi" })   "$2.46 / mi"
 */

/** U+2212. Reads as "minus" to a screen reader, where a hyphen may not. */
export const MINUS = "−";

function toCents(n: number): number {
  // Math.round(-0.4) is -0; normalise so a zero never carries a sign.
  return Math.round(n * 100) || 0;
}

function dollars(cents: number, fractionDigits: 0 | 2): string {
  return (
    "$" +
    (Math.abs(cents) / 100).toLocaleString("en-US", {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    })
  );
}

function withSign(cents: number, body: string, signed: boolean): string {
  if (cents < 0) return MINUS + body;
  if (cents > 0 && signed) return "+" + body;
  return body;
}

/**
 * Money. Cents appear only when there are cents. A negative amount always
 * shows its minus; `signed` adds a "+" to a positive one — use it for profit
 * and loss, never for a cost or a revenue.
 */
export function formatMoney(
  n: number,
  { signed = false }: { signed?: boolean } = {}
): string {
  if (!Number.isFinite(n)) return "—";
  const cents = toCents(n);
  return withSign(cents, dollars(cents, cents % 100 === 0 ? 0 : 2), signed);
}

/** A per-mile or per-unit rate: always two decimals. */
export function formatRate(
  n: number,
  { signed = false, unit }: { signed?: boolean; unit?: string } = {}
): string {
  if (!Number.isFinite(n)) return "—";
  const cents = toCents(n);
  const value = withSign(cents, dollars(cents, 2), signed);
  return unit ? `${value} / ${unit}` : value;
}

/** Whether a result reads as a profit, a loss, or neither (to the cent). */
export function outcomeOf(n: number): "profit" | "loss" | undefined {
  const cents = Number.isFinite(n) ? toCents(n) : 0;
  return cents > 0 ? "profit" : cents < 0 ? "loss" : undefined;
}
