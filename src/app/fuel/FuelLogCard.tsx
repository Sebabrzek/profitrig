"use client";

import { useState, useTransition } from "react";
import { addFuelLogAction, deleteFuelLogAction } from "../actions";
import { isPlausibleMpg, type FuelEntry } from "@/lib/fuel";

const inputClass =
  "w-full h-12 px-4 rounded-xl border border-border bg-white text-base focus:outline-none focus:ring-2 focus:ring-brand";

const digitsOnly = (v: string) => v.replace(/[^0-9.]/g, "");
const miles = (n: number) => Math.round(n).toLocaleString("en-US");

function shortDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function StatusBadge({ entry }: { entry: FuelEntry }) {
  switch (entry.status) {
    case "ok":
      return (
        <span className="px-2.5 py-1 rounded-full text-sm font-bold bg-brand-soft text-brand-dark whitespace-nowrap">
          {entry.mpg!.toFixed(1)} MPG
        </span>
      );
    case "check":
      return (
        <span
          className="px-2.5 py-1 rounded-full text-sm font-bold bg-amber-100 text-amber-900 whitespace-nowrap"
          title="No semi gets this MPG. Check the odometer and gallons — or it was a partial fill, which evens out in your average."
        >
          {entry.mpg!.toFixed(1)} MPG · check
        </span>
      );
    case "baseline":
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-muted whitespace-nowrap">
          Starting point
        </span>
      );
    case "odometer":
      return (
        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 whitespace-nowrap">
          Odometer too low
        </span>
      );
  }
}

export function FuelLogCard({
  entries,
  lastOdometer,
  today,
}: {
  entries: FuelEntry[];
  /** Highest reading on file (or the starting odometer) — what a new week measures from. */
  lastOdometer: number | null;
  today: string;
}) {
  const [date, setDate] = useState(today);
  const [odometerText, setOdometerText] = useState("");
  const [gallonsText, setGallonsText] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const odometer = odometerText === "" ? null : Number(odometerText);
  const gallons = gallonsText === "" ? null : Number(gallonsText);
  const driven =
    odometer != null && lastOdometer != null ? odometer - lastOdometer : null;
  const previewMpg =
    driven != null && driven > 0 && gallons != null && gallons > 0
      ? driven / gallons
      : null;

  let preview = "";
  if (odometer != null && lastOdometer == null) {
    preview = "This reading becomes your starting point — MPG shows from your next week.";
  } else if (driven != null && driven <= 0) {
    preview = `That's not higher than your last reading (${miles(lastOdometer!)} mi). Double-check it.`;
  } else if (previewMpg != null) {
    preview = `${miles(driven!)} miles since your last reading → ${previewMpg.toFixed(1)} MPG${
      isPlausibleMpg(previewMpg) ? "" : ". That's unusual for a semi — double-check the numbers."
    }`;
  } else if (driven != null && driven > 0) {
    preview = `${miles(driven)} miles since your last reading.`;
  }

  function add() {
    if (odometer == null || !(odometer > 0)) {
      setError("Enter the odometer reading.");
      return;
    }
    if (gallons == null || !(gallons > 0)) {
      setError("Enter the gallons you filled up.");
      return;
    }
    setError("");
    startTransition(async () => {
      const r = await addFuelLogAction({ logged_on: date, odometer, gallons });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setOdometerText("");
      setGallonsText("");
    });
  }

  function remove(id: string) {
    if (!confirm("Delete this week? This cannot be undone.")) return;
    setError("");
    startTransition(async () => {
      const r = await deleteFuelLogAction(id);
      if (!r.ok) setError(r.error);
    });
  }

  return (
    <section className="bg-white border border-border rounded-2xl p-5 mb-4">
      <h2 className="text-lg font-bold mb-1">Log a week</h2>
      <p className="text-sm text-muted mb-4">
        Your odometer now, and every gallon you bought since your last reading.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Odometer</span>
          <div className="relative">
            <input
              inputMode="decimal"
              value={odometerText}
              placeholder={lastOdometer != null ? String(Math.round(lastOdometer) + 2500) : "514800"}
              onChange={(e) => setOdometerText(digitsOnly(e.target.value))}
              className={`${inputClass} pr-10`}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted text-sm pointer-events-none">
              mi
            </span>
          </div>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Gallons</span>
          <div className="relative">
            <input
              inputMode="decimal"
              value={gallonsText}
              placeholder="400"
              onChange={(e) => setGallonsText(digitsOnly(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === "Enter") add();
              }}
              className={`${inputClass} pr-12`}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted text-sm pointer-events-none">
              gal
            </span>
          </div>
        </label>
      </div>
      {preview && <p className="text-sm text-foreground/80 mt-3">{preview}</p>}
      {error && <p className="text-sm text-red-600 font-semibold mt-3">{error}</p>}
      <button
        type="button"
        onClick={add}
        disabled={pending}
        className="mt-4 w-full h-12 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold disabled:opacity-60 transition"
      >
        {pending ? "Saving…" : "Add week"}
      </button>

      {entries.length > 0 && (
        <ul className="mt-5 divide-y divide-border border-t border-border">
          {entries.map((entry) => (
            <li key={entry.id ?? `${entry.logged_on}-${entry.odometer}`} className="py-3 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  {shortDate(entry.logged_on)}{" "}
                  <span className="font-normal text-muted">· {miles(entry.odometer)} mi</span>
                </p>
                <p className="text-xs text-muted tabular-nums">
                  {entry.miles != null ? `${miles(entry.miles)} miles · ` : ""}
                  {entry.gallons.toLocaleString("en-US")} gal
                </p>
              </div>
              <StatusBadge entry={entry} />
              {entry.id && (
                <button
                  type="button"
                  onClick={() => remove(entry.id!)}
                  disabled={pending}
                  aria-label={`Delete week of ${shortDate(entry.logged_on)}`}
                  className="shrink-0 p-1 text-muted hover:text-red-600 disabled:opacity-40"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
