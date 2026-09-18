"use client";

import { Card } from "@/components/ui/Surfaces";
import { Notice } from "@/components/ui/Notice";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Field, NumberField, TextInput } from "@/components/ui/Field";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  deleteCapitalAssetAction,
  upsertCapitalAssetAction,
} from "@/lib/tax/actions";
import type { CapitalAsset } from "@/lib/tax/types";

export function AssetForm({
  initial,
  assetId,
}: {
  initial: CapitalAsset;
  assetId?: string;
}) {
  const router = useRouter();
  const [a, setA] = useState<CapitalAsset>({ ...initial, id: assetId });
  const [pending, startTransition] = useTransition();
  const [deletePending, startDelete] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    startTransition(async () => {
      const r = await upsertCapitalAssetAction(a);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.push(`/tax/assets?year=${a.placed_in_service.slice(0, 4)}`);
      router.refresh();
    });
  }

  function remove() {
    if (!assetId) return;
    if (!confirm("Delete this capital asset? This cannot be undone.")) return;
    setError(null);
    startDelete(async () => {
      const r = await deleteCapitalAssetAction(assetId);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.push(`/tax/assets?year=${a.placed_in_service.slice(0, 4)}`);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-4">
        <Field label="Description">
          <TextInput
            type="text"
            value={a.description}
            placeholder='e.g. "2022 Freightliner Cascadia" or "Reefer trailer #2"'
            onChange={(ev) =>
              setA((s) => ({ ...s, description: ev.target.value }))
            }
          />
        </Field>

        <Field label="Placed in service">
          <TextInput
            type="date"
            value={a.placed_in_service}
            onChange={(ev) =>
              setA((s) => ({ ...s, placed_in_service: ev.target.value }))
            }
          />
          <p className="text-xs text-muted leading-snug">
            The date the asset was ready and available for use. Drives the
            depreciation start date the CPA will use.
          </p>
        </Field>

        <Field label="Cost">
          <NumberField
            prefix="$"
            value={a.cost}
            onChange={(cost) => setA((s) => ({ ...s, cost }))}
          />
          <p className="text-xs text-muted leading-snug">
            Original purchase price (or basis). Your CPA depreciates / applies
            §179. This number never gets added to your expense totals.
          </p>
        </Field>
      </Card>

      {error && (
        <Notice tone="error">{error}</Notice>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
        {assetId && (
          <Button
            variant="destructive"
            className="sm:mr-auto"
            onClick={remove}
            pending={deletePending}
            disabled={pending}
          >
            {deletePending ? "Deleting…" : "Delete"}
          </Button>
        )}
        <ButtonLink
          href={`/tax/assets?year=${a.placed_in_service.slice(0, 4)}`}
          variant="secondary"
        >
          Cancel
        </ButtonLink>
        <Button
          variant="primary"
          className="sm:min-w-44"
          onClick={save}
          pending={pending}
          disabled={deletePending || !a.description.trim() || a.cost <= 0}
        >
          {pending ? "Saving…" : assetId ? "Save changes" : "Save asset"}
        </Button>
      </div>
    </div>
  );
}
