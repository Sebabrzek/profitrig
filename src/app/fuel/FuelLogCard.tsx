"use client";

import { useState, useTransition } from "react";
import { Card, CardHeader } from "@/components/ui/Surfaces";
import { Notice } from "@/components/ui/Notice";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { RecordDeleteButton } from "@/components/ui/Records";
import { fuelEntryPresentation } from "@/lib/records";
import { AffixInput, Field, TextInput } from "@/components/ui/Field";
import { digitsAndDots } from "@/lib/numericInput";
import { addFuelLogAction, deleteFuelLogAction } from "../actions";
import { isPlausibleMpg, type FuelEntry } from "@/lib/fuel";

const miles = (n: number) => Math.round(n).toLocaleString("en-US");

function shortDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
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
    <Card className="mb-4">
      <CardHeader
        title="Log a week"
        description="Your odometer now, and every gallon you bought since your last reading."
      />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="Date">
          <TextInput
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <Field label="Odometer">
          <AffixInput
            suffix="mi"
            numeric
            inputMode="decimal"
            value={odometerText}
            placeholder={lastOdometer != null ? String(Math.round(lastOdometer) + 2500) : "514800"}
            onChange={(e) => setOdometerText(digitsAndDots(e.target.value))}
          />
        </Field>
        <Field label="Gallons">
          <AffixInput
            suffix="gal"
            numeric
            inputMode="decimal"
            value={gallonsText}
            placeholder="400"
            onChange={(e) => setGallonsText(digitsAndDots(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === "Enter") add();
            }}
          />
        </Field>
      </div>
      {preview && <p className="text-sm text-foreground/80 mt-3">{preview}</p>}
      {error && (
        <Notice tone="error" className="mt-3">
          {error}
        </Notice>
      )}
      <Button
        variant="primary"
        className="mt-4 w-full sm:w-auto"
        onClick={add}
        pending={pending}
      >
        {pending ? "Saving…" : "Add week"}
      </Button>

      {entries.length > 0 && (
        <ul className="mt-5 divide-y divide-border border-t border-border">
          {entries.map((entry) => {
            const shown = fuelEntryPresentation(entry);
            return (
              <li
                key={entry.id ?? `${entry.logged_on}-${entry.odometer}`}
                className="flex items-center gap-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    {shortDate(entry.logged_on)}{" "}
                    <span className="font-normal text-muted tabular-nums">
                      · {miles(entry.odometer)} mi
                    </span>
                  </p>
                  <p className="text-xs text-muted tabular-nums">
                    {entry.miles != null ? `${miles(entry.miles)} miles · ` : ""}
                    {entry.gallons.toLocaleString("en-US")} gal
                  </p>
                </div>
                {/* The week's reading, and its state in words when it has one. */}
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {shown.mpg && (
                    <p className="whitespace-nowrap leading-none">
                      <span className="pr-figure text-[15px] font-semibold">
                        {shown.mpg}
                      </span>{" "}
                      <span className="text-xs font-semibold text-muted">MPG</span>
                    </p>
                  )}
                  {shown.state && (
                    <Chip tone={shown.state.tone} title={shown.state.title}>
                      {shown.state.label}
                    </Chip>
                  )}
                </div>
                {entry.id && (
                  <RecordDeleteButton
                    className="-mr-3"
                    onClick={() => remove(entry.id!)}
                    disabled={pending}
                    aria-label={`Delete week of ${shortDate(entry.logged_on)}`}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
