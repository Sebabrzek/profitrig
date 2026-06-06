"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  deleteCapitalAssetAction,
  upsertCapitalAssetAction,
} from "@/lib/tax/actions";
import type { CapitalAsset } from "@/lib/tax/types";

function cleanNumeric(raw: string) {
  const onlyAllowed = raw.replace(/[^0-9.]/g, "");
  const firstDot = onlyAllowed.indexOf(".");
  if (firstDot === -1) return onlyAllowed;
  return (
    onlyAllowed.slice(0, firstDot + 1) +
    onlyAllowed.slice(firstDot + 1).replace(/\./g, "")
  );
}

export function AssetForm({
  initial,
  assetId,
}: {
  initial: CapitalAsset;
  assetId?: string;
}) {
  const router = useRouter();
  const [a, setA] = useState<CapitalAsset>({ ...initial, id: assetId });
  const [costText, setCostText] = useState(() =>
    initial.cost === 0 ? "" : String(initial.cost)
  );
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
      <section className="bg-white border border-border rounded-2xl p-5 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Description</span>
          <input
            type="text"
            value={a.description}
            placeholder='e.g. "2022 Freightliner Cascadia" or "Reefer trailer #2"'
            onChange={(ev) =>
              setA((s) => ({ ...s, description: ev.target.value }))
            }
            className="w-full h-12 px-4 rounded-xl border border-border bg-white text-base focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Placed in service</span>
          <input
            type="date"
            value={a.placed_in_service}
            onChange={(ev) =>
              setA((s) => ({ ...s, placed_in_service: ev.target.value }))
            }
            className="w-full h-12 px-4 rounded-xl border border-border bg-white text-base focus:outline-none focus:ring-2 focus:ring-brand"
          />
          <p className="text-xs text-muted leading-snug">
            The date the asset was ready and available for use. Drives the
            depreciation start date the CPA will use.
          </p>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Cost</span>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted font-semibold pointer-events-none">
              $
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={costText}
              onFocus={(ev) => ev.currentTarget.select()}
              onChange={(ev) => {
                const next = cleanNumeric(ev.target.value);
                setCostText(next);
                const parsed = next === "" || next === "." ? 0 : parseFloat(next);
                setA((s) => ({
                  ...s,
                  cost: Number.isFinite(parsed) ? parsed : 0,
                }));
              }}
              onBlur={() => {
                if (costText === "." || costText === "") setCostText("");
                else if (costText.endsWith("."))
                  setCostText(costText.slice(0, -1));
              }}
              className="w-full h-12 pl-8 pr-4 rounded-xl border border-border bg-white text-base font-medium focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>
          <p className="text-xs text-muted leading-snug">
            Original purchase price (or basis). Your CPA depreciates / applies
            §179. This number never gets added to your expense totals.
          </p>
        </label>
      </section>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
          {error}
        </div>
      )}

      <div className="flex flex-col-reverse sm:flex-row gap-3 items-stretch">
        {assetId && (
          <button
            type="button"
            onClick={remove}
            disabled={deletePending || pending}
            className="h-12 px-6 rounded-xl border border-border bg-white text-red-600 font-semibold hover:bg-red-50 hover:border-red-300 disabled:opacity-50 transition"
          >
            {deletePending ? "Deleting…" : "Delete"}
          </button>
        )}
        <Link
          href={`/tax/assets?year=${a.placed_in_service.slice(0, 4)}`}
          className="h-12 px-6 rounded-xl border border-border bg-white text-foreground font-semibold flex items-center justify-center hover:bg-gray-50"
        >
          Cancel
        </Link>
        <button
          type="button"
          onClick={save}
          disabled={
            pending || deletePending || !a.description.trim() || a.cost <= 0
          }
          className="flex-1 h-12 px-6 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold disabled:opacity-60"
        >
          {pending ? "Saving…" : assetId ? "Save changes" : "Save asset"}
        </button>
      </div>
    </div>
  );
}
