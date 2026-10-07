"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/Surfaces";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { SCAN_IMAGE_MAX_EDGE, SCAN_MAX_BYTES } from "@/lib/scan";

/**
 * A phone photo is shrunk here before it is sent: 2,000 px on the long edge
 * keeps every printed figure sharp, uploads quickly from a truck stop, and
 * costs less to read. The browser applies the photo's own rotation.
 */
async function shrinkPhoto(file: File): Promise<Blob> {
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

/**
 * Scan a rate con or load ticket into the form below. ProfitRig only fills
 * the form in; the driver checks it and saves it themselves.
 */
export function ScanCard({
  emailAddress,
}: {
  /** The driver's email-in address; null when they haven't picked one. */
  emailAddress?: string | null;
} = {}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPlans, setShowPlans] = useState(false);

  async function scan(file: File) {
    setError(null);
    setShowPlans(false);
    setReading(true);
    try {
      let body: Blob = file;
      let name = file.name || "scan";
      if (file.type !== "application/pdf") {
        try {
          body = await shrinkPhoto(file);
          name = "scan.jpg";
        } catch {
          setError("That photo couldn't be opened here. Take a new photo, or save it as a JPG first.");
          return;
        }
      }
      if (body.size > SCAN_MAX_BYTES) {
        setError("That file is over 4 MB. Take a photo instead, or send just the rate con page.");
        return;
      }
      const form = new FormData();
      form.append("file", body, name);
      const res = await fetch("/api/scan", { method: "POST", body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok || typeof data?.scanId !== "string") {
        setError(
          typeof data?.error === "string"
            ? data.error
            : "Something went wrong. Try again in a minute, or enter the load by hand."
        );
        setShowPlans(data?.upgrade === true);
        return;
      }
      router.push(`/loads/new?scan=${data.scanId}`);
    } catch {
      setError("Couldn't reach ProfitRig. Check your connection and try again.");
    } finally {
      setReading(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <Card className="mb-5">
      <CardHeader
        title="Scan a rate con or load ticket"
        description="Take a photo or pick a PDF. ProfitRig fills in the form below from it, and you check everything before saving."
      />
      <input
        ref={input}
        type="file"
        accept="image/*,application/pdf"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void scan(f);
        }}
      />
      <Button variant="dark" onClick={() => input.current?.click()} pending={reading}>
        {reading ? "Reading your document…" : "Scan a document"}
      </Button>
      {reading && (
        <p role="status" className="mt-2 text-sm text-muted">
          This takes about 10 seconds.
        </p>
      )}
      {emailAddress !== undefined && !reading && (
        <p className="mt-3 text-sm text-muted">
          {emailAddress ? (
            <>
              Or email rate cons to{" "}
              <span className="pr-figure font-semibold text-foreground">{emailAddress}</span>
            </>
          ) : (
            <>
              Or{" "}
              <Link href="/profile#email-in" className="pr-link">
                get your own address
              </Link>{" "}
              and email rate cons in.
            </>
          )}
        </p>
      )}
      {error && (
        <Notice tone="error" className="mt-3">
          {error}
          {showPlans && (
            <>
              {" "}
              <Link href="/upgrade" className="pr-link font-semibold">
                See plans
              </Link>
            </>
          )}
        </Notice>
      )}
    </Card>
  );
}
