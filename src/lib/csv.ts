/**
 * CSV helpers shared by the loads export and the tax export.
 *
 * Both files are opened in Excel or Google Sheets — often by the driver's
 * accountant, not the driver. A cell that starts with `=` `+` `-` `@` or a
 * tab is a formula to a spreadsheet, so a broker saved as
 * `=HYPERLINK("http://evil/","TQL")` would run the moment the file is
 * opened. Prefixing with a single quote makes the spreadsheet treat it as
 * text again; the quote is not shown in the cell.
 *
 * A plain number is exempt, because every negative money column
 * (`-142.00` profit, `-0.18` profit/mile) starts with a minus and must stay
 * a number the accountant can sum.
 */
const FORMULA_START = /^[=+\-@\t\r]/;
const PLAIN_NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)$/;

export function csvEscape(v: unknown): string {
  if (v == null) return "";
  let s = String(v);
  if (FORMULA_START.test(s) && !PLAIN_NUMBER.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function csvRow(values: unknown[]): string {
  return values.map(csvEscape).join(",");
}
