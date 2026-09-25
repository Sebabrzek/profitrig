import Link from "next/link";
import type { ReactNode } from "react";
import { LossTag } from "@/components/ui/Records";
import {
  loadRecordFigures,
  partialRecordFigures,
  tripLineFigures,
  type LoadRecordEconomics,
  type TripLineTotals,
} from "@/lib/records";

/**
 * The week's loads, newest first, as an operating ledger.
 *
 * Every figure arrives already calculated by the Loads page
 * (computeLoadEconomics with the load's month); this only lays it out. How
 * a record is shaped — card on a phone, ledger row in a wide column — is
 * CSS (globals.css, "Load records"), decided by the width of the list.
 */
export function LoadLedger({ children }: { children: ReactNode }) {
  return (
    <div className="pr-load-list">
      <ul className="pr-load-rows">
        {/* Column headings for the ledger shape. Each record also names its
            own numbers for screen readers, so these are hidden from them. */}
        <li aria-hidden="true" className="pr-load-head">
          <span className="pr-record-label">Load</span>
          <span className="pr-record-label pr-load-head-miles">Miles</span>
          <span className="pr-record-label">Revenue</span>
          <span className="pr-record-label">Cost</span>
          <span className="pr-record-label">Profit</span>
        </li>
        {children}
      </ul>
    </div>
  );
}

export function LoadRecord({
  id,
  href,
  dateLabel,
  broker,
  origin,
  destination,
  economics,
}: {
  /** Unique per record; builds the ids that name the link. */
  id: string;
  href: string;
  dateLabel: string;
  broker: string;
  origin: string;
  destination: string;
  economics: LoadRecordEconomics;
}) {
  const f = loadRecordFigures(economics);
  const k = `load-${id}`;
  const hasRoute = Boolean(origin || destination);
  const tone =
    f.outcome === "profit"
      ? "pr-amount-profit"
      : f.outcome === "loss"
      ? "pr-amount-loss"
      : "";

  return (
    <li>
      {/* The whole record opens the load. Its name is who, when, where and
          the result; the other figures are its description. */}
      <Link
        href={href}
        className="pr-record pr-record-link pr-load"
        aria-labelledby={`${k}-title ${k}-date${hasRoute ? ` ${k}-route` : ""} ${k}-profit`}
        aria-describedby={`${k}-miles ${k}-revenue ${k}-cost`}
      >
        <div className="pr-load-id">
          <p id={`${k}-date`} className="pr-load-date">
            {dateLabel}
          </p>
          <p id={`${k}-title`} className="pr-load-title">
            {broker || "Untitled load"}
          </p>
          {hasRoute && (
            <p id={`${k}-route`} className="pr-load-route">
              {origin || "—"}{" "}
              <span aria-hidden="true">→</span>
              <span className="sr-only">to</span> {destination || "—"}
            </p>
          )}
          <p aria-hidden="true" className="pr-load-inline-miles">
            {f.miles} mi · {f.deadhead}
          </p>
        </div>

        <div id={`${k}-miles`} className="pr-load-cell pr-load-miles">
          <p className="pr-record-label">Miles</p>
          <p className="pr-load-count">{f.miles}</p>
          <p className="pr-load-context">{f.deadhead}</p>
        </div>

        <div id={`${k}-revenue`} className="pr-load-cell pr-load-revenue">
          <p className="pr-record-label">Revenue</p>
          <p className="pr-load-value">{f.revenue}</p>
          {f.share && <p className="pr-load-context">{f.share}</p>}
          <p className="pr-load-context pr-load-wide-only">{f.rate}</p>
        </div>

        <div id={`${k}-cost`} className="pr-load-cell pr-load-cost">
          <p className="pr-record-label">Cost</p>
          <p className="pr-load-value">{f.cost}</p>
          <p className="pr-load-context pr-load-wide-only">{f.costRate}</p>
        </div>

        <div id={`${k}-profit`} className="pr-load-cell pr-load-profit">
          <p className="pr-record-label">Profit</p>
          <p className={`pr-load-hero ${tone}`}>{f.profit}</p>
          {f.outcome === "loss" && (
            <p>
              <LossTag />
            </p>
          )}
        </div>

        {/* A phone's operating detail: the trip, then the rates. */}
        <p aria-hidden="true" className="pr-load-support">
          <span>
            {f.miles} mi · {f.deadhead}
          </span>
          <span>
            Rate {f.rate} · Cost {f.costRate}
          </span>
        </p>
      </Link>
    </li>
  );
}

function toneOf(outcome: ReturnType<typeof partialRecordFigures>["outcome"]) {
  return outcome === "profit"
    ? "pr-amount-profit"
    : outcome === "loss"
    ? "pr-amount-loss"
    : "";
}

/**
 * A partial, tucked under the load it rode with. Deliberately not a ledger
 * row: its figures are what it ADDED to the trip, and in the Revenue / Cost
 * / Profit columns they would read as a load's own — $900 over 40 miles is a
 * spectacular marginal result and a nonsense rate.
 */
export function PartialRecord({
  id,
  href,
  broker,
  origin,
  destination,
  economics,
}: {
  id: string;
  href: string;
  broker: string;
  origin: string;
  destination: string;
  economics: LoadRecordEconomics;
}) {
  const f = partialRecordFigures(economics);
  const k = `partial-${id}`;
  const hasRoute = Boolean(origin || destination);
  return (
    <li className="pr-load-partial">
      <Link
        href={href}
        className="pr-record pr-record-link pr-load-partial-link"
        aria-labelledby={`${k}-kind ${k}-title${hasRoute ? ` ${k}-route` : ""} ${k}-adds`}
        aria-describedby={`${k}-detail`}
      >
        <div className="pr-load-partial-id">
          <p id={`${k}-kind`} className="pr-load-partial-kind">
            Partial
          </p>
          <p id={`${k}-title`} className="pr-load-title">
            {broker || "Untitled partial"}
          </p>
          {hasRoute && (
            <p id={`${k}-route`} className="pr-load-route">
              {origin || "—"} <span aria-hidden="true">→</span>
              <span className="sr-only">to</span> {destination || "—"}
            </p>
          )}
        </div>
        <div className="pr-load-partial-figures">
          <p id={`${k}-detail`} className="pr-load-context">
            {f.extraMiles} · {f.share ?? `${f.pay} pay`}
          </p>
          {/* 15px: too small for Profit Green or Loss Red to pass (design
              system §B), so the sign carries the meaning, in Charcoal. */}
          <p id={`${k}-adds`} className="pr-load-partial-adds">
            <span className="pr-load-context">adds </span>
            <span className="pr-load-value">{f.adds}</span>
          </p>
        </div>
      </Link>
    </li>
  );
}

/** The whole trip, under a primary's partials: what the truck really did. */
export function TripLine({
  totals,
  partials,
}: {
  totals: TripLineTotals;
  partials: number;
}) {
  const f = tripLineFigures(totals, partials);
  return (
    <li className="pr-load-trip">
      <div className="pr-load-trip-inner">
        <p className="pr-load-trip-label">{f.label}</p>
        <p className="pr-load-context">
          {f.miles} · {f.revenue} · {f.rate}
        </p>
        {/* The trip's result is the one that counts, so it is set at the
            record's hero size — large enough for its colour to pass. */}
        <p className="pr-load-trip-profit">
          <span className="sr-only">Trip profit </span>
          <span className={`pr-load-hero ${toneOf(f.outcome)}`}>{f.profit}</span>
        </p>
      </div>
    </li>
  );
}
