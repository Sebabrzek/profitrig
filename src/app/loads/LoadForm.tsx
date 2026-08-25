"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  MTD_FALLBACK_THRESHOLD_MILES,
  type Load,
  buildMtdContext,
  computeLoadEconomics,
} from "@/lib/loads";
import type { CostProfile } from "../actions";
import { deleteLoadAction, saveLoadAction } from "../actions";

const money = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });

const moneyCompact = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

function textForValue(v: number) {
  return v === 0 ? "" : String(v);
}

function cleanNumeric(raw: string) {
  const only = raw.replace(/[^0-9.]/g, "");
  const dot = only.indexOf(".");
  if (dot === -1) return only;
  return only.slice(0, dot + 1) + only.slice(dot + 1).replace(/\./g, "");
}

function NumInput({
  label,
  hint,
  value,
  onChange,
  prefix,
  suffix,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (n: number) => void;
  prefix?: string;
  suffix?: string;
}) {
  const [text, setText] = useState(() => textForValue(value));
  const lastExternal = useRef(value);

  useEffect(() => {
    if (value !== lastExternal.current) {
      const ours = text === "" || text === "." ? 0 : parseFloat(text);
      if (value !== ours) setText(textForValue(value));
      lastExternal.current = value;
    }
  }, [value, text]);

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-foreground">{label}</span>
      {hint && <span className="text-xs text-muted -mt-1">{hint}</span>}
      <div className="relative">
        {prefix && (
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted font-semibold pointer-events-none">
            {prefix}
          </span>
        )}
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={text}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => {
            const next = cleanNumeric(e.target.value);
            setText(next);
            const parsed = next === "" || next === "." ? 0 : parseFloat(next);
            const v = Number.isFinite(parsed) ? parsed : 0;
            lastExternal.current = v;
            onChange(v);
          }}
          onBlur={() => {
            if (text === "." || text === "") {
              setText("");
              return;
            }
            if (text.endsWith(".")) setText(text.slice(0, -1));
          }}
          className={`w-full h-12 ${prefix ? "pl-8" : "pl-4"} ${
            suffix ? "pr-12" : "pr-4"
          } rounded-xl border border-border bg-white text-base font-medium focus:outline-none focus:ring-2 focus:ring-brand`}
        />
        {suffix && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted text-sm pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
    </label>
  );
}

function OptionalMoneyInput({
  label,
  hint,
  value,
  estimate,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number | null;
  estimate: number;
  onChange: (n: number | null) => void;
}) {
  const usingEstimate = value === null;
  const displayValue = usingEstimate ? 0 : value;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">{label}</span>
        {usingEstimate ? (
          <button
            type="button"
            onClick={() => onChange(0)}
            className="text-xs font-semibold text-brand hover:text-brand-dark"
          >
            Enter actual
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs font-semibold text-muted hover:text-foreground"
          >
            Use estimate
          </button>
        )}
      </div>
      {hint && <span className="text-xs text-muted -mt-1">{hint}</span>}
      {usingEstimate ? (
        <div className="h-12 px-4 rounded-xl border border-dashed border-border bg-gray-50 flex items-center justify-between">
          <span className="text-muted text-sm">Estimated</span>
          <span className="font-semibold text-sm">{money(estimate)}</span>
        </div>
      ) : (
        <NumInput
          label=""
          value={displayValue}
          onChange={(n) => onChange(n)}
        />
      )}
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white border border-border rounded-2xl p-5 mb-4">
      <h2 className="text-lg font-bold mb-1">{title}</h2>
      {subtitle && (
        <p className="text-sm text-muted mb-3 leading-snug">{subtitle}</p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
    </section>
  );
}

export function LoadForm({
  initial,
  costProfile,
  loadId,
  otherMonthMiles = 0,
  monthFirstDay = 1,
}: {
  initial: Load;
  costProfile: CostProfile;
  loadId?: string;
  /**
   * Total miles already logged in this load's calendar month for every
   * OTHER load. Used so this form can preview the MTD-allocated fixed
   * cost live — adding this load's current miles in computeLoadEconomics.
   * Defaults to 0 for safety; computeLoadEconomics will then fall back to
   * the saved Monthly Miles assumption.
   */
  otherMonthMiles?: number;
  /**
   * Day-of-month of the earliest load already logged in this load's month.
   * Drives the run-rate window so a driver who started mid-month isn't
   * charged as though they had been parked since the 1st.
   */
  monthFirstDay?: number;
}) {
  const router = useRouter();
  const [load, setLoad] = useState<Load>({ ...initial, id: loadId });
  const [pending, startTransition] = useTransition();
  const [deletePending, startDelete] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const e = useMemo(
    () =>
      computeLoadEconomics(
        load,
        costProfile,
        buildMtdContext(load.load_date, otherMonthMiles, monthFirstDay)
      ),
    [load, costProfile, otherMonthMiles, monthFirstDay]
  );

  const setField = <K extends keyof Load>(k: K) => (v: Load[K]) =>
    setLoad((s) => ({ ...s, [k]: v }));

  function save() {
    setError(null);
    startTransition(async () => {
      const r = await saveLoadAction(load);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.push("/loads");
      router.refresh();
    });
  }

  function remove() {
    if (!loadId) return;
    if (
      !confirm(
        "Delete this load? This cannot be undone."
      )
    )
      return;
    setError(null);
    startDelete(async () => {
      const r = await deleteLoadAction(loadId);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.push("/loads");
      router.refresh();
    });
  }

  return (
    <div>
      {/* Live profit result */}
      <div
        className={`rounded-2xl p-5 mb-4 shadow-sm text-white ${
          e.profit >= 0
            ? "bg-gradient-to-br from-brand to-brand-dark"
            : "bg-gradient-to-br from-red-500 to-red-700"
        }`}
      >
        <p className="text-xs uppercase tracking-wider opacity-80 font-semibold">
          Profit this load
        </p>
        <p className="text-5xl font-black mt-1 leading-none">
          {money(e.profit)}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <div className="bg-white/15 rounded-xl p-3">
            <p className="opacity-80 text-xs">Rate achieved</p>
            <p className="text-xl font-black leading-none">
              {e.totalMiles > 0 ? `$${e.rpm.toFixed(2)}` : "—"}
              <span className="text-xs font-bold opacity-80"> /mi</span>
            </p>
            {e.totalMiles > 0 && (
              <p
                className={`text-[11px] font-semibold mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full ${
                  e.rpm >= e.cpm
                    ? "bg-white/25 text-white"
                    : "bg-red-100/90 text-red-900"
                }`}
              >
                {e.rpm >= e.cpm ? "↑" : "↓"} {`$${e.cpm.toFixed(2)}`} cost
              </p>
            )}
          </div>
          <div className="bg-white/15 rounded-xl p-3">
            <p className="opacity-80 text-xs">Miles</p>
            <p className="text-xl font-black leading-none">
              {e.totalMiles.toLocaleString()}
            </p>
            {e.totalMiles > 0 && (
              <p className="text-[11px] opacity-80 mt-1">
                {e.deadheadPct.toFixed(0)}% deadhead
              </p>
            )}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div className="bg-white/15 rounded-xl p-3">
            <p className="opacity-80 text-xs">Revenue</p>
            <p className="text-base font-bold">{moneyCompact(e.revenue)}</p>
          </div>
          <div className="bg-white/15 rounded-xl p-3">
            <p className="opacity-80 text-xs">Cost</p>
            <p className="text-base font-bold">{moneyCompact(e.totalCost)}</p>
          </div>
        </div>
        {e.totalMiles > 0 && (
          <div className="mt-2 text-xs opacity-90">
            Net {`$${e.profitPerMile.toFixed(2)}`}/mi
          </div>
        )}
      </div>

      <Section title="Trip info">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Date</span>
          <input
            type="date"
            value={load.load_date}
            onChange={(ev) => setField("load_date")(ev.target.value)}
            className="w-full h-12 px-4 rounded-xl border border-border bg-white text-base focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Broker / customer</span>
          <input
            type="text"
            value={load.broker}
            placeholder="e.g. CH Robinson"
            onChange={(ev) => setField("broker")(ev.target.value)}
            className="w-full h-12 px-4 rounded-xl border border-border bg-white text-base focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Origin</span>
          <input
            type="text"
            value={load.origin}
            placeholder="City, ST"
            onChange={(ev) => setField("origin")(ev.target.value)}
            className="w-full h-12 px-4 rounded-xl border border-border bg-white text-base focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Destination</span>
          <input
            type="text"
            value={load.destination}
            placeholder="City, ST"
            onChange={(ev) => setField("destination")(ev.target.value)}
            className="w-full h-12 px-4 rounded-xl border border-border bg-white text-base focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </label>
      </Section>

      <Section
        title="Miles"
        subtitle="Profit is always calculated on TOTAL miles (loaded + deadhead)."
      >
        <NumInput
          label="Loaded miles"
          value={load.loaded_miles}
          onChange={setField("loaded_miles")}
          suffix="mi"
        />
        <div className="sm:col-span-1">
          <NumInput
            label="Deadhead (empty) miles"
            hint="Log each empty leg once — either after this load or before the next, not both."
            value={load.deadhead_miles}
            onChange={setField("deadhead_miles")}
            suffix="mi"
          />
          {load.deadhead_miles > load.loaded_miles && load.loaded_miles > 0 && (
            <p className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-snug">
              ⚠ Deadhead is higher than loaded miles. Double-check you&apos;re
              not counting the same empty leg here AND on the next load.
            </p>
          )}
        </div>
        <div className="sm:col-span-2 flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 text-sm">
          <span className="font-semibold">Total miles</span>
          <span className="font-bold">
            {e.totalMiles.toLocaleString()}
            {e.totalMiles > 0 && (
              <span className="text-muted font-normal text-xs ml-2">
                ({e.deadheadPct.toFixed(0)}% deadhead)
              </span>
            )}
          </span>
        </div>
      </Section>

      <Section title="Revenue" subtitle="What the broker paid you for this load.">
        <NumInput
          label="Linehaul pay"
          hint="The flat rate on the rate confirmation."
          value={load.linehaul_pay}
          onChange={setField("linehaul_pay")}
        />
        <NumInput
          label="Fuel surcharge (FSC)"
          value={load.fuel_surcharge}
          onChange={setField("fuel_surcharge")}
        />
        <div className="sm:col-span-2">
          <NumInput
            label="Accessorials"
            hint="Detention, layover, tarping, multi-stop, etc."
            value={load.accessorials}
            onChange={setField("accessorials")}
          />
        </div>
        <div className="sm:col-span-2 flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 text-sm">
          <span className="font-semibold">Total revenue</span>
          <span className="font-bold">{money(e.revenue)}</span>
        </div>
      </Section>

      <Section
        title="Actual costs"
        subtitle="Optional. If you leave them on Estimate, we use your saved MPG & cost-per-mile values."
      >
        <OptionalMoneyInput
          label="Fuel"
          hint={`Estimate uses ${
            costProfile.mpg > 0 ? `${costProfile.mpg} MPG @ ` : ""
          }$${costProfile.fuel_price_per_gallon.toFixed(2)}/gal.`}
          value={load.fuel_actual}
          estimate={e.fuelIsEstimated ? e.fuelCost : 0}
          onChange={setField("fuel_actual")}
        />
        <OptionalMoneyInput
          label="Tolls"
          hint="Leave blank if none."
          value={load.tolls_actual}
          estimate={0}
          onChange={setField("tolls_actual")}
        />
        <div className="sm:col-span-2">
          <OptionalMoneyInput
            label="Lumpers / parking / meals (not reimbursed)"
            hint="Out-of-pocket trip costs you didn't get paid back for."
            value={load.lumpers_actual}
            estimate={0}
            onChange={setField("lumpers_actual")}
          />
        </div>
      </Section>

      <Section
        title="Auto-allocated from your cost profile"
      >
        <div className="sm:col-span-2 grid grid-cols-2 gap-3 text-sm">
          <div className="bg-gray-50 rounded-xl px-3 py-2">
            <p className="text-muted text-xs">Driver pay</p>
            <p className="font-bold">{money(e.driverPayCost)}</p>
          </div>
          <div className="bg-gray-50 rounded-xl px-3 py-2">
            <p className="text-muted text-xs">Maintenance reserve</p>
            <p className="font-bold">{money(e.maintenanceCost)}</p>
          </div>
          <div className="bg-gray-50 rounded-xl px-3 py-2">
            <p className="text-muted text-xs">Tires</p>
            <p className="font-bold">{money(e.tiresCost)}</p>
          </div>
          <div className="bg-gray-50 rounded-xl px-3 py-2">
            <p className="text-muted text-xs">DEF</p>
            <p className="font-bold">{money(e.defCost)}</p>
          </div>
          <div className="col-span-2 bg-gray-50 rounded-xl px-3 py-2">
            <p className="text-muted text-xs">
              Fixed costs allocated (truck/trailer/insurance/permits/overhead)
            </p>
            <p className="font-bold">{money(e.allocatedFixedCost)}</p>
            <p className="text-xs text-muted mt-0.5">
              {e.allocationBasis === "actual_mtd" ? (
                <>
                  Share of monthly bills based on{" "}
                  <span className="font-semibold text-foreground">
                    actual MTD: {e.allocationBasisMiles.toLocaleString()} mi
                  </span>
                  .
                </>
              ) : (
                <>
                  Share of monthly bills based on your{" "}
                  <span className="font-semibold text-foreground">
                    assumed Monthly Miles:{" "}
                    {e.allocationBasisMiles.toLocaleString()} mi
                  </span>
                  . Switches to actual once you&apos;ve logged{" "}
                  {MTD_FALLBACK_THRESHOLD_MILES.toLocaleString()} mi this
                  month.
                </>
              )}
            </p>
          </div>
        </div>
      </Section>

      <Section title="Notes (optional)">
        <div className="sm:col-span-2">
          <textarea
            value={load.notes}
            onChange={(ev) => setField("notes")(ev.target.value.slice(0, 2000))}
            rows={3}
            placeholder="Anything you want to remember about this load."
            className="w-full p-4 rounded-xl border border-border bg-white text-base focus:outline-none focus:ring-2 focus:ring-brand resize-y"
          />
        </div>
      </Section>

      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
          {error}
        </div>
      )}

      <div className="flex flex-col-reverse sm:flex-row gap-3 items-stretch">
        {loadId && (
          <button
            type="button"
            onClick={remove}
            disabled={deletePending || pending}
            className="h-12 px-6 rounded-xl border border-border bg-white text-red-600 font-semibold hover:bg-red-50 hover:border-red-300 disabled:opacity-50 transition"
          >
            {deletePending ? "Deleting..." : "Delete"}
          </button>
        )}
        <Link
          href="/loads"
          className="h-12 px-6 rounded-xl border border-border bg-white text-foreground font-semibold flex items-center justify-center hover:bg-gray-50"
        >
          Cancel
        </Link>
        <button
          type="button"
          onClick={save}
          disabled={pending || deletePending}
          className="flex-1 h-12 px-6 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold disabled:opacity-60 transition"
        >
          {pending ? "Saving..." : loadId ? "Save changes" : "Save load"}
        </button>
      </div>
    </div>
  );
}
