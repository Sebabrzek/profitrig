import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

/**
 * The invoice as a PDF: one plain page a broker's billing desk can read at a
 * glance, followed by the paperwork they ask for — the rate con and the
 * signed BOL — so the driver sends one file.
 *
 * Company only at the top: brokers pay the business, not the person.
 */

export type InvoiceDoc = {
  number: number;
  invoiceDate: string;
  dueDate: string;
  netDays: number;
  from: { company: string; mc: string; address: string; phone: string; email: string };
  billTo: { name: string; address: string; email: string };
  brokerLoadNumber: string;
  pickupDate: string;
  origin: string;
  destination: string;
  linehaul: number;
  fuelSurcharge: number;
  accessorials: number;
  remitTo: string;
  notes: string;
  status: "open" | "paid" | "void";
};

export type Paperwork = { mime: string; bytes: Uint8Array };

/** "$1,610.00" — an invoice always shows cents. */
export function invoiceMoney(n: number): string {
  return `$${(Math.round(n * 100) / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** "Oct 7, 2026" */
export function invoiceDay(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** The charges, in order: line haul always, the others only when there is one. */
export function invoiceLines(d: Pick<InvoiceDoc, "linehaul" | "fuelSurcharge" | "accessorials" | "origin" | "destination">) {
  const lane = d.origin || d.destination ? ` — ${d.origin || "—"} to ${d.destination || "—"}` : "";
  const lines = [{ label: `Line haul${lane}`, amount: d.linehaul }];
  if (d.fuelSurcharge > 0) lines.push({ label: "Fuel surcharge", amount: d.fuelSurcharge });
  if (d.accessorials > 0) lines.push({ label: "Other charges (detention, stops, etc.)", amount: d.accessorials });
  return lines;
}

const LETTER: [number, number] = [612, 792];
const MARGIN = 54;
const INK = rgb(0.12, 0.16, 0.22);
const MUTED = rgb(0.4, 0.44, 0.52);
const RULE = rgb(0.85, 0.86, 0.88);
const GREEN = rgb(0.09, 0.235, 0.17);

/** Standard PDF fonts carry only Western characters; anything else becomes "?". */
function safe(font: PDFFont, s: string): string {
  const swapped = s.replace(/[\u2192\u21d2]/g, "to").replace(/[\u2028\u2029]/g, " ");
  let out = "";
  for (const ch of swapped) {
    try {
      font.encodeText(ch);
      out += ch;
    } catch {
      out += "?";
    }
  }
  return out;
}

/** Text broken into lines that fit `width`, keeping the writer's own line breaks. */
export function wrap(font: PDFFont, s: string, size: number, width: number): string[] {
  const lines: string[] = [];
  // Lines first, then each line made drawable: a line break is not a character.
  for (const para of s.split("\n").map((l) => safe(font, l))) {
    let line = "";
    for (const word of para.split(" ")) {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= width || !line) line = next;
      else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}

export async function renderInvoicePdf(
  d: InvoiceDoc,
  paperwork: Paperwork[] = []
): Promise<{ bytes: Uint8Array; skipped: number }> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Invoice ${d.number} — ${d.from.company}`);
  pdf.setAuthor(d.from.company);
  pdf.setCreator("ProfitRig");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage(LETTER);
  const right = LETTER[0] - MARGIN;
  let y = LETTER[1] - MARGIN;

  const draw = (p: PDFPage, s: string, x: number, yy: number, size: number, font = regular, color = INK) =>
    p.drawText(safe(font, s), { x, y: yy, size, font, color });
  const drawRight = (s: string, yy: number, size: number, font = regular, color = INK) => {
    const t = safe(font, s);
    page.drawText(t, { x: right - font.widthOfTextAtSize(t, size), y: yy, size, font, color });
  };

  // ── Who it's from (left) and the invoice itself (right) ────────────────
  draw(page, d.from.company, MARGIN, y - 4, 18, bold, GREEN);
  drawRight(d.status === "void" ? "INVOICE — CANCELLED" : "INVOICE", y - 4, 22, bold, GREEN);
  let ly = y - 26;
  const fromLines = [
    d.from.mc ? `MC ${d.from.mc}` : "",
    ...d.from.address.split("\n"),
    d.from.phone,
    d.from.email,
  ].filter(Boolean);
  for (const l of fromLines) {
    draw(page, l, MARGIN, ly, 10, regular, MUTED);
    ly -= 14;
  }
  let ry = y - 30;
  const facts: [string, string][] = [
    ["Invoice #", String(d.number)],
    ["Invoice date", invoiceDay(d.invoiceDate)],
    ["Due", `${invoiceDay(d.dueDate)}${d.netDays > 0 ? ` (Net ${d.netDays})` : " (on receipt)"}`],
    ...(d.brokerLoadNumber ? ([["Load #", d.brokerLoadNumber]] as [string, string][]) : []),
  ];
  for (const [k, v] of facts) {
    const vt = safe(regular, v);
    const vx = right - regular.widthOfTextAtSize(vt, 10);
    page.drawText(vt, { x: vx, y: ry, size: 10, font: regular, color: INK });
    const kt = safe(bold, k);
    page.drawText(kt, { x: vx - 12 - bold.widthOfTextAtSize(kt, 10), y: ry, size: 10, font: bold, color: MUTED });
    ry -= 16;
  }
  y = Math.min(ly, ry) - 18;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: right, y }, thickness: 1, color: RULE });
  y -= 24;

  // ── Bill to, and the load ──────────────────────────────────────────────
  const col2 = MARGIN + (right - MARGIN) / 2 + 10;
  draw(page, "BILL TO", MARGIN, y, 9, bold, MUTED);
  draw(page, "LOAD", col2, y, 9, bold, MUTED);
  let by = y - 16;
  draw(page, d.billTo.name, MARGIN, by, 11, bold);
  by -= 15;
  for (const l of [...wrap(regular, d.billTo.address, 10, col2 - MARGIN - 20), d.billTo.email].filter(Boolean)) {
    draw(page, l, MARGIN, by, 10);
    by -= 14;
  }
  let gy = y - 16;
  const loadLines = [
    d.pickupDate ? `Picked up ${invoiceDay(d.pickupDate)}` : "",
    d.origin ? `From ${d.origin}` : "",
    d.destination ? `To ${d.destination}` : "",
  ].filter(Boolean);
  for (const l of loadLines) {
    for (const w of wrap(regular, l, 10, right - col2)) {
      draw(page, w, col2, gy, 10);
      gy -= 14;
    }
  }
  y = Math.min(by, gy) - 22;

  // ── Charges ────────────────────────────────────────────────────────────
  page.drawRectangle({ x: MARGIN, y: y - 6, width: right - MARGIN, height: 22, color: rgb(0.96, 0.97, 0.96) });
  draw(page, "DESCRIPTION", MARGIN + 8, y, 9, bold, MUTED);
  drawRight("AMOUNT", y, 9, bold, MUTED);
  y -= 26;
  for (const line of invoiceLines(d)) {
    const wrapped = wrap(regular, line.label, 10.5, right - MARGIN - 120);
    wrapped.forEach((w, i) => draw(page, w, MARGIN + 8, y - i * 14, 10.5));
    drawRight(invoiceMoney(line.amount), y, 10.5);
    y -= 14 * wrapped.length + 8;
    page.drawLine({ start: { x: MARGIN, y: y + 4 }, end: { x: right, y: y + 4 }, thickness: 0.5, color: RULE });
    y -= 6;
  }
  const total = Math.round((d.linehaul + d.fuelSurcharge + d.accessorials) * 100) / 100;
  y -= 4;
  draw(page, "TOTAL DUE", right - 220, y, 12, bold);
  drawRight(invoiceMoney(total), y, 14, bold, GREEN);
  y -= 40;

  // ── Remit to, notes ────────────────────────────────────────────────────
  draw(page, "PLEASE REMIT PAYMENT TO", MARGIN, y, 9, bold, MUTED);
  y -= 16;
  for (const l of wrap(regular, d.remitTo, 10.5, right - MARGIN)) {
    draw(page, l, MARGIN, y, 10.5);
    y -= 14;
  }
  if (d.notes) {
    y -= 12;
    draw(page, "NOTES", MARGIN, y, 9, bold, MUTED);
    y -= 16;
    for (const l of wrap(regular, d.notes, 10, right - MARGIN)) {
      draw(page, l, MARGIN, y, 10);
      y -= 14;
    }
  }
  draw(page, "Thank you for your business.", MARGIN, MARGIN, 9, regular, MUTED);

  // ── The paperwork behind it ────────────────────────────────────────────
  let skipped = 0;
  for (const doc of paperwork) {
    try {
      if (doc.mime === "application/pdf") {
        const src = await PDFDocument.load(doc.bytes);
        const pages = await pdf.copyPages(src, src.getPageIndices());
        for (const p of pages) pdf.addPage(p);
      } else if (doc.mime === "image/jpeg" || doc.mime === "image/png") {
        const img = doc.mime === "image/jpeg" ? await pdf.embedJpg(doc.bytes) : await pdf.embedPng(doc.bytes);
        const p = pdf.addPage(LETTER);
        const scale = Math.min((LETTER[0] - 2 * 36) / img.width, (LETTER[1] - 2 * 36) / img.height, 1);
        const w = img.width * scale;
        const h = img.height * scale;
        p.drawImage(img, { x: (LETTER[0] - w) / 2, y: (LETTER[1] - h) / 2, width: w, height: h });
      } else {
        skipped++;
      }
    } catch {
      // A locked or damaged file: the invoice still goes out without it.
      skipped++;
    }
  }

  return { bytes: await pdf.save(), skipped };
}
