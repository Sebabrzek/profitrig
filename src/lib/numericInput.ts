/**
 * What ProfitRig's number fields do with each keystroke.
 *
 * Kept apart from any component so the behaviour drivers rely on is tested
 * (npm test) and cannot drift when a field is restyled. Every function here
 * is lifted unchanged from the field it came from.
 *
 * A DECIMAL field (the Calculator, the load editor, tax amounts) holds the
 * text the driver typed, not the number. "2." and ".5" stay on screen while
 * they type, the number the form sees updates on every keystroke, and the
 * text is only rewritten when the number is changed from outside the field —
 * a snapshot loaded, say. Nothing is ever formatted while typing: no
 * thousands separators, no trailing zeros added or removed.
 *
 * The LOOSE fields (carrier %, odometers, gallons, a road expense) keep
 * digits and dots only and check the number when the form saves.
 */

/** Digits and at most one decimal point; anything else typed is dropped. */
export function cleanDecimalText(raw: string): string {
  const onlyAllowed = raw.replace(/[^0-9.]/g, "");
  const firstDot = onlyAllowed.indexOf(".");
  if (firstDot === -1) return onlyAllowed;
  return (
    onlyAllowed.slice(0, firstDot + 1) +
    onlyAllowed.slice(firstDot + 1).replace(/\./g, "")
  );
}

/** What a field shows for a number: zero is an empty field. */
export function fieldTextFor(value: number): string {
  return value === 0 ? "" : String(value);
}

/** The number a decimal field's text stands for. Empty or "." is 0. */
export function decimalValueOf(text: string): number {
  const parsed = text === "" || text === "." ? 0 : parseFloat(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * On leaving a decimal field: a trailing "." goes and a lone "." empties
 * it. Nothing else changes — ".5" and "0.40" stay as typed.
 */
export function tidyDecimalText(text: string): string {
  if (text === "." || text === "") return "";
  if (text.endsWith(".")) return text.slice(0, -1);
  return text;
}

/**
 * The text a decimal field shows after the form's number changes.
 *
 * `lastSeen` is the number the field last reported or was given. When the
 * form's number is still that one, the change came from the driver's own
 * typing, so their text stays exactly as typed and the cursor never jumps:
 * this returns null. When it differs, the number was set from outside; the
 * text is rewritten only if it no longer stands for that number.
 */
export function resyncDecimalText(
  value: number,
  lastSeen: number,
  text: string
): string | null {
  if (value === lastSeen) return null;
  return value !== decimalValueOf(text) ? fieldTextFor(value) : text;
}

/** Digits and dots, any number of dots — the loose fields. */
export function digitsAndDots(raw: string): string {
  return raw.replace(/[^0-9.]/g, "");
}

/** Digits only — a year, a count of nights. */
export function digitsOnly(raw: string): string {
  return raw.replace(/[^0-9]/g, "");
}

/** The whole number a digits-only field stands for. Empty is 0. */
export function wholeNumberOf(text: string): number {
  const parsed = text === "" ? 0 : parseInt(text, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}
