"use client";

import { useState, useTransition } from "react";
import { Card, CardHeader } from "@/components/ui/Surfaces";
import { Notice } from "@/components/ui/Notice";
import { formatMoney } from "@/lib/format";
import {
  applyCarrierPctToPastLoadsAction,
  saveCarrierPctAction,
  saveDriverProfileAction,
} from "../actions";
import type { DriverProfile } from "@/lib/profile";

export type PastLoadsWithoutSplit = {
  /** Loads logged before the driver set a carrier % (carrier_pct is null). */
  count: number;
  from: string | null;
  to: string | null;
};

const pctLabel = (n: number) => `${Number(n.toFixed(2))}%`;

function shortDate(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const US_STATES: { value: string; label: string }[] = [
  { value: "AL", label: "Alabama" },
  { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" },
  { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" },
  { value: "DE", label: "Delaware" },
  { value: "DC", label: "District of Columbia" },
  { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" },
  { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" },
  { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" },
  { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" },
  { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" },
  { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" },
  { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" },
  { value: "WY", label: "Wyoming" },
];

const TRAILER_OPTIONS = [
  { value: "dry_van", label: "Dry Van" },
  { value: "reefer", label: "Reefer" },
  { value: "flatbed", label: "Flatbed" },
  { value: "step_deck", label: "Step Deck" },
  { value: "power_only", label: "Power Only" },
  { value: "tanker", label: "Tanker" },
  { value: "other", label: "Other" },
];

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-foreground">{label}</span>
      {hint && <span className="text-xs text-muted -mt-1">{hint}</span>}
      {children}
    </label>
  );
}

const inputClass =
  "w-full h-12 px-4 rounded-xl border border-border bg-white text-base focus:outline-none focus:ring-2 focus:ring-brand";

export function ProfileForm({
  initial,
  email,
  pastLoads,
}: {
  initial: DriverProfile;
  email: string;
  pastLoads: PastLoadsWithoutSplit;
}) {
  const [p, setP] = useState<DriverProfile>(initial);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState<null | "ok" | string>(null);

  // How you get paid. The switch starts on for anyone who already told us
  // they're leased, even before they've entered the carrier's %.
  const [leased, setLeased] = useState(
    initial.carrier_pct != null ||
      initial.authority_type === "leased" ||
      initial.authority_type === "both"
  );
  const [pctText, setPctText] = useState(
    initial.carrier_pct != null ? String(initial.carrier_pct) : ""
  );
  const [savedPct, setSavedPct] = useState<number | null>(initial.carrier_pct);
  const [pastCount, setPastCount] = useState(pastLoads.count);
  const [pastMessage, setPastMessage] = useState("");
  const [applyPending, startApply] = useTransition();

  const typedPct = pctText.trim() === "" ? null : Number(pctText);
  const pctIsValid =
    typedPct != null && Number.isFinite(typedPct) && typedPct > 0 && typedPct < 100;
  const pastRange =
    pastLoads.from && pastLoads.to
      ? pastLoads.from === pastLoads.to
        ? `on ${shortDate(pastLoads.from)}`
        : `between ${shortDate(pastLoads.from)} and ${shortDate(pastLoads.to)}`
      : "earlier";

  function toggleLeased(on: boolean) {
    setLeased(on);
    setP((s) => ({
      ...s,
      authority_type: on
        ? initial.authority_type === "both"
          ? "both"
          : "leased"
        : "own_mc",
    }));
  }

  function applyToPast(pct: number) {
    setPastMessage("");
    startApply(async () => {
      const r = await applyCarrierPctToPastLoadsAction(pct);
      if (!r.ok) {
        setPastMessage(r.error);
        return;
      }
      setPastCount(0);
      const loads = r.updated === 1 ? "1 load" : `${r.updated} loads`;
      setPastMessage(
        pct > 0
          ? `Done — ${loads} now count your ${pctLabel(100 - pct)} share.`
          : `Done — ${loads} stay 100% yours.`
      );
    });
  }

  type StringKey = {
    [K in keyof DriverProfile]: DriverProfile[K] extends string ? K : never;
  }[keyof DriverProfile];
  const setStr =
    (k: StringKey) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setP((s) => ({ ...s, [k]: e.target.value }));

  function save() {
    setSaved(null);
    if (leased && typedPct != null && !pctIsValid) {
      setSaved("Carrier % must be between 1 and 99.");
      return;
    }
    // Off, or on without a % yet: loads keep counting 100% until one is added.
    const nextPct = leased && pctIsValid ? typedPct : null;
    startTransition(async () => {
      const r = await saveDriverProfileAction(p);
      if (!r.ok) {
        setSaved(r.error);
        return;
      }
      if (nextPct !== savedPct) {
        const pr = await saveCarrierPctAction(nextPct);
        if (!pr.ok) {
          setSaved(pr.error);
          return;
        }
        setSavedPct(nextPct);
      }
      setSaved("ok");
      setTimeout(() => setSaved(null), 2500);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader title="Contact" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="First Name">
            <input
              className={inputClass}
              value={p.first_name}
              autoComplete="given-name"
              onChange={setStr("first_name")}
            />
          </Field>
          <Field label="Last Name">
            <input
              className={inputClass}
              value={p.last_name}
              autoComplete="family-name"
              onChange={setStr("last_name")}
            />
          </Field>
          <Field label="Phone" hint="Best number to reach you.">
            <input
              type="tel"
              inputMode="tel"
              className={inputClass}
              value={p.phone}
              placeholder="(555) 123-4567"
              autoComplete="tel"
              onChange={setStr("phone")}
            />
          </Field>
          <Field label="Email" hint="From your account. Not editable here.">
            <input className={inputClass} value={email} readOnly disabled />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="How you get paid"
          description="This decides the revenue on every load you log."
        />
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            role="switch"
            className="mt-1 h-5 w-5 rounded border-border accent-brand"
            checked={leased}
            onChange={(e) => toggleLeased(e.target.checked)}
          />
          <span className="text-sm">
            <span className="font-semibold">I&apos;m leased to a carrier</span>
            <br />
            <span className="text-muted">
              They keep a percentage of every load. Leave this off if you run
              your own authority and keep 100%.
            </span>
          </span>
        </label>

        {leased ? (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Carrier you're leased to">
              <input
                className={inputClass}
                value={p.carrier_name}
                onChange={setStr("carrier_name")}
              />
            </Field>
            <Field label="Carrier keeps" hint="Their cut of each load's total pay.">
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  className={`${inputClass} pr-10`}
                  value={pctText}
                  placeholder="20"
                  onChange={(e) =>
                    setPctText(e.target.value.replace(/[^0-9.]/g, ""))
                  }
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none">
                  %
                </span>
              </div>
            </Field>
            <p className="sm:col-span-2 text-sm leading-snug">
              {pctIsValid && typedPct != null ? (
                <>
                  You keep{" "}
                  <span className="font-bold">{pctLabel(100 - typedPct)}</span>
                  : a $2,000 load pays you{" "}
                  <span className="font-bold">
                    {formatMoney((2000 * (100 - typedPct)) / 100)}
                  </span>
                  . New loads use this, and you can change it on any single
                  load.
                </>
              ) : (
                <span className="text-muted">
                  Add the % your carrier keeps. Until then your loads count
                  100% of the pay as yours.
                </span>
              )}
            </p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">
            Independent: you keep 100% of every load you haul.
          </p>
        )}

        {savedPct != null && pastCount > 0 && (
          <Notice
            className="mt-4"
            title={
              <>
                {pastCount === 1 ? "1 load" : `${pastCount} loads`} you logged{" "}
                {pastRange} still {pastCount === 1 ? "counts" : "count"} 100%
                as yours.
              </>
            }
          >
            <p>
              Did your carrier keep {pctLabel(savedPct)} of{" "}
              {pastCount === 1 ? "that one" : "those"} too?
            </p>
            <div className="mt-2 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => applyToPast(savedPct)}
                disabled={applyPending}
                className="h-11 px-4 rounded-xl bg-brand hover:bg-brand-dark text-white font-semibold disabled:opacity-60 transition"
              >
                Yes — apply {pctLabel(savedPct)}
              </button>
              <button
                type="button"
                onClick={() => applyToPast(0)}
                disabled={applyPending}
                className="h-11 px-4 rounded-xl border border-border bg-white font-semibold hover:bg-gray-50 disabled:opacity-60 transition"
              >
                No — I kept 100% of those
              </button>
            </div>
          </Notice>
        )}
        {pastMessage && (
          <p className="mt-3 text-sm text-muted">{pastMessage}</p>
        )}
      </Card>

      <Card>
        <CardHeader title="Your Operation" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Company Name" hint="Your LLC or business name.">
            <input
              className={inputClass}
              value={p.company_name}
              autoComplete="organization"
              onChange={setStr("company_name")}
            />
          </Field>
          <Field label="Domicile City">
            <input
              className={inputClass}
              value={p.domicile_city}
              autoComplete="address-level2"
              onChange={setStr("domicile_city")}
            />
          </Field>
          <Field label="Domicile State">
            <select
              className={inputClass}
              value={p.domicile_state}
              onChange={setStr("domicile_state")}
            >
              <option value="">Select state…</option>
              {US_STATES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Trailer Type">
            <select
              className={inputClass}
              value={p.trailer_type}
              onChange={setStr("trailer_type")}
            >
              <option value="">Select…</option>
              {TRAILER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Stay in touch" />
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="mt-1 h-5 w-5 rounded border-border accent-brand"
            checked={p.marketing_opt_in}
            onChange={(e) =>
              setP((s) => ({ ...s, marketing_opt_in: e.target.checked }))
            }
          />
          <span className="text-sm">
            <span className="font-semibold">Send me ProfitRig emails</span>
            <br />
            <span className="text-muted">
              Tips, rate updates, and occasional offers. Unsubscribe anytime.
            </span>
          </span>
        </label>
      </Card>

      <div
        className="pr-action-bar bg-white border-t border-border px-4 pt-3 z-20"
      >
        <div className="pr-action-bar-inner flex items-center gap-3">
          <div className="flex-1 text-xs text-muted">
            {saved === "ok"
              ? "✓ Profile saved"
              : saved && saved !== "ok"
              ? `Error: ${saved}`
              : "Your profile is private. We never sell your info."}
          </div>
          <button
            onClick={save}
            disabled={pending}
            className="h-12 px-6 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold transition disabled:opacity-60"
          >
            {pending ? "Saving..." : "Save Profile"}
          </button>
        </div>
      </div>
    </div>
  );
}
