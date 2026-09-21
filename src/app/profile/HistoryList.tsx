"use client";

import { useRouter } from "next/navigation";
import { Notice } from "@/components/ui/Notice";
import { Button } from "@/components/ui/Button";
import { formatRate } from "@/lib/format";
import { useState, useTransition } from "react";
import { deleteSnapshotAction, loadSnapshotAction } from "../actions";

export type Snapshot = {
  id: string;
  label: string | null;
  total_cpm: number;
  required_rate: number;
  monthly_miles: number;
  desired_profit_per_mile: number;
  created_at: string;
  /** Carrier and split when the snapshot was saved. 0% = independent;
   *  null on snapshots saved before carriers were recorded. */
  carrier_name: string | null;
  carrier_pct: number | null;
};

function carrierLine(s: Snapshot): string | null {
  if (s.carrier_pct != null && s.carrier_pct > 0) {
    const kept = Number((100 - s.carrier_pct).toFixed(2));
    return `Leased to ${s.carrier_name || "a carrier"} · kept ${kept}%`;
  }
  if (s.carrier_pct === 0) return "Independent · kept 100%";
  if (s.carrier_name) return `Leased to ${s.carrier_name}`;
  return null;
}


function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function HistoryList({ snapshots }: { snapshots: Snapshot[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function load(id: string) {
    setError(null);
    setPendingId(id);
    startTransition(async () => {
      const r = await loadSnapshotAction(id);
      setPendingId(null);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.push("/calculator");
      router.refresh();
    });
  }

  function remove(id: string) {
    if (!confirm("Delete this saved snapshot? This cannot be undone.")) return;
    setError(null);
    setPendingId(id);
    startTransition(async () => {
      const r = await deleteSnapshotAction(id);
      setPendingId(null);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <Notice tone="error">{error}</Notice>
      )}
      {snapshots.map((s) => (
        <section
          key={s.id}
          aria-labelledby={`snapshot-${s.id}`}
          className="pr-record p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3
                id={`snapshot-${s.id}`}
                className="truncate font-display text-base font-bold"
              >
                {s.label || "Untitled save"}
              </h3>
              <p className="text-xs text-muted">{formatDate(s.created_at)}</p>
              {carrierLine(s) && (
                <p className="mt-0.5 text-[13px] text-foreground/80">
                  {carrierLine(s)}
                </p>
              )}
            </div>
            {/* The number this snapshot is kept for. */}
            <div className="shrink-0 text-right">
              <p className="pr-record-label">Cost / mile</p>
              <p className="pr-figure mt-1 text-2xl font-bold leading-none">
                {formatRate(Number(s.total_cpm))}
              </p>
            </div>
          </div>
          {/* Supporting readings: no tiles, a hairline above them. */}
          <dl className="mt-3 grid grid-cols-3 gap-3 border-t border-border pt-3">
            <div className="min-w-0">
              <dt className="pr-record-label">Target rate</dt>
              <dd className="pr-figure mt-1 text-[15px] font-semibold">
                {formatRate(Number(s.required_rate))}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="pr-record-label">Miles / mo</dt>
              <dd className="mt-1 text-[15px] font-semibold tabular-nums">
                {Number(s.monthly_miles).toLocaleString()}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="pr-record-label">Profit / mi</dt>
              <dd className="pr-figure mt-1 text-[15px] font-semibold">
                {formatRate(Number(s.desired_profit_per_mile))}
              </dd>
            </div>
          </dl>
          <div className="mt-3 flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="flex-1"
              onClick={() => load(s.id)}
              pending={pendingId === s.id}
            >
              {pendingId === s.id ? "Loading…" : "Load into Calculator"}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => remove(s.id)}
              disabled={pendingId === s.id}
            >
              Delete
            </Button>
          </div>
        </section>
      ))}
    </div>
  );
}
