"use client";

import { useRouter } from "next/navigation";
import { useId, useMemo, useState, useTransition } from "react";
import {
  MTD_FALLBACK_THRESHOLD_MILES,
  type Load,
  buildMtdContext,
  computeLoadEconomics,
} from "@/lib/loads";
import type { CostProfile } from "../actions";
import { deleteLoadAction, saveLoadAction } from "../actions";
import { formatMoney, formatRate, outcomeOf } from "@/lib/format";
import {
  InstrumentPanel,
  PanelNote,
  Reading,
  ReadingGrid,
} from "@/components/instruments/Instruments";
import { Card, CardHeader } from "@/components/ui/Surfaces";
import { Notice } from "@/components/ui/Notice";
import { Chip } from "@/components/ui/Chip";
import { Button, ButtonLink } from "@/components/ui/Button";
import {
  Field,
  NumberField,
  TextArea,
  TextInput,
} from "@/components/ui/Field";
import {
  AnswerColumn,
  AnswerLayout,
  WorkColumn,
} from "@/components/shell/AnswerLayout";

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
  return (
    <Field label={label} hint={hint}>
      <NumberField
        value={value}
        onChange={onChange}
        prefix={prefix}
        suffix={suffix}
      />
    </Field>
  );
}

/**
 * A cost ProfitRig estimates until the driver enters what they really paid.
 * Estimated is neutral, not a warning: the chip says which number the load
 * is using, and one small action switches between them — exactly as before.
 */
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
  const id = useId();
  const hintId = `${id}-hint`;
  const usingEstimate = value === null;

  return (
    <div className="pr-field">
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          {usingEstimate ? (
            <span className="pr-field-label">{label}</span>
          ) : (
            <label htmlFor={id} className="pr-field-label">
              {label}
            </label>
          )}
          <Chip>{usingEstimate ? "Estimated" : "Actual"}</Chip>
        </span>
        {usingEstimate ? (
          <button
            type="button"
            onClick={() => onChange(0)}
            className="pr-link pr-hit shrink-0 text-sm"
          >
            Enter actual
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="pr-link pr-hit shrink-0 text-sm"
          >
            Use estimate
          </button>
        )}
      </div>
      {hint && (
        <span id={hintId} className="pr-field-hint">
          {hint}
        </span>
      )}
      {usingEstimate ? (
        <div className="pr-estimate">{formatMoney(estimate)}</div>
      ) : (
        <NumberField
          id={id}
          aria-describedby={hint ? hintId : undefined}
          prefix="$"
          value={value}
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
    <Card className="mb-4">
      <CardHeader title={title} description={subtitle} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
    </Card>
  );
}

export function LoadForm({
  initial,
  costProfile,
  loadId,
  otherMonthMiles = 0,
  monthFirstDay = 1,
  leased = false,
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
  /** The driver's profile says a carrier keeps a % of each load. */
  leased?: boolean;
}) {
  const router = useRouter();
  const [load, setLoad] = useState<Load>({ ...initial, id: loadId });
  // Shown for leased drivers, and on any load that already carries a split
  // — so a driver who later goes independent can still see and fix it.
  const showCarrierPct = leased || (initial.carrier_pct ?? 0) > 0;
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
    if (
      load.carrier_pct != null &&
      (load.carrier_pct < 0 || load.carrier_pct >= 100)
    ) {
      setError("Carrier % must be under 100.");
      return;
    }
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
    <AnswerLayout>
      <AnswerColumn>
      {/* Live profit result */}
      <InstrumentPanel>
        <Reading
          size="hero"
          label="Profit this load"
          value={formatMoney(e.profit, { signed: true })}
          outcome={outcomeOf(e.profit)}
        />
        <ReadingGrid wideColumns={2}>
          <Reading
            label="Rate achieved"
            value={e.totalMiles > 0 ? formatRate(e.rpm) : "—"}
            unit={e.totalMiles > 0 ? "/ mi" : undefined}
            context={
              e.totalMiles > 0 && (
                <>
                  <span aria-hidden="true">
                    {e.rpm >= e.cpm ? "↑" : "↓"}{" "}
                  </span>
                  <span className="sr-only">
                    {e.rpm >= e.cpm ? "at or above" : "below"}{" "}
                  </span>
                  {formatRate(e.cpm)} cost
                </>
              )
            }
          />
          <Reading
            label="Miles"
            figure={false}
            value={e.totalMiles.toLocaleString()}
            context={
              e.totalMiles > 0 && <>{e.deadheadPct.toFixed(0)}% deadhead</>
            }
          />
          <Reading
            label="Revenue"
            value={formatMoney(e.revenue)}
            context={
              e.carrierCut > 0 && (
                <>after {formatMoney(e.carrierCut)} to carrier</>
              )
            }
          />
          <Reading label="Cost" value={formatMoney(e.totalCost)} />
        </ReadingGrid>
        {e.totalMiles > 0 && (
          <PanelNote>
            Net {formatRate(e.profitPerMile, { signed: true, unit: "mi" })}
          </PanelNote>
        )}
      </InstrumentPanel>

      </AnswerColumn>
      <WorkColumn>
      <Section title="Trip info">
        <Field label="Date">
          <TextInput
            type="date"
            value={load.load_date}
            onChange={(ev) => setField("load_date")(ev.target.value)}
          />
        </Field>
        <Field label="Broker / customer">
          <TextInput
            type="text"
            value={load.broker}
            placeholder="e.g. CH Robinson"
            onChange={(ev) => setField("broker")(ev.target.value)}
          />
        </Field>
        <Field label="Origin">
          <TextInput
            type="text"
            value={load.origin}
            placeholder="City, ST"
            onChange={(ev) => setField("origin")(ev.target.value)}
          />
        </Field>
        <Field label="Destination">
          <TextInput
            type="text"
            value={load.destination}
            placeholder="City, ST"
            onChange={(ev) => setField("destination")(ev.target.value)}
          />
        </Field>
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
            <Notice size="sm" className="mt-2">
              ⚠ Deadhead is higher than loaded miles. Double-check you&apos;re
              not counting the same empty leg here AND on the next load.
            </Notice>
          )}
        </div>
        <div className="sm:col-span-2 flex items-center justify-between bg-pr-surface-muted rounded-[var(--pr-radius-input)] px-4 py-3 text-sm">
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

      <Section
        title="Revenue"
        subtitle={
          showCarrierPct
            ? "What the load paid, and the share you keep."
            : "What the broker paid you for this load."
        }
      >
        <NumInput
          label="Linehaul pay"
          hint="The flat rate on the rate confirmation."
          value={load.linehaul_pay}
          onChange={setField("linehaul_pay")}
          prefix="$"
        />
        <NumInput
          label="Fuel surcharge (FSC)"
          value={load.fuel_surcharge}
          onChange={setField("fuel_surcharge")}
          prefix="$"
        />
        <div className="sm:col-span-2">
          <NumInput
            label="Accessorials"
            hint="Detention, layover, tarping, multi-stop, etc."
            value={load.accessorials}
            onChange={setField("accessorials")}
            prefix="$"
          />
        </div>
        {showCarrierPct && (
          <div className="sm:col-span-2">
            <NumInput
              label="Carrier keeps"
              hint="Filled in from your Profile. Change it for a load paid differently — like detention your carrier passes through in full (0%)."
              value={load.carrier_pct ?? 0}
              onChange={setField("carrier_pct")}
              suffix="%"
            />
          </div>
        )}
        {e.carrierPct > 0 ? (
          <div className="sm:col-span-2 bg-pr-surface-muted rounded-[var(--pr-radius-input)] px-4 py-3 text-sm flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-muted">Load pay</span>
              <span className="font-semibold">{formatMoney(e.loadPay)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted">
                Carrier keeps {Number(e.carrierPct.toFixed(2))}%
              </span>
              <span className="font-semibold">−{formatMoney(e.carrierCut)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-border pt-1.5">
              <span className="font-semibold">You keep</span>
              <span className="font-bold">{formatMoney(e.revenue)}</span>
            </div>
          </div>
        ) : (
          <div className="sm:col-span-2 flex items-center justify-between bg-pr-surface-muted rounded-[var(--pr-radius-input)] px-4 py-3 text-sm">
            <span className="font-semibold">Total revenue</span>
            <span className="font-bold">{formatMoney(e.revenue)}</span>
          </div>
        )}
      </Section>

      <Section
        title="Actual costs"
        subtitle="Optional. If you leave them on Estimate, we use your saved MPG & cost-per-mile values."
      >
        <OptionalMoneyInput
          label="Fuel"
          hint={`Estimate uses ${
            costProfile.mpg > 0 ? `${costProfile.mpg} MPG @ ` : ""
          }${formatRate(costProfile.fuel_price_per_gallon)}/gal.`}
          value={load.fuel_actual}
          estimate={e.fuelIsEstimated ? e.fuelCost : 0}
          onChange={setField("fuel_actual")}
        />
        <OptionalMoneyInput
          label="Tolls"
          hint="Blank = estimated from your tolls/mile rate. Enter 0 if you paid none."
          value={load.tolls_actual}
          estimate={e.tollsIsEstimated ? e.tollsCost : 0}
          onChange={setField("tolls_actual")}
        />
        <div className="sm:col-span-2">
          <OptionalMoneyInput
            label="Lumpers / unloading fees"
            hint={
              'Unloading fees you weren’t paid back for. Food and parking go in "Other expenses this week" on the Loads tab — this box is reported to your accountant, and per diem already covers meals.'
            }
            value={load.lumpers_actual}
            estimate={0}
            onChange={setField("lumpers_actual")}
          />
        </div>
      </Section>

      <Section
        title="Auto-allocated from your cost profile"
      >
        <div className="sm:col-span-2 grid grid-cols-2 gap-x-6 gap-y-5">
          <Reading label="Driver pay" value={formatMoney(e.driverPayCost)} />
          <Reading
            label="Maintenance reserve"
            value={formatMoney(e.maintenanceCost)}
          />
          <Reading label="Tires" value={formatMoney(e.tiresCost)} />
          <Reading label="DEF" value={formatMoney(e.defCost)} />
          <div className="col-span-2">
            <Reading
              label="Fixed costs allocated (truck/trailer/insurance/permits/overhead)"
              value={formatMoney(e.allocatedFixedCost)}
              context={
              e.allocationBasis === "actual_mtd" ? (
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
              )
              }
            />
          </div>
        </div>
      </Section>

      <Section title="Notes (optional)">
        <div className="sm:col-span-2">
          <TextArea
            value={load.notes}
            onChange={(ev) => setField("notes")(ev.target.value.slice(0, 2000))}
            rows={3}
            aria-label="Notes"
            placeholder="Anything you want to remember about this load."
          />
        </div>
      </Section>

      {error && (
        <Notice tone="error" className="mb-4">
          {error}
        </Notice>
      )}

      {/* Phone: Save on top, full width, thumb-reachable. Wider: Delete
          set apart on the left, Cancel and Save together on the right. */}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
        {loadId && (
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
        <ButtonLink href="/loads" variant="secondary">
          Cancel
        </ButtonLink>
        <Button
          variant="primary"
          className="sm:min-w-44"
          onClick={save}
          pending={pending}
          disabled={deletePending}
        >
          {pending ? "Saving…" : loadId ? "Save changes" : "Save load"}
        </Button>
      </div>
      </WorkColumn>
    </AnswerLayout>
  );
}
