import type { ReactNode } from "react";
import { DEMO_MARKER } from "./demo";

/**
 * The small shared pieces every marketing section is built from: the band,
 * the section headline, the frame that holds a real piece of ProfitRig, and
 * the marker that says the numbers inside it are made up.
 */

export function Band({
  children,
  dark = false,
  className = "",
  id,
}: {
  children: ReactNode;
  dark?: boolean;
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={`pr-mk-band ${dark ? "pr-mk-dark" : ""} ${className}`}
    >
      <div className="pr-mk-inner pr-mk-section">{children}</div>
    </section>
  );
}

export function SectionTitle({
  eyebrow,
  title,
  lead,
  dark = false,
}: {
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  dark?: boolean;
}) {
  return (
    <div>
      {eyebrow && <p className="pr-mk-eyebrow mb-3">{eyebrow}</p>}
      <h2
        className={`pr-mk-h2 ${
          dark ? "text-white" : "text-[var(--pr-rig-green)]"
        }`}
      >
        {title}
      </h2>
      {lead && (
        <p
          className={`pr-mk-lead mt-4 ${
            dark ? "text-white/85" : "text-muted"
          }`}
        >
          {lead}
        </p>
      )}
    </div>
  );
}

/**
 * Says plainly that the figures in the panel beside it are invented. It is
 * a visible label, not a tooltip: someone scrolling past must be able to
 * tell example data from a promise.
 */
export function DemoMarker({ dark = false }: { dark?: boolean }) {
  return (
    <span className={`pr-mk-demo ${dark ? "pr-mk-demo-dark" : ""}`}>
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8h.01M11 12h1v4h1" />
      </svg>
      {DEMO_MARKER}
    </span>
  );
}

/** A real piece of the product, framed so it reads as a screen. */
export function Screen({
  children,
  caption,
}: {
  children: ReactNode;
  caption?: ReactNode;
}) {
  return (
    <div>
      <div className="pr-mk-screen">{children}</div>
      {caption && (
        <p className="mt-3 text-xs leading-snug text-muted">{caption}</p>
      )}
    </div>
  );
}

/** A short list of plain statements under a section headline. */
export function Points({ items }: { items: string[] }) {
  return (
    <ul className="mt-6 space-y-3">
      {items.map((t) => (
        <li key={t} className="flex gap-3 text-sm leading-snug sm:text-base">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mt-0.5 shrink-0 text-[var(--pr-rig-green)]"
            aria-hidden="true"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}
