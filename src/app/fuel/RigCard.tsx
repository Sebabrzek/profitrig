"use client";

import { useState, useTransition } from "react";
import { Card, CardHeader } from "@/components/ui/Surfaces";
import { Notice } from "@/components/ui/Notice";
import { saveRigAction } from "../actions";
import type { Rig, Transmission } from "@/lib/fuel";

const ENGINES = [
  "Cummins X15",
  "Cummins ISX15",
  "Detroit DD15",
  "Detroit DD13",
  "PACCAR MX-13",
  "PACCAR MX-11",
  "Volvo D13",
  "Mack MP8",
  "International S13",
  "Caterpillar C15",
];

const inputClass =
  "w-full h-12 px-4 rounded-xl border border-border bg-white text-base focus:outline-none focus:ring-2 focus:ring-brand";

const digitsOnly = (v: string) => v.replace(/[^0-9.]/g, "");

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-foreground">{label}</span>
      {children}
    </label>
  );
}

export function RigCard({ initial }: { initial: Rig }) {
  const hasRig = Boolean(
    initial.make ||
      initial.model ||
      initial.year ||
      initial.engine ||
      initial.transmission ||
      initial.starting_odometer != null
  );
  const [editing, setEditing] = useState(!hasRig);
  const [rig, setRig] = useState<Rig>(initial);
  const [yearText, setYearText] = useState(initial.year == null ? "" : String(initial.year));
  const [odometerText, setOdometerText] = useState(
    initial.starting_odometer == null ? "" : String(initial.starting_odometer)
  );
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function save() {
    setError("");
    const year = yearText.trim() === "" ? null : Number(yearText);
    const starting_odometer =
      odometerText.trim() === "" ? null : Number(odometerText);
    const next = { ...rig, year, starting_odometer };
    startTransition(async () => {
      const r = await saveRigAction(next);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setRig(next);
      setEditing(false);
    });
  }

  const title = [rig.year, rig.make, rig.model].filter(Boolean).join(" ");
  const details = [
    rig.engine,
    rig.transmission === "automatic" ? "Automatic" : rig.transmission === "manual" ? "Manual" : "",
    rig.starting_odometer != null
      ? `Started at ${Math.round(rig.starting_odometer).toLocaleString("en-US")} mi`
      : "",
  ].filter(Boolean);

  if (!editing) {
    return (
      <Card className="mb-4">
        <CardHeader
          className=""
          eyebrow="Your rig"
          title={title || "Your truck"}
          description={details.length > 0 ? details.join(" · ") : undefined}
          aside={
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="shrink-0 text-sm font-semibold text-brand hover:text-brand-dark"
            >
              Edit
            </button>
          }
        />
      </Card>
    );
  }

  return (
    <Card className="mb-4">
      <CardHeader
        title="Your rig"
        description="The truck you're tracking, and its odometer when you start."
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Make">
          <input
            className={inputClass}
            value={rig.make}
            placeholder="Freightliner"
            onChange={(e) => setRig((s) => ({ ...s, make: e.target.value }))}
          />
        </Field>
        <Field label="Model">
          <input
            className={inputClass}
            value={rig.model}
            placeholder="Cascadia"
            onChange={(e) => setRig((s) => ({ ...s, model: e.target.value }))}
          />
        </Field>
        <Field label="Year">
          <input
            className={inputClass}
            inputMode="numeric"
            value={yearText}
            placeholder="2021"
            maxLength={4}
            onChange={(e) => setYearText(e.target.value.replace(/[^0-9]/g, ""))}
          />
        </Field>
        <Field label="Engine">
          <input
            className={inputClass}
            value={rig.engine}
            placeholder="Detroit DD15"
            list="engine-options"
            onChange={(e) => setRig((s) => ({ ...s, engine: e.target.value }))}
          />
          <datalist id="engine-options">
            {ENGINES.map((e) => (
              <option key={e} value={e} />
            ))}
          </datalist>
        </Field>
        <Field label="Transmission">
          <select
            className={inputClass}
            value={rig.transmission}
            onChange={(e) =>
              setRig((s) => ({ ...s, transmission: e.target.value as Transmission | "" }))
            }
          >
            <option value="">Select…</option>
            <option value="automatic">Automatic</option>
            <option value="manual">Manual</option>
          </select>
        </Field>
        <Field label="Starting odometer">
          <div className="relative">
            <input
              className={`${inputClass} pr-12`}
              inputMode="decimal"
              value={odometerText}
              placeholder="512300"
              onChange={(e) => setOdometerText(digitsOnly(e.target.value))}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted text-sm pointer-events-none">
              mi
            </span>
          </div>
        </Field>
      </div>
      {error && (
        <Notice tone="error" className="mt-3">
          {error}
        </Notice>
      )}
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="flex-1 h-12 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold disabled:opacity-60 transition"
        >
          {pending ? "Saving…" : "Save truck"}
        </button>
        {hasRig && (
          <button
            type="button"
            onClick={() => {
              setRig(initial);
              setYearText(initial.year == null ? "" : String(initial.year));
              setOdometerText(
                initial.starting_odometer == null ? "" : String(initial.starting_odometer)
              );
              setError("");
              setEditing(false);
            }}
            disabled={pending}
            className="h-12 px-4 rounded-xl border border-border text-sm font-semibold text-muted hover:text-foreground transition"
          >
            Cancel
          </button>
        )}
      </div>
    </Card>
  );
}
