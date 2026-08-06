"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  saveProfileAction,
  saveSnapshotAction,
  setRealCpmOverrideAction,
  type CostProfile,
} from "./actions";
import { ProfileBanner } from "@/components/ProfileBanner";
import { VisitorPitch } from "@/components/VisitorPitch";
import {
  VISITOR_PROFILE_KEY,
  loadVisitorProfile,
  saveVisitorProfile,
  clearVisitorProfile,
} from "@/lib/visitorProfile";

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

const cpm = (n: number) =>
  Number.isFinite(n) && n > 0
    ? `$${n.toFixed(2)}`
    : "$0.00";

type NumKey = keyof CostProfile;

function textForValue(value: number) {
  return value === 0 ? "" : String(value);
}

function cleanInput(raw: string) {
  const onlyAllowed = raw.replace(/[^0-9.]/g, "");
  const firstDot = onlyAllowed.indexOf(".");
  if (firstDot === -1) return onlyAllowed;
  return (
    onlyAllowed.slice(0, firstDot + 1) +
    onlyAllowed.slice(firstDot + 1).replace(/\./g, "")
  );
}

function MoneyInput({
  label,
  hint,
  value,
  onChange,
  prefix = "$",
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
  const lastExternalValueRef = useRef(value);

  // Resync only when parent value changes externally (e.g., snapshot load),
  // not while the user is typing intermediate states like "." or "0.4".
  useEffect(() => {
    if (value !== lastExternalValueRef.current) {
      const ours = text === "" || text === "." ? 0 : parseFloat(text);
      if (value !== ours) setText(textForValue(value));
      lastExternalValueRef.current = value;
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
            const next = cleanInput(e.target.value);
            setText(next);
            const parsed = next === "" || next === "." ? 0 : parseFloat(next);
            const v = Number.isFinite(parsed) ? parsed : 0;
            lastExternalValueRef.current = v;
            onChange(v);
          }}
          onBlur={() => {
            // Tidy up trailing dot or empty on blur: "0." -> "0", "." -> "0"
            if (text === "." || text === "") {
              setText("");
              return;
            }
            if (text.endsWith(".")) {
              setText(text.slice(0, -1));
            }
          }}
          className={`w-full h-12 ${
            prefix ? "pl-8" : "pl-4"
          } ${
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
        <p className="text-sm text-muted mb-4 leading-snug">{subtitle}</p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
    </section>
  );
}

export function Calculator({
  initial,
  profileComplete,
  loggedLoadCount = 0,
  realCPMFromLoads = null,
  isAuthed = true,
  hasSavedProfile = true,
}: {
  initial: CostProfile;
  profileComplete: boolean;
  loggedLoadCount?: number;
  realCPMFromLoads?: number | null;
  isAuthed?: boolean;
  hasSavedProfile?: boolean;
}) {
  const router = useRouter();
  const [p, setP] = useState<CostProfile>(initial);
  const [label, setLabel] = useState("");
  const [showSnapshot, setShowSnapshot] = useState(false);
  const [showSignupCTA, setShowSignupCTA] = useState(false);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState<null | "ok" | "snapshot" | string>(null);
  const [overridePending, startOverride] = useTransition();
  const [overrideJustSet, setOverrideJustSet] = useState<number | null>(null);

  const set = (k: NumKey) => (v: number) => setP((s) => ({ ...s, [k]: v }));

  // Phase 0.6: hydrate from localStorage for visitors (no DB) AND for
  // freshly-signed-up users whose DB row is still empty. Skip if the
  // signed-in user already has a saved profile.
  useEffect(() => {
    if (isAuthed && hasSavedProfile) return;
    const stored = loadVisitorProfile();
    if (stored) setP((s) => ({ ...s, ...stored }));
  }, [isAuthed, hasSavedProfile]);

  // Mirror state to localStorage at all times for visitors, so their
  // numbers survive a refresh or a signup hop.
  useEffect(() => {
    if (!isAuthed) {
      saveVisitorProfile(p);
    }
  }, [p, isAuthed]);

  const totals = useMemo(() => {
    const fixed =
      p.truck_payment +
      p.trailer_payment +
      p.insurance +
      p.eld_subscriptions +
      p.permits_irp_ifta +
      p.office_misc +
      p.load_board_per_month +
      p.other_monthly_bill;

    const fuelPerMile = p.mpg > 0 ? p.fuel_price_per_gallon / p.mpg : 0;
    const variablePerMile =
      fuelPerMile +
      p.maintenance_per_mile +
      p.tires_per_mile +
      p.def_per_mile +
      p.driver_pay_per_mile +
      p.tolls_misc_per_mile;

    const fixedPerMile = p.monthly_miles > 0 ? fixed / p.monthly_miles : 0;
    const computedCPM = fixedPerMile + variablePerMile;
    // Phase 0.2: when the user has tapped "Update my estimate", we display
    // and use the override instead of the freshly-computed total.
    const totalCPM =
      p.real_cpm_override != null && p.real_cpm_override > 0
        ? p.real_cpm_override
        : computedCPM;
    const requiredRate = totalCPM + p.desired_profit_per_mile;
    const breakEven = totalCPM * p.monthly_miles;
    const projectedProfit = p.desired_profit_per_mile * p.monthly_miles;

    return {
      fixed,
      fuelPerMile,
      variablePerMile,
      fixedPerMile,
      computedCPM,
      totalCPM,
      requiredRate,
      breakEven,
      projectedProfit,
    };
  }, [p]);

  function save() {
    if (!isAuthed) {
      saveVisitorProfile(p);
      setShowSignupCTA(true);
      return;
    }
    setSaved(null);
    startTransition(async () => {
      const r = await saveProfileAction(p);
      if (r.ok) {
        setSaved("ok");
        clearVisitorProfile();
        setTimeout(() => setSaved(null), 2500);
      } else {
        setSaved(r.error);
      }
    });
  }

  function applyRealCpmOverride(value: number | null) {
    if (!isAuthed) return;
    startOverride(async () => {
      const r = await setRealCpmOverrideAction(value);
      if (r.ok) {
        setP((s) => ({ ...s, real_cpm_override: value }));
        setOverrideJustSet(value);
        setTimeout(() => setOverrideJustSet(null), 2500);
        router.refresh();
      }
    });
  }

  function saveSnapshot() {
    setSaved(null);
    startTransition(async () => {
      const r = await saveSnapshotAction(p, label);
      if (r.ok) {
        setSaved("snapshot");
        setLabel("");
        setShowSnapshot(false);
        setTimeout(() => setSaved(null), 3000);
      } else {
        setSaved(r.error);
      }
    });
  }

  const realInsightVisible =
    isAuthed && loggedLoadCount >= 5 && realCPMFromLoads != null;
  const overrideActive =
    p.real_cpm_override != null && p.real_cpm_override > 0;

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 pb-44 md:pb-28">
      {isAuthed && <ProfileBanner profileComplete={profileComplete} />}
      {realInsightVisible && (
        <div className="bg-white border border-border rounded-2xl p-4 mb-4">
          <p className="text-xs uppercase tracking-wider text-muted font-semibold">
            From your loads
          </p>
          <p className="text-sm mt-1 leading-snug">
            Your real cost/mile from{" "}
            <span className="font-bold">{loggedLoadCount} logged loads</span>:{" "}
            <span className="font-bold text-brand-dark">
              ${realCPMFromLoads!.toFixed(2)}
            </span>{" "}
            <span className="text-muted">
              (you estimated ${totals.computedCPM.toFixed(2)})
            </span>
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => applyRealCpmOverride(realCPMFromLoads!)}
              disabled={overridePending}
              className="inline-flex items-center justify-center h-10 px-4 rounded-xl bg-brand hover:bg-brand-dark text-white text-sm font-semibold disabled:opacity-60"
            >
              {overridePending
                ? "Updating…"
                : overrideActive
                ? `Refresh override to $${realCPMFromLoads!.toFixed(2)}`
                : `Update my estimate to $${realCPMFromLoads!.toFixed(2)}`}
            </button>
            {overrideJustSet != null && (
              <span className="text-xs text-brand-dark font-semibold">
                ✓ Updated
              </span>
            )}
          </div>
        </div>
      )}
      {/* Big result card */}
      <div className="bg-gradient-to-br from-brand to-brand-dark text-white rounded-2xl p-5 mb-4 shadow-sm">
        <p className="text-xs uppercase tracking-wider opacity-80 font-semibold">
          Your true cost per mile
        </p>
        <p className="text-5xl font-black mt-1 leading-none">
          {cpm(totals.totalCPM)}
        </p>
        {overrideActive && (
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
            <span
              className="inline-flex items-center gap-1 bg-amber-300 text-amber-950 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider"
              title="You set this value manually from your logged loads. Editing the line items below will not change this number until you reset."
            >
              Manual
            </span>
            <button
              type="button"
              onClick={() => applyRealCpmOverride(null)}
              disabled={overridePending}
              className="underline underline-offset-2 text-white/90 hover:text-white font-semibold disabled:opacity-60"
            >
              Reset to computed (${totals.computedCPM.toFixed(2)})
            </button>
          </div>
        )}
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="bg-white/15 rounded-xl p-3">
            <p className="opacity-80 text-xs">Minimum target rate</p>
            <p className="text-xl font-bold">{cpm(totals.requiredRate)}</p>
            <p className="text-xs opacity-80 mt-0.5">
              (cost + {cpm(p.desired_profit_per_mile)} profit)
            </p>
          </div>
          <div className="bg-white/15 rounded-xl p-3">
            <p className="opacity-80 text-xs">Break-even monthly revenue</p>
            <p className="text-xl font-bold">
              {money(Math.round(totals.breakEven))}
            </p>
            <p className="text-xs opacity-80 mt-0.5">
              at {p.monthly_miles.toLocaleString()} mi
            </p>
          </div>
        </div>
        {totals.projectedProfit > 0 && (
          <div className="mt-3 bg-white/15 rounded-xl p-3 text-sm">
            <p className="opacity-80 text-xs">
              Projected monthly profit at target rate
            </p>
            <p className="text-xl font-bold">
              {money(Math.round(totals.projectedProfit))}
            </p>
          </div>
        )}
      </div>

      <Section
        title="Fixed Costs (Monthly)"
        subtitle="Bills you pay whether you run 5,000 miles or 12,000."
      >
        <MoneyInput
          label="Truck Payment"
          value={p.truck_payment}
          onChange={set("truck_payment")}
        />
        <MoneyInput
          label="Trailer Payment"
          value={p.trailer_payment}
          onChange={set("trailer_payment")}
        />
        <MoneyInput
          label="Insurance"
          value={p.insurance}
          onChange={set("insurance")}
        />
        <MoneyInput
          label="ELD / Subscriptions"
          value={p.eld_subscriptions}
          onChange={set("eld_subscriptions")}
        />
        <MoneyInput
          label="Permits / IRP / IFTA / HUT"
          hint="Include HUT (Form 2290) for trucks over 55,000 lbs. Yearly fees ÷ 12."
          value={p.permits_irp_ifta}
          onChange={set("permits_irp_ifta")}
        />
        <MoneyInput
          label="Office / Parking"
          value={p.office_misc}
          onChange={set("office_misc")}
        />
        <MoneyInput
          label="Load Board"
          hint="DAT, Truckstop, 123Loadboard, etc."
          value={p.load_board_per_month}
          onChange={set("load_board_per_month")}
        />
        <div className="sm:col-span-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-foreground">
              Other Monthly Bill
            </span>
            <span className="text-xs text-muted -mt-1">
              Anything else: Skool, lawyer, accounting, board load, etc. Name
              it so you remember.
            </span>
            <input
              type="text"
              value={p.other_label}
              onChange={(e) =>
                setP((s) => ({ ...s, other_label: e.target.value.slice(0, 60) }))
              }
              placeholder="What is it? (e.g. Skool)"
              className="w-full h-12 px-4 rounded-xl border border-border bg-white text-base focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </label>
          <div className="mt-3">
            <MoneyInput
              label="Amount per month"
              value={p.other_monthly_bill}
              onChange={set("other_monthly_bill")}
            />
          </div>
        </div>
        <div className="sm:col-span-2 flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 text-sm">
          <span className="font-semibold">Total Fixed Costs</span>
          <span className="font-bold">{money(totals.fixed)}</span>
        </div>
      </Section>

      <Section
        title="Monthly Miles"
        subtitle="How many loaded + empty miles you typically run per month."
      >
        <div className="sm:col-span-2">
          <MoneyInput
            label="Monthly Miles Driven"
            value={p.monthly_miles}
            onChange={set("monthly_miles")}
            prefix=""
            suffix="mi"
          />
        </div>
      </Section>

      <Section
        title="Fuel"
        subtitle="We figure out your fuel cost per mile from MPG and pump price."
      >
        <MoneyInput
          label="Truck MPG"
          hint="e.g. 6.5"
          value={p.mpg}
          onChange={set("mpg")}
          prefix=""
          suffix="mpg"
        />
        <MoneyInput
          label="Diesel Price / Gallon"
          value={p.fuel_price_per_gallon}
          onChange={set("fuel_price_per_gallon")}
        />
        <div className="sm:col-span-2 flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 text-sm">
          <span className="font-semibold">Fuel Cost Per Mile</span>
          <span className="font-bold">{cpm(totals.fuelPerMile)}</span>
        </div>
      </Section>

      <Section
        title="Other Per-Mile Costs"
        subtitle="Cents add up. Don't skip these — this is where most operators lie to themselves."
      >
        <MoneyInput
          label="Maintenance Reserve / mile"
          hint="Save for repairs. $0.15–$0.25 is realistic."
          value={p.maintenance_per_mile}
          onChange={set("maintenance_per_mile")}
        />
        <MoneyInput
          label="Tires / mile"
          hint="Drive + steer + trailer tire wear."
          value={p.tires_per_mile}
          onChange={set("tires_per_mile")}
        />
        <MoneyInput
          label="DEF / mile"
          value={p.def_per_mile}
          onChange={set("def_per_mile")}
        />
        <MoneyInput
          label="Tolls / Scales / Misc / mile"
          value={p.tolls_misc_per_mile}
          onChange={set("tolls_misc_per_mile")}
        />
        <div className="sm:col-span-2">
          <MoneyInput
            label="Driver Pay"
            hint="What you pay yourself per mile. Typically $0.40–$0.99."
            value={p.driver_pay_per_mile}
            onChange={set("driver_pay_per_mile")}
          />
        </div>
        <div className="sm:col-span-2 flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 text-sm">
          <span className="font-semibold">Total Variable / mile</span>
          <span className="font-bold">{cpm(totals.variablePerMile)}</span>
        </div>
      </Section>

      <Section
        title="Profit Target"
        subtitle="Profit ON TOP of paying yourself. This is what grows the business."
      >
        <div className="sm:col-span-2">
          <MoneyInput
            label="Desired Profit Per Mile"
            hint="e.g. $0.30–$0.70"
            value={p.desired_profit_per_mile}
            onChange={set("desired_profit_per_mile")}
          />
        </div>
      </Section>

      <div className="bg-white border border-border rounded-2xl p-5 mb-4">
        <p className="text-sm font-semibold mb-1">Save a dated snapshot</p>
        <p className="text-xs text-muted mb-3 leading-snug">
          Keep a record of these costs to compare later. Use this whenever
          your costs change meaningfully — new carrier, paid off trailer, etc.
        </p>
        {showSnapshot ? (
          <div className="flex flex-col gap-2">
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder='e.g. "Carrier XYZ" or "Aug 2026"'
              maxLength={80}
              autoFocus
              className="w-full h-12 px-4 rounded-xl border border-border bg-white text-base focus:outline-none focus:ring-2 focus:ring-brand"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowSnapshot(false);
                  setLabel("");
                }}
                disabled={pending}
                className="h-10 px-4 rounded-xl border border-border bg-white text-sm font-semibold hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={saveSnapshot}
                disabled={pending || !label.trim() || !isAuthed}
                className="flex-1 h-10 px-4 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold text-sm disabled:opacity-50"
              >
                {pending ? "Saving…" : "Save a dated snapshot"}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              if (!isAuthed) {
                setShowSignupCTA(true);
                return;
              }
              setShowSnapshot(true);
            }}
            className="inline-flex items-center justify-center h-10 px-4 rounded-xl border border-border bg-white text-sm font-semibold hover:border-brand hover:text-brand-dark"
          >
            + Save a dated snapshot
          </button>
        )}
        <div className="mt-3 text-right">
          <Link
            href="/history"
            className="text-sm font-semibold text-brand hover:text-brand-dark"
          >
            View save history →
          </Link>
        </div>
      </div>

      {/* Visitors: after they've seen their own number, pitch the tracker. */}
      {!isAuthed && <VisitorPitch />}

      {/* Save bar */}
      <div
        className="fixed inset-x-0 bg-white border-t border-border px-4 py-3 z-20 bottom-[calc(64px+env(safe-area-inset-bottom))] md:bottom-0"
      >
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="flex-1 text-xs text-muted">
            {saved === "ok"
              ? "✓ Costs updated"
              : saved === "snapshot"
              ? "✓ Snapshot saved to History"
              : saved && saved !== "ok"
              ? `Error: ${saved}`
              : isAuthed
              ? "Changes your current numbers. No dated copy."
              : "Free to play with — sign up to save your numbers."}
          </div>
          <button
            onClick={save}
            disabled={pending}
            className="h-12 px-6 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold transition disabled:opacity-60"
          >
            {pending && !showSnapshot
              ? "Saving..."
              : isAuthed
              ? "Update my costs"
              : "Save my numbers"}
          </button>
        </div>
      </div>

      {showSignupCTA && (
        <div
          className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/40 px-4"
          onClick={() => setShowSignupCTA(false)}
        >
          <div
            className="bg-white rounded-2xl p-5 max-w-sm w-full"
            onClick={(ev) => ev.stopPropagation()}
          >
            <h3 className="text-lg font-black mb-1">
              Create a free account to save this
            </h3>
            <p className="text-sm text-muted mb-4 leading-snug">
              We&apos;ll keep these numbers so they&apos;re ready next time
              you open the app — and you&apos;ll unlock saved snapshots so
              you can compare different setups.
            </p>
            <div className="flex flex-col gap-2">
              <Link
                href="/login"
                className="h-12 inline-flex items-center justify-center rounded-xl bg-brand hover:bg-brand-dark text-white font-bold"
              >
                Create free account
              </Link>
              <button
                type="button"
                onClick={() => setShowSignupCTA(false)}
                className="h-10 inline-flex items-center justify-center rounded-xl text-sm text-muted hover:text-foreground"
              >
                Keep tinkering
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Silence unused-import warnings when both helpers aren't reached
          at runtime in some code paths. */}
      {false && <span>{VISITOR_PROFILE_KEY}</span>}
    </div>
  );
}
