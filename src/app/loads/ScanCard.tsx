"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/Surfaces";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { SCAN_MAX_BYTES } from "@/lib/scan";
import { shrinkPhoto } from "@/lib/shrinkPhoto";

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
