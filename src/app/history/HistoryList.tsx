"use client";

import { useRouter } from "next/navigation";
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
};

const money = (n: number) =>
  Number.isFinite(n)
    ? `$${Number(n).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    : "$0.00";

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
      router.push("/");
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
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
          {error}
        </div>
      )}
      {snapshots.map((s) => (
        <div
          key={s.id}
          className="bg-white border border-border rounded-2xl p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-bold text-base truncate">
                {s.label || "Untitled save"}
              </p>
              <p className="text-xs text-muted">{formatDate(s.created_at)}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs text-muted">Cost / mile</p>
              <p className="text-xl font-black text-brand-dark leading-none">
                {money(Number(s.total_cpm))}
              </p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
            <div className="bg-gray-50 rounded-lg px-3 py-2">
              <p className="text-muted">Target rate</p>
              <p className="font-bold text-sm">
                {money(Number(s.required_rate))}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg px-3 py-2">
              <p className="text-muted">Miles / mo</p>
              <p className="font-bold text-sm">
                {Number(s.monthly_miles).toLocaleString()}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg px-3 py-2">
              <p className="text-muted">Profit / mi</p>
              <p className="font-bold text-sm">
                {money(Number(s.desired_profit_per_mile))}
              </p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => load(s.id)}
              disabled={pendingId === s.id}
              className="flex-1 h-10 rounded-xl bg-brand hover:bg-brand-dark text-white font-semibold text-sm disabled:opacity-60"
            >
              {pendingId === s.id ? "Loading..." : "Load into Calculator"}
            </button>
            <button
              onClick={() => remove(s.id)}
              disabled={pendingId === s.id}
              className="h-10 px-4 rounded-xl border border-border text-sm text-muted hover:text-red-600 hover:border-red-300 disabled:opacity-60"
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
