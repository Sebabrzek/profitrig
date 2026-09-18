"use client";

import { useState, useTransition } from "react";
import { Card, CardHeader } from "@/components/ui/Surfaces";
import { Notice } from "@/components/ui/Notice";
import { Button } from "@/components/ui/Button";
import { useRouter } from "next/navigation";
import { saveTaxProfileAction } from "@/lib/tax/actions";
import {
  driverPayTreatment,
  type EntityType,
  type TaxProfile,
  type TruckFinancing,
} from "@/lib/tax/types";

const ENTITY_OPTIONS: { value: EntityType; label: string; hint: string }[] = [
  {
    value: "sole_prop",
    label: "Sole proprietor",
    hint: "You file your business on Schedule C. Your owner pay is a draw, not a deduction.",
  },
  {
    value: "smllc",
    label: "Single-member LLC",
    hint: "Same federal tax treatment as sole proprietor (unless you elected S-corp).",
  },
  {
    value: "s_corp",
    label: "S-corporation",
    hint: "You file Form 1120-S and pay yourself W-2 wages, which ARE deductible to the business.",
  },
];

const FINANCING_OPTIONS: { value: TruckFinancing; label: string; hint: string }[] = [
  {
    value: "owned_financed",
    label: "Owned, financed (loan)",
    hint: "Monthly payment is NOT a deduction. Only loan interest is. Principal is recovered via depreciation/§179 on the asset.",
  },
  {
    value: "owned_outright",
    label: "Owned outright",
    hint: "No payment; depreciation/§179 applies to the asset itself.",
  },
  {
    value: "leased",
    label: "Leased",
    hint: "Lease payments ARE deductible. Enter actual lease payments under Expenses.",
  },
];

export function TaxProfileForm({ initial }: { initial: TaxProfile }) {
  const router = useRouter();
  const [profile, setProfile] = useState<TaxProfile>(initial);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState<null | "ok" | string>(null);

  function save() {
    setSaved(null);
    startTransition(async () => {
      const r = await saveTaxProfileAction(profile);
      if (r.ok) {
        setSaved("ok");
        setTimeout(() => setSaved(null), 2500);
        router.refresh();
      } else {
        setSaved(r.error);
      }
    });
  }

  const treatment = driverPayTreatment(profile);
  const treatmentLabel =
    treatment === "owner_draw_excluded"
      ? "Owner's pay = draw (excluded from Tax Pack)"
      : treatment === "wages_or_1099"
      ? "Hired driver wages (W-2) or contract labor (1099) — enter as Expenses"
      : "Owner W-2 wages — enter as Expenses (S-corp)";

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader
          title="Entity type"
          description="Pick the entity that files your taxes. If your LLC elected S-corp, pick S-corporation."
        />
        <div className="flex flex-col gap-2">
          {ENTITY_OPTIONS.map((o) => (
            <label
              key={o.value}
              className={`flex items-start gap-3 p-3 rounded-[var(--pr-radius-input)] border-2 cursor-pointer transition ${
                profile.entity_type === o.value
                  ? "border-[var(--pr-rig-green)] bg-pr-surface-muted"
                  : "border-border hover:border-[var(--pr-border-strong)]"
              }`}
            >
              <input
                type="radio"
                name="entity_type"
                value={o.value}
                checked={profile.entity_type === o.value}
                onChange={() =>
                  setProfile((p) => ({ ...p, entity_type: o.value }))
                }
                className="mt-0.5 accent-[var(--pr-rig-green)]"
              />
              <div>
                <p className="text-sm font-semibold">{o.label}</p>
                <p className="text-xs text-muted leading-snug">{o.hint}</p>
              </div>
            </label>
          ))}
        </div>
        <label className="flex items-start gap-3 mt-4 p-3 rounded-[var(--pr-radius-input)] border-2 border-border cursor-pointer">
          <input
            type="checkbox"
            checked={profile.has_hired_driver}
            onChange={(e) =>
              setProfile((p) => ({ ...p, has_hired_driver: e.target.checked }))
            }
            className="mt-0.5 h-5 w-5 accent-[var(--pr-rig-green)]"
          />
          <div>
            <p className="text-sm font-semibold">I have a hired driver</p>
            <p className="text-xs text-muted leading-snug">
              I pay another person to drive — W-2 employee or 1099 contractor.
              Their pay goes into the Tax Pack as wages/contract labor (enter
              as an Expense).
            </p>
          </div>
        </label>
        <div className="mt-4 bg-pr-surface-muted rounded-[var(--pr-radius-input)] px-4 py-3 text-sm">
          <p className="text-xs text-muted uppercase tracking-wider font-semibold">
            Driver-pay treatment for this profile
          </p>
          <p className="font-semibold mt-1">{treatmentLabel}</p>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Truck financing"
          description="Drives which truck-payment numbers belong in the Tax Pack."
        />
        <div className="flex flex-col gap-2">
          {FINANCING_OPTIONS.map((o) => (
            <label
              key={o.value}
              className={`flex items-start gap-3 p-3 rounded-[var(--pr-radius-input)] border-2 cursor-pointer transition ${
                profile.truck_financing === o.value
                  ? "border-[var(--pr-rig-green)] bg-pr-surface-muted"
                  : "border-border hover:border-[var(--pr-border-strong)]"
              }`}
            >
              <input
                type="radio"
                name="truck_financing"
                value={o.value}
                checked={profile.truck_financing === o.value}
                onChange={() =>
                  setProfile((p) => ({ ...p, truck_financing: o.value }))
                }
                className="mt-0.5 accent-[var(--pr-rig-green)]"
              />
              <div>
                <p className="text-sm font-semibold">{o.label}</p>
                <p className="text-xs text-muted leading-snug">{o.hint}</p>
              </div>
            </label>
          ))}
        </div>
      </Card>

      {saved === "ok" && (
        <p role="status" className="text-sm font-semibold text-[var(--pr-rig-green)]">
          ✓ Saved
        </p>
      )}
      {saved && saved !== "ok" && (
        <Notice tone="error">{`Error: ${saved}`}</Notice>
      )}

      <div className="flex gap-2">
        <Button
          variant="primary"
          className="flex-1 sm:flex-none"
          onClick={save}
          pending={pending}
          disabled={!profile.entity_type || !profile.truck_financing}
        >
          {pending ? "Saving…" : "Save tax profile"}
        </Button>
      </div>
    </div>
  );
}
