import { SCAN_IMAGE_MAX_EDGE } from "./scan";

/**
 * A phone photo shrunk in the browser before it is sent: 2,000 px on the
 * long edge keeps every printed figure sharp and uploads quickly from a
 * truck stop. The browser applies the photo's own rotation. Browser only.
 */
export async function shrinkPhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, SCAN_IMAGE_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), "image/jpeg", 0.85)
  );
}
