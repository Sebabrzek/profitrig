"use client";

import { useState, useTransition } from "react";
import { Card, CardHeader } from "@/components/ui/Surfaces";
import { Notice } from "@/components/ui/Notice";
import { Button } from "@/components/ui/Button";
import {
  AffixInput,
  Field,
  SelectInput,
  TextInput,
} from "@/components/ui/Field";
import { digitsAndDots, digitsOnly } from "@/lib/numericInput";
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
            <Button
              variant="secondary"
              size="sm"
              className="shrink-0"
              onClick={() => setEditing(true)}
            >
              Edit
            </Button>
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
          <TextInput
            value={rig.make}
            placeholder="Freightliner"
            onChange={(e) => setRig((s) => ({ ...s, make: e.target.value }))}
          />
        </Field>
        <Field label="Model">
          <TextInput
            value={rig.model}
            placeholder="Cascadia"
            onChange={(e) => setRig((s) => ({ ...s, model: e.target.value }))}
          />
        </Field>
        <Field label="Year">
          <TextInput
            inputMode="numeric"
            value={yearText}
            placeholder="2021"
            maxLength={4}
            onChange={(e) => setYearText(digitsOnly(e.target.value))}
          />
        </Field>
        <Field label="Engine">
          <TextInput
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
          <SelectInput
            value={rig.transmission}
            onChange={(e) =>
              setRig((s) => ({ ...s, transmission: e.target.value as Transmission | "" }))
            }
          >
            <option value="">Select…</option>
            <option value="automatic">Automatic</option>
            <option value="manual">Manual</option>
          </SelectInput>
        </Field>
        <Field label="Starting odometer">
          <AffixInput
            suffix="mi"
            numeric
            inputMode="decimal"
            value={odometerText}
            placeholder="512300"
            onChange={(e) => setOdometerText(digitsAndDots(e.target.value))}
          />
        </Field>
      </div>
      {error && (
        <Notice tone="error" className="mt-3">
          {error}
        </Notice>
      )}
      <div className="mt-4 flex gap-2">
        <Button
          variant="primary"
          className="flex-1 sm:flex-none"
          onClick={save}
          pending={pending}
        >
          {pending ? "Saving…" : "Save truck"}
        </Button>
        {hasRig && (
          <Button
            variant="secondary"
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
          >
            Cancel
          </Button>
        )}
      </div>
    </Card>
  );
}
