import { PDFDocument } from "pdf-lib";

/**
 * One page of a PDF as its own one-page PDF, base64 — so the AI reads, and
 * ProfitRig pays for, only that page. A 7-page rate con is one page of load
 * and six of terms, scrambled text and e-signature receipts.
 *
 * Null when the PDF cannot be taken apart (damaged, or locked with a
 * password): the caller then sends the whole file.
 */
export async function pdfPage(
  bytes: Uint8Array,
  index: number
): Promise<{ data: string; pageCount: number } | null> {
  try {
    const source = await PDFDocument.load(bytes, { ignoreEncryption: false });
    const pageCount = source.getPageCount();
    if (index < 0 || index >= pageCount) return null;
    const single = await PDFDocument.create();
    const [page] = await single.copyPages(source, [index]);
    single.addPage(page);
    const out = await single.save();
    return { data: Buffer.from(out).toString("base64"), pageCount };
  } catch {
    return null;
  }
}
