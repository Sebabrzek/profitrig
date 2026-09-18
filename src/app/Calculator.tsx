"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  saveProfileAction,
  saveSnapshotAction,
  setRealCpmOverrideAction,
  type CostProfile,
} from "./actions";
import { computeCalculatorTotals } from "@/lib/calculatorTotals";
import { formatMoney, formatRate } from "@/lib/format";
import {
  InstrumentPanel,
  Reading,
  ReadingGrid,
} from "@/components/instruments/Instruments";
import { ProfileBanner } from "@/components/ProfileBanner";
import { Card, CardHeader } from "@/components/ui/Surfaces";
import { ActionBar } from "@/components/ui/ActionBar";
import { Button } from "@/components/ui/Button";
import { Field, NumberField, TextInput } from "@/components/ui/Field";
import {
  AnswerColumn,
  AnswerLayout,
  WorkColumn,
} from "@/components/shell/AnswerLayout";
import { VisitorPitch } from "@/components/VisitorPitch";
import {
  VISITOR_PROFILE_KEY,
  loadVisitorProfile,
  saveVisitorProfile,
  clearVisitorProfile,
} from "@/lib/visitorProfile";

type NumKey = keyof CostProfile;

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
  return (
    <Field label={label} hint={hint}>
      <NumberField
        value={value}
        onChange={onChange}
        prefix={prefix || undefined}
        suffix={suffix}
      />
    </Field>
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
    <Card className="mb-4">
      <CardHeader title={title} description={subtitle} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
    </Card>
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

  const totals = useMemo(() => computeCalculatorTotals(p), [p]);

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
    <div>
      {isAuthed && <ProfileBanner profileComplete={profileComplete} />}
      <AnswerLayout>
      <AnswerColumn>
      {realInsightVisible && (
        <Card as="div" className="mb-4">
          <CardHeader title="From your loads" className="mb-1" />
          <p className="text-sm leading-snug">
            Your real cost/mile from{" "}
            <span className="font-bold">{loggedLoadCount} logged loads</span>:{" "}
            <span className="font-bold text-brand-dark">
              {formatRate(realCPMFromLoads!)}
            </span>{" "}
            <span className="text-muted">
              (you estimated {formatRate(totals.computedCPM)})
            </span>
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              variant="dark"
              size="sm"
              onClick={() => applyRealCpmOverride(realCPMFromLoads!)}
              pending={overridePending}
            >
              {overridePending
                ? "Updating…"
                : overrideActive
                ? `Refresh override to ${formatRate(realCPMFromLoads!)}`
                : `Update my estimate to ${formatRate(realCPMFromLoads!)}`}
            </Button>
            {overrideJustSet != null && (
              <span className="text-xs text-brand-dark font-semibold">
                ✓ Updated
              </span>
            )}
          </div>
        </Card>
      )}
      {/* Big result card */}
      <InstrumentPanel>
        <Reading
          size="hero"
          label="Your true cost per mile"
          value={formatRate(totals.totalCPM)}
        >
          {overrideActive && (
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
              <span
                className="inline-flex items-center rounded-full border border-[var(--pr-border-dark)] bg-white/10 px-2 py-0.5 font-display font-bold uppercase tracking-wider text-[var(--pr-off-white)]"
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
                Reset to computed ({formatRate(totals.computedCPM)})
              </button>
            </div>
          )}
        </Reading>
        <ReadingGrid>
          <Reading
            label="Minimum target rate"
            value={formatRate(totals.requiredRate)}
            context={<>(cost + {formatRate(p.desired_profit_per_mile)} profit)</>}
          />
          <Reading
            label="Break-even monthly revenue"
            value={formatMoney(Math.round(totals.breakEven))}
            context={<>at {p.monthly_miles.toLocaleString()} mi</>}
          />
          {totals.projectedProfit > 0 && (
            <Reading
              fullRowWhenNarrow
              label="Projected monthly profit at target rate"
              value={formatMoney(Math.round(totals.projectedProfit), {
                signed: true,
              })}
            />
          )}
        </ReadingGrid>
      </InstrumentPanel>

      </AnswerColumn>
      <WorkColumn>
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
          <Field
            label="Other Monthly Bill"
            hint="Anything else: Skool, lawyer, accounting, board load, etc. Name it so you remember."
          >
            <TextInput
              type="text"
              value={p.other_label}
              onChange={(e) =>
                setP((s) => ({ ...s, other_label: e.target.value.slice(0, 60) }))
              }
              placeholder="What is it? (e.g. Skool)"
            />
          </Field>
          <div className="mt-3">
            <MoneyInput
              label="Amount per month"
              value={p.other_monthly_bill}
              onChange={set("other_monthly_bill")}
            />
          </div>
        </div>
        <div className="sm:col-span-2 flex items-center justify-between bg-pr-surface-muted rounded-[var(--pr-radius-input)] px-4 py-3 text-sm">
          <span className="font-semibold">Total Fixed Costs</span>
          <span className="font-bold">{formatMoney(totals.fixed)}</span>
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
        <div className="sm:col-span-2 flex items-center justify-between bg-pr-surface-muted rounded-[var(--pr-radius-input)] px-4 py-3 text-sm">
          <span className="font-semibold">Fuel Cost Per Mile</span>
          <span className="font-bold">{formatRate(totals.fuelPerMile)}</span>
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
        <div className="sm:col-span-2 flex items-center justify-between bg-pr-surface-muted rounded-[var(--pr-radius-input)] px-4 py-3 text-sm">
          <span className="font-semibold">Total Variable / mile</span>
          <span className="font-bold">{formatRate(totals.variablePerMile)}</span>
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

      <Card className="mb-4">
        <CardHeader
          title="Save a dated snapshot"
          description="Keep a record of these costs to compare later. Use this whenever your costs change meaningfully — new carrier, paid off trailer, etc."
        />
        {showSnapshot ? (
          <div className="flex flex-col gap-2">
            <TextInput
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder='e.g. "Carrier XYZ" or "Aug 2026"'
              aria-label="Snapshot name"
              maxLength={80}
              autoFocus
            />
            <div className="flex gap-2 sm:justify-end">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowSnapshot(false);
                  setLabel("");
                }}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                className="flex-1 sm:flex-none"
                onClick={saveSnapshot}
                pending={pending}
                disabled={!label.trim() || !isAuthed}
              >
                {pending ? "Saving…" : "Save a dated snapshot"}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              if (!isAuthed) {
                setShowSignupCTA(true);
                return;
              }
              setShowSnapshot(true);
            }}
          >
            + Save a dated snapshot
          </Button>
        )}
        <div className="mt-3 text-right">
          <Link href="/profile#history" className="pr-link pr-hit text-sm">
            View save history →
          </Link>
        </div>
      </Card>

      {/* Visitors: after they've seen their own number, pitch the tracker. */}
      {!isAuthed && <VisitorPitch />}

      </WorkColumn>
      </AnswerLayout>

      {/* Save bar */}
      <ActionBar
        tone={
          saved === "ok" || saved === "snapshot"
            ? "success"
            : saved
            ? "error"
            : "default"
        }
        status={
          saved === "ok"
            ? "✓ Costs updated"
            : saved === "snapshot"
            ? "✓ Snapshot saved to History"
            : saved && saved !== "ok"
            ? `Error: ${saved}`
            : isAuthed
            ? "Changes your current numbers. No dated copy."
            : "Free to play with — sign up to save your numbers."
        }
      >
        <Button
          variant="primary"
          onClick={save}
          pending={pending && !showSnapshot}
          disabled={pending}
        >
          {pending && !showSnapshot
            ? "Saving…"
            : isAuthed
            ? "Update my costs"
            : "Save my numbers"}
        </Button>
      </ActionBar>

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
