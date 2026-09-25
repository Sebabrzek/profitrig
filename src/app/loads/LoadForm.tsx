"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState, useTransition } from "react";
import {
  MTD_FALLBACK_THRESHOLD_MILES,
  type Load,
  type MonthStats,
  buildMtdContext,
  computeLoadEconomics,
  loadMonthKey,
} from "@/lib/loads";
import {
  MAX_PARTIALS,
  partialExtraMiles,
  tripTotals,
} from "@/lib/partials";
import { partialRecordFigures } from "@/lib/records";
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

/** The primary a partial rides with, as the partial form needs to show it. */
export type PartialOf = {
  id: string;
  /** "Landstar · Laredo, TX → Memphis, TN" */
  label: string;
  /** "Thu, Sep 18" */
  dateLabel: string;
};

export function LoadForm({
  initial,
  costProfile,
  loadId,
  otherMonthMiles = 0,
  monthFirstDay = 1,
  leased = false,
  partialOf,
  trip,
}: {
  initial: Load;
  costProfile: CostProfile;
  loadId?: string;
  /**
   * Set when this form is a partial: it then asks for the extra miles the
   * partial added instead of loaded and deadhead, keeps the primary's date,
   * and leaves fuel and tolls on the estimate for those extra miles.
   */
  partialOf?: PartialOf;
  /**
   * A primary's partials, and whether another can be added. Present only
   * where partials apply: an account they are turned on for, or a load that
   * already has some.
   */
  trip?: {
    partials: Load[];
    canAdd: boolean;
  };
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
  const isPartialForm = Boolean(partialOf);
  const partialCount = trip?.partials.length ?? 0;
  // A partial goes back to the trip it belongs to; anything else to Loads.
  const backHref = partialOf ? `/loads/${partialOf.id}` : "/loads";
  // A partial's extra miles, whichever field a saved row happened to hold.
  const extraMiles =
    (Number(load.loaded_miles) || 0) + (Number(load.deadhead_miles) || 0);
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
      router.push(backHref);
      router.refresh();
    });
  }

  function remove() {
    if (!loadId) return;
    // Deleting a primary takes its partials with it (migration 017): a
    // partial on its own holds only its extra miles. Say so before it goes.
    const message = isPartialForm
      ? "Delete this partial? The load it rode with stays. This cannot be undone."
      : partialCount > 0
        ? `Delete this load and its ${partialCount === 1 ? "partial" : `${partialCount} partials`}? A partial can't stand on its own. This cannot be undone.`
        : "Delete this load? This cannot be undone.";
    if (!confirm(message)) return;
    setError(null);
    startDelete(async () => {
      const r = await deleteLoadAction(loadId);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.push(backHref);
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
          label={isPartialForm ? "Profit this partial adds" : "Profit this load"}
          value={formatMoney(e.profit, { signed: true })}
          outcome={outcomeOf(e.profit)}
        />
        <ReadingGrid wideColumns={2}>
          <Reading
            label={isPartialForm ? "Pay per extra mile" : "Rate achieved"}
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
            label={isPartialForm ? "Extra miles" : "Miles"}
            figure={false}
            value={e.totalMiles.toLocaleString()}
            context={
              !isPartialForm &&
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
        {isPartialForm ? (
          <PanelNote>
            What this partial added on top of the load it rode with — its pay,
            less the cost of its extra miles. The whole trip is on the load.
          </PanelNote>
        ) : (
          e.totalMiles > 0 && (
            <PanelNote>
              Net {formatRate(e.profitPerMile, { signed: true, unit: "mi" })}
            </PanelNote>
          )
        )}
      </InstrumentPanel>
      {trip && trip.partials.length > 0 && (
        <TripPanel
          primary={load}
          partials={trip.partials}
          costProfile={costProfile}
          otherMonthMiles={otherMonthMiles}
          monthFirstDay={monthFirstDay}
        />
      )}

      </AnswerColumn>
      <WorkColumn>
      {trip && loadId && (
        <PartialsCard
          loadId={loadId}
          partials={trip.partials}
          canAdd={trip.canAdd}
          economicsOf={(p) =>
            computeLoadEconomics(
              p,
              costProfile,
              buildMtdContext(
                p.load_date,
                Math.max(0, otherMonthMiles + e.totalMiles - partialExtraMiles(p)),
                monthFirstDay
              )
            )
          }
        />
      )}
      <Section
        title={isPartialForm ? "Partial info" : "Trip info"}
        subtitle={partialOf ? `Rides with ${partialOf.label}` : undefined}
      >
        {partialOf ? (
          <div className="pr-field">
            <span className="pr-field-label">Date</span>
            <span className="pr-field-hint">
              Same day as the load it rides with. Change that load&apos;s date
              and this moves with it.
            </span>
            <div className="pr-estimate">{partialOf.dateLabel}</div>
          </div>
        ) : (
          <Field label="Date">
            <TextInput
              type="date"
              value={load.load_date}
              onChange={(ev) => setField("load_date")(ev.target.value)}
            />
          </Field>
        )}
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

      {isPartialForm ? (
      <Section
        title="Miles"
        subtitle="Only the miles this partial added. The road you drive anyway is already on the load it rides with."
      >
        <div className="sm:col-span-2">
          <NumInput
            label="Extra miles for this partial"
            hint="The miles you're adding to the trip for this partial: the drive to pick it up, plus any miles past the primary's delivery if it drops somewhere else. Enter 0 if it's right on your way."
            value={extraMiles}
            onChange={(n) =>
              setLoad((s) => ({ ...s, loaded_miles: 0, deadhead_miles: n }))
            }
            suffix="mi"
          />
        </div>
      </Section>
      ) : (
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
      )}

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
        subtitle={
          isPartialForm
            ? "Fuel and tolls for a partial are always estimated from its extra miles, so the same road is never paid for twice. Enter lumpers if this partial had its own."
            : "Optional. If you leave them on Estimate, we use your saved MPG & cost-per-mile values."
        }
      >
        {!isPartialForm && (
        <>
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
        </>
        )}
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
        <ButtonLink href={backHref} variant="secondary">
          Cancel
        </ButtonLink>
        <Button
          variant="primary"
          className="sm:min-w-44"
          onClick={save}
          pending={pending}
          disabled={deletePending}
        >
          {pending
            ? "Saving…"
            : loadId
              ? "Save changes"
              : isPartialForm
                ? "Save partial"
                : "Save load"}
        </Button>
      </div>
      </WorkColumn>
    </AnswerLayout>
  );
}

/**
 * The month the trip sits in, as the week's arithmetic wants it: every
 * other load's miles plus this trip's, live as the primary is edited. A
 * primary and its partials always share a date (migration 017), so one
 * month covers all of them.
 */
function tripMonth(
  primary: Load,
  otherMonthMiles: number,
  monthFirstDay: number
): Map<string, MonthStats> {
  const primaryMiles =
    (Number(primary.loaded_miles) || 0) + (Number(primary.deadhead_miles) || 0);
  // otherMonthMiles already holds the partials (they are other loads to the
  // primary's form); only the primary's live miles are added.
  return new Map([
    [
      loadMonthKey(primary.load_date),
      { miles: Math.max(0, otherMonthMiles) + primaryMiles, firstDay: monthFirstDay },
    ],
  ]);
}

/** The whole trip — this load and its partials — as one result. */
function TripPanel({
  primary,
  partials,
  costProfile,
  otherMonthMiles,
  monthFirstDay,
}: {
  primary: Load;
  partials: Load[];
  costProfile: CostProfile;
  otherMonthMiles: number;
  monthFirstDay: number;
}) {
  const t = tripTotals(
    { primary, partials },
    costProfile,
    tripMonth(primary, otherMonthMiles, monthFirstDay)
  );
  const extra = partials.reduce((sum, p) => sum + partialExtraMiles(p), 0);
  return (
    <InstrumentPanel>
      <Reading
        size="hero"
        label="Trip profit"
        value={formatMoney(t.profit, { signed: true })}
        outcome={outcomeOf(t.profit)}
      />
      <ReadingGrid wideColumns={2}>
        <Reading
          label="Trip rate"
          value={t.totalMiles > 0 ? formatRate(t.rpm) : "—"}
          unit={t.totalMiles > 0 ? "/ mi" : undefined}
          context={t.totalMiles > 0 && <>{formatRate(t.cpm)} cost</>}
        />
        <Reading
          label="Trip miles"
          figure={false}
          value={t.totalMiles.toLocaleString()}
          context={<>incl. {extra.toLocaleString()} extra for partials</>}
        />
        <Reading label="Trip revenue" value={formatMoney(t.revenue)} />
        <Reading label="Trip cost" value={formatMoney(t.totalCost)} />
      </ReadingGrid>
      <PanelNote>
        This load and its {partials.length === 1 ? "partial" : "partials"}{" "}
        together: what the truck actually drove and earned.
      </PanelNote>
    </InstrumentPanel>
  );
}

/** A primary's partials, and the way to add one. */
function PartialsCard({
  loadId,
  partials,
  canAdd,
  economicsOf,
}: {
  loadId: string;
  partials: Load[];
  canAdd: boolean;
  economicsOf: (p: Load) => ReturnType<typeof computeLoadEconomics>;
}) {
  const full = partials.length >= MAX_PARTIALS;
  return (
    <Card className="mb-4">
      <CardHeader
        title="Partials"
        description={
          partials.length === 0
            ? "Half a trailer? Add the partial that rides with this load. It records what it adds to the trip: its pay, and only the extra miles."
            : "What each partial added on top of this load."
        }
      />
      {partials.length > 0 && (
        <ul className="mb-3 flex flex-col gap-2">
          {partials.map((p) => {
            const f = partialRecordFigures(economicsOf(p));
            const route =
              p.origin || p.destination
                ? `${p.origin || "—"} → ${p.destination || "—"}`
                : null;
            return (
              <li key={p.id}>
                <Link
                  href={`/loads/${p.id}`}
                  className="pr-record pr-record-link pr-load-partial-link"
                >
                  <div className="pr-load-partial-id">
                    <p className="pr-load-title">{p.broker || "Untitled partial"}</p>
                    {route && <p className="pr-load-route">{route}</p>}
                  </div>
                  <div className="pr-load-partial-figures">
                    <p className="pr-load-context">
                      {f.extraMiles} · {f.share ?? `${f.pay} pay`}
                    </p>
                    <p className="pr-load-partial-adds">
                      <span className="pr-load-context">adds </span>
                      {/* Too small for a result colour to pass; the sign
                          carries it. */}
                      <span className="pr-load-value">{f.adds}</span>
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {full ? (
        <p className="text-sm text-muted">
          Two partials is the most a load can carry.
        </p>
      ) : (
        canAdd && (
          <ButtonLink
            href={`/loads/new?partial_of=${loadId}`}
            variant="dark"
            size="sm"
          >
            + Add Partial
          </ButtonLink>
        )
      )}
    </Card>
  );
}
