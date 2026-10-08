import "server-only";
import { timingSafeEqual } from "node:crypto";

/**
 * Whether a request comes from Postmark: the webhook URL carries
 * https://postmark:SECRET@…, which arrives as HTTP basic auth. Compared in
 * constant time.
 */
export function fromPostmark(request: Request, secret: string): boolean {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Basic ")) return false;
  let password = "";
  try {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    password = decoded.slice(decoded.indexOf(":") + 1);
  } catch {
    return false;
  }
  const a = Buffer.from(password);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
