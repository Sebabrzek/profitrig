import Link from "next/link";
import { Notice } from "@/components/ui/Notice";

export type ScanState = {
  id: string;
  /** read: the form is filled in · failed: it could not be read · saved: already a load */
  state: "read" | "failed" | "saved";
  documentLabel: string;
  /** What to check, most important first (lib/scan draftFromReading). */
  checks: string[];
  loadId: string | null;
};

/**
 * Above a form filled in from a scan: where it came from, and what to check
 * before saving. The driver is the one who saves, so they are told plainly
 * that a photo can be misread.
 */
export function ScanDraftNotice({ scan }: { scan: ScanState }) {
  const links = (
    <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
      <a
        href={`/api/scan/${scan.id}/file`}
        target="_blank"
        rel="noopener noreferrer"
        className="pr-link font-semibold"
      >
        View the original
      </a>
      <Link href="/loads/new" className="pr-link">
        Scan another
      </Link>
    </p>
  );

  if (scan.state === "saved") {
    return (
      <Notice className="mb-5">
        You already saved a load from this scan.{" "}
        {scan.loadId && (
          <Link href={`/loads/${scan.loadId}`} className="pr-link font-semibold">
            Open it
          </Link>
        )}
        {links}
      </Notice>
    );
  }
  if (scan.state === "failed") {
    return (
      <Notice tone="error" className="mb-5">
        That document couldn&apos;t be read. Scan it again with the whole page in
        view, or enter the load by hand below.
        {links}
      </Notice>
    );
  }
  return (
    <Notice className="mb-5">
      <span className="font-semibold">
        Filled in from your {scan.documentLabel}.
      </span>{" "}
      Check every figure before you save. A photo can be misread.
      {scan.checks.length > 0 && (
        <ul className="mt-2 list-disc pl-5">
          {scan.checks.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      )}
      {links}
    </Notice>
  );
}
