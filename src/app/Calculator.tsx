"use client";

import { useMemo, useState, useTransition } from "react";
import { saveProfileAction, type CostProfile } from "./actions";

const money = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

const cpm = (n: number) =>
  Number.isFinite(n) && n > 0
    ? `$${n.toFixed(2)}`
    : "$0.00";

type NumKey = keyof CostProfile;

function MoneyInput({
  label,
  hint,
  value,
  onChange,
  step = "0.01",
  prefix = "$",
  suffix,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (n: number) => void;
  step?: string;
  prefix?: string;
  suffix?: string;
}) {
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
          value={value === 0 ? "" : String(value)}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => {
            const cleaned = e.target.value.replace(/[^0-9.]/g, "");
            const firstDot = cleaned.indexOf(".");
            const normalized =
              firstDot === -1
                ? cleaned
                : cleaned.slice(0, firstDot + 1) +
                  cleaned.slice(firstDot + 1).replace(/\./g, "");
            if (normalized === "" || normalized === ".") {
              onChange(0);
              return;
            }
            const v = parseFloat(normalized);
            onChange(Number.isFinite(v) ? v : 0);
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

export function Calculator({ initial }: { initial: CostProfile }) {
  const [p, setP] = useState<CostProfile>(initial);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState<null | "ok" | string>(null);

  const set = (k: NumKey) => (v: number) => setP((s) => ({ ...s, [k]: v }));

  const totals = useMemo(() => {
    const fixed =
      p.truck_payment +
      p.trailer_payment +
      p.insurance +
      p.eld_subscriptions +
      p.permits_irp_ifta +
      p.office_misc;

    const fuelPerMile = p.mpg > 0 ? p.fuel_price_per_gallon / p.mpg : 0;
    const variablePerMile =
      fuelPerMile +
      p.maintenance_per_mile +
      p.tires_per_mile +
      p.def_per_mile +
      p.owner_operator_rate_per_mile +
      p.tolls_misc_per_mile;

    const fixedPerMile = p.monthly_miles > 0 ? fixed / p.monthly_miles : 0;
    const totalCPM = fixedPerMile + variablePerMile;
    const requiredRate = totalCPM + p.desired_profit_per_mile;
    const breakEven = totalCPM * p.monthly_miles;
    const projectedProfit = p.desired_profit_per_mile * p.monthly_miles;

    return {
      fixed,
      fuelPerMile,
      variablePerMile,
      fixedPerMile,
      totalCPM,
      requiredRate,
      breakEven,
      projectedProfit,
    };
  }, [p]);

  function save() {
    setSaved(null);
    startTransition(async () => {
      const r = await saveProfileAction(p);
      if (r.ok) {
        setSaved("ok");
        setTimeout(() => setSaved(null), 2500);
      } else {
        setSaved(r.error);
      }
    });
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 pb-32">
      {/* Big result card */}
      <div className="bg-gradient-to-br from-brand to-brand-dark text-white rounded-2xl p-5 mb-4 shadow-sm">
        <p className="text-xs uppercase tracking-wider opacity-80 font-semibold">
          Your true cost per mile
        </p>
        <p className="text-5xl font-black mt-1 leading-none">
          {cpm(totals.totalCPM)}
        </p>
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
          label="Permits / IRP / IFTA"
          value={p.permits_irp_ifta}
          onChange={set("permits_irp_ifta")}
        />
        <MoneyInput
          label="Office / Parking / Misc"
          value={p.office_misc}
          onChange={set("office_misc")}
        />
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
            step="100"
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
          step="0.1"
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
            label="Owner Operator Rate Per Mile"
            hint="What you pay yourself per mile. Yes — pay yourself."
            value={p.owner_operator_rate_per_mile}
            onChange={set("owner_operator_rate_per_mile")}
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

      {/* Save bar */}
      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-border px-4 py-3 z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="flex-1 text-xs text-muted">
            {saved === "ok"
              ? "✓ Saved"
              : saved && saved !== "ok"
              ? `Error: ${saved}`
              : "Your numbers save to your account."}
          </div>
          <button
            onClick={save}
            disabled={pending}
            className="h-12 px-6 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold transition disabled:opacity-60"
          >
            {pending ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
