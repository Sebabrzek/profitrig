"use client";

import { useState, useTransition } from "react";
import { saveDriverProfileAction } from "../actions";
import type { DriverProfile } from "@/lib/profile";

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

const AUTHORITY_OPTIONS = [
  { value: "leased", label: "Leased to a carrier" },
  { value: "own_mc", label: "I run on my own MC authority" },
  { value: "both", label: "Both (own MC + leased trucks)" },
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
}: {
  initial: DriverProfile;
  email: string;
}) {
  const [p, setP] = useState<DriverProfile>(initial);
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState<null | "ok" | string>(null);

  type StringKey = {
    [K in keyof DriverProfile]: DriverProfile[K] extends string ? K : never;
  }[keyof DriverProfile];
  const setStr =
    (k: StringKey) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setP((s) => ({ ...s, [k]: e.target.value }));

  function save() {
    setSaved(null);
    startTransition(async () => {
      const r = await saveDriverProfileAction(p);
      if (r.ok) {
        setSaved("ok");
        setTimeout(() => setSaved(null), 2500);
      } else {
        setSaved(r.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="bg-white border border-border rounded-2xl p-5">
        <h2 className="text-lg font-bold mb-4">Contact</h2>
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
      </section>

      <section className="bg-white border border-border rounded-2xl p-5">
        <h2 className="text-lg font-bold mb-4">Your Operation</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Company Name" hint="Your LLC or business name.">
            <input
              className={inputClass}
              value={p.company_name}
              autoComplete="organization"
              onChange={setStr("company_name")}
            />
          </Field>
          <Field label="Carrier You're Leased To" hint="Leave blank if own MC.">
            <input
              className={inputClass}
              value={p.carrier_name}
              onChange={setStr("carrier_name")}
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
          <Field label="Authority">
            <select
              className={inputClass}
              value={p.authority_type}
              onChange={setStr("authority_type")}
            >
              <option value="">Select…</option>
              {AUTHORITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
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
      </section>

      <section className="bg-white border border-border rounded-2xl p-5">
        <h2 className="text-lg font-bold mb-3">Stay in touch</h2>
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
            <span className="font-semibold">Send me HelloTrucker emails</span>
            <br />
            <span className="text-muted">
              Tips, rate updates, and occasional offers. Unsubscribe anytime.
            </span>
          </span>
        </label>
      </section>

      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-border px-4 py-3 z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
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
