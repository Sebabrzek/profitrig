"use client";

import { useState } from "react";
import { Card, CardHeader } from "@/components/ui/Surfaces";
import { Field, NumberField } from "@/components/ui/Field";
import { payCheck } from "@/lib/breakEven";
import { formatRate } from "@/lib/format";
import { payCheckFigures } from "@/lib/records";

/**
 * "Is this load worth it?" before it is booked — free, on the Calculator.
 * Miles and pay in, break-even and target out, at the Calculator's own cost
 * per mile (the number at the top of the page) on every mile, loaded and
 * deadhead, exactly as its minimum target rate is worked out. Nothing here
 * is saved; a logged load is priced with its real fuel and its month's miles
 * instead (lib/loads).
 */
export function CheckALoad({
  costPerMile,
  desiredProfitPerMile,
  carrierPct,
}: {
  /** The Calculator's true cost per mile, as shown. */
  costPerMile: number;
  desiredProfitPerMile: number;
  /** The driver's carrier % from Profile; 0 for an independent or a visitor. */
  carrierPct: number;
}) {
  const [loaded, setLoaded] = useState(0);
  const [deadhead, setDeadhead] = useState(0);
  const [pays, setPays] = useState(0);
  const miles = Math.max(0, loaded) + Math.max(0, deadhead);
  const check = payCheck({
    cost: costPerMile * miles,
    miles,
    desiredProfitPerMile,
    carrierPct,
    pays,
  });
  const f = check ? payCheckFigures(check) : null;
  const tone =
    f?.outcome === "loss" ? "text-[var(--pr-loss-deep)]" : f?.outcome === "profit" ? "text-[var(--pr-rig-green)]" : "text-[var(--pr-text)]";

  return (
    <Card className="mb-4">
      <CardHeader
        title="Check a load"
        description="Before you book it: is it worth it at your numbers? Nothing here is saved."
      />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Loaded miles">
          <NumberField value={loaded} onChange={setLoaded} />
        </Field>
        <Field label="Deadhead miles">
          <NumberField value={deadhead} onChange={setDeadhead} />
        </Field>
        <Field
          label="What the load pays"
          hint="Linehaul, fuel surcharge and extras, as on the rate con."
          className="col-span-2"
        >
          <NumberField value={pays} onChange={setPays} prefix="$" />
        </Field>
      </div>
      {f && check ? (
        <div className="mt-4 border-t border-border pt-4">
          <dl className="grid grid-cols-2 gap-3">
            <div>
              <dt className="pr-record-label">Break-even</dt>
              <dd className="pr-figure mt-1 text-lg font-semibold">{f.breakEven}</dd>
            </div>
            {f.target && (
              <div>
                <dt className="pr-record-label">Your target</dt>
                <dd className="pr-figure mt-1 text-lg font-semibold">{f.target}</dd>
              </div>
            )}
          </dl>
          <p className={`mt-3 text-sm font-semibold leading-snug ${tone}`}>
            {f.verdict ?? "Type what the load pays to see if it's worth it."}
          </p>
          <p className="mt-2 text-xs leading-snug text-muted">
            At {formatRate(costPerMile, { unit: "mi" })} on all {miles.toLocaleString()} miles
            {f.target ? <>, plus your {formatRate(desiredProfitPerMile)} / mi profit for the target</> : null}
            {carrierPct > 0 ? <>, before your carrier&apos;s {Number(carrierPct.toFixed(2))}%</> : null}.
          </p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted">Type the miles to see what this load needs to pay.</p>
      )}
    </Card>
  );
}
