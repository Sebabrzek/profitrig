"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { friendlyAuthError, isUnconfirmed } from "@/lib/authFlow";

export type AuthState = {
  error?: string;
  /** Signed up; the account waits for the link sent to this address. */
  checkEmail?: string;
  /** Tried to sign in before confirming: offer to send the link again. */
  unconfirmed?: string;
};

export async function signInAction(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password required." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return isUnconfirmed(error)
      ? { error: friendlyAuthError(error), unconfirmed: email }
      : { error: friendlyAuthError(error) };
  }

  revalidatePath("/", "layout");
  redirect("/calculator");
}

export async function signUpAction(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password required." };
  }
  if (password.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    // Where the confirmation link lands: it signs them in, then the Calculator.
    options: { emailRedirectTo: `${await siteOrigin()}/auth/confirm` },
  });

  if (error) {
    return { error: friendlyAuthError(error) };
  }
  // With "Confirm email" on there is no session yet: the account waits for
  // the link. Say so — never send them on as if they were signed in.
  if (!data.session) {
    return { checkEmail: email };
  }

  revalidatePath("/", "layout");
  redirect("/calculator");
}

/**
 * Send the confirmation link again. The answer is the same whether or not
 * the address has an account waiting, so it can't be used to find out who
 * has one.
 */
export async function resendConfirmationAction(
  rawEmail: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = typeof rawEmail === "string" ? rawEmail.trim() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return { ok: false, error: "That email address doesn't look right." };
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${await siteOrigin()}/auth/confirm` },
  });
  if (error && (error.status === 429 || /rate limit/i.test(error.message))) {
    return { ok: false, error: "A link was just sent. Wait a minute before asking for another." };
  }
  return { ok: true };
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export type CostProfile = {
  truck_payment: number;
  trailer_payment: number;
  insurance: number;
  eld_subscriptions: number;
  permits_irp_ifta: number;
  office_misc: number;
  load_board_per_month: number;
  other_monthly_bill: number;
  other_label: string;
  monthly_miles: number;
  mpg: number;
  fuel_price_per_gallon: number;
  maintenance_per_mile: number;
  tires_per_mile: number;
  def_per_mile: number;
  driver_pay_per_mile: number;
  tolls_misc_per_mile: number;
  desired_profit_per_mile: number;
  /**
   * Phase 0.2: when set, the Calculator displays this as the user's "true"
   * cost per mile (a management-lens override derived from their logged
   * loads). NULL = use the computed totalCPM from the line items.
   */
  real_cpm_override: number | null;
};

function computeTotals(p: CostProfile) {
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
  const totalCpm = fixedPerMile + variablePerMile;
  return { totalCpm, requiredRate: totalCpm + p.desired_profit_per_mile };
}

export async function saveProfileAction(
  profile: CostProfile
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase.from("cost_profiles").upsert(
    {
      user_id: user.id,
      ...profile,
      other_label: profile.other_label.trim() || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

import { fetchDriverSettings } from "@/lib/driverSettings";

export async function saveSnapshotAction(
  profile: CostProfile,
  label: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = label.trim();
  if (!trimmed) {
    return {
      ok: false,
      error: "Give the snapshot a name (e.g. \"Carrier XYZ\" or \"Aug 2026\").",
    };
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const now = new Date().toISOString();

  const { error: profileErr } = await supabase.from("cost_profiles").upsert(
    {
      user_id: user.id,
      ...profile,
      other_label: profile.other_label.trim() || null,
      updated_at: now,
    },
    { onConflict: "user_id" }
  );
  if (profileErr) return { ok: false, error: profileErr.message };

  const { totalCpm, requiredRate } = computeTotals(profile);

  // Stamp who they were driving for, so the history on Profile doubles as a
  // record of carriers and splits over time. 0% marks an independent.
  const settings = await fetchDriverSettings(supabase, user.id);
  const carrierName = settings.carrierName.trim();
  const carrierStamp =
    settings.carrierPct != null
      ? { carrier_name: carrierName || null, carrier_pct: settings.carrierPct }
      : settings.authorityType === "own_mc"
        ? { carrier_pct: 0 }
        : carrierName
          ? { carrier_name: carrierName }
          : {};

  // cost_profile_snapshots does not have a real_cpm_override column — the
  // override is a "live" management number on the current profile only, not
  // a snapshotable concept. Strip it out so the INSERT does not fail with
  // PGRST204 "could not find column".
  const { real_cpm_override: _omitOverride, ...snapshotPayload } = profile;
  void _omitOverride;

  const { error: snapErr } = await supabase
    .from("cost_profile_snapshots")
    .insert({
      user_id: user.id,
      label: trimmed,
      ...snapshotPayload,
      other_label: snapshotPayload.other_label.trim() || null,
      total_cpm: totalCpm,
      required_rate: requiredRate,
      ...carrierStamp,
    });
  if (snapErr) return { ok: false, error: snapErr.message };

  revalidatePath("/profile");
  return { ok: true };
}

export async function loadSnapshotAction(
  snapshotId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: snap, error } = await supabase
    .from("cost_profile_snapshots")
    .select("*")
    .eq("id", snapshotId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!snap) return { ok: false, error: "Snapshot not found." };

  const { error: upErr } = await supabase.from("cost_profiles").upsert(
    {
      user_id: user.id,
      truck_payment: snap.truck_payment,
      trailer_payment: snap.trailer_payment,
      insurance: snap.insurance,
      eld_subscriptions: snap.eld_subscriptions,
      permits_irp_ifta: snap.permits_irp_ifta,
      office_misc: snap.office_misc,
      load_board_per_month: snap.load_board_per_month ?? 0,
      other_monthly_bill: snap.other_monthly_bill ?? 0,
      other_label: snap.other_label ?? null,
      monthly_miles: snap.monthly_miles,
      mpg: snap.mpg,
      fuel_price_per_gallon: snap.fuel_price_per_gallon,
      maintenance_per_mile: snap.maintenance_per_mile,
      tires_per_mile: snap.tires_per_mile,
      def_per_mile: snap.def_per_mile,
      driver_pay_per_mile: snap.driver_pay_per_mile,
      tolls_misc_per_mile: snap.tolls_misc_per_mile,
      desired_profit_per_mile: snap.desired_profit_per_mile,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (upErr) return { ok: false, error: upErr.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

import type { DriverProfile } from "@/lib/profile";

export async function saveDriverProfileAction(
  profile: DriverProfile
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase.from("driver_profiles").upsert(
    {
      user_id: user.id,
      first_name: profile.first_name.trim() || null,
      last_name: profile.last_name.trim() || null,
      phone: profile.phone.trim() || null,
      company_name: profile.company_name.trim() || null,
      domicile_city: profile.domicile_city.trim() || null,
      domicile_state: profile.domicile_state.trim() || null,
      carrier_name: profile.carrier_name.trim() || null,
      authority_type: profile.authority_type.trim() || null,
      trailer_type: profile.trailer_type.trim() || null,
      marketing_opt_in: profile.marketing_opt_in,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * The % a leased driver's carrier keeps, used as the default on new loads.
 * null turns it off: an independent driver keeps 100%. Saved apart from the
 * main profile so saving a phone number never depends on this column.
 */
export async function saveCarrierPctAction(
  pct: number | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (pct != null && (!Number.isFinite(pct) || pct <= 0 || pct >= 100)) {
    return { ok: false, error: "Carrier % must be between 1 and 99." };
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase.from("driver_profiles").upsert(
    {
      user_id: user.id,
      carrier_pct: pct == null ? null : Math.round(pct * 100) / 100,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) {
    return {
      ok: false,
      error: "Couldn't save your carrier %. Try again, or tap Talk to a human.",
    };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Settles every load logged before the driver told us their split. A
 * driver who has always been leased applies their %; one who used to run
 * independent passes 0, so those loads stay 100% theirs and they're never
 * asked again.
 */
export async function applyCarrierPctToPastLoadsAction(
  pct: number
): Promise<{ ok: true; updated: number } | { ok: false; error: string }> {
  if (!Number.isFinite(pct) || pct < 0 || pct >= 100) {
    return { ok: false, error: "Carrier % must be under 100." };
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data, error } = await supabase
    .from("loads")
    .update({
      carrier_pct: Math.round(pct * 100) / 100,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id)
    .is("carrier_pct", null)
    .select("id");
  if (error) {
    return {
      ok: false,
      error: "Couldn't update those loads. Try again, or tap Talk to a human.",
    };
  }
  revalidatePath("/", "layout");
  return { ok: true, updated: data?.length ?? 0 };
}

export async function saveWeekStartAction(
  weekStart: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (weekStart !== "monday" && weekStart !== "sunday") {
    return { ok: false, error: "Pick Monday or Sunday." };
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  // Only this column is sent, so an existing profile keeps everything else.
  const { error } = await supabase.from("driver_profiles").upsert(
    {
      user_id: user.id,
      week_start: weekStart,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) {
    return {
      ok: false,
      error: "Couldn't save that. Try again, or tap Talk to a human.",
    };
  }

  revalidatePath("/loads");
  return { ok: true };
}

export async function submitFeedbackAction(
  message: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = message.trim();
  if (!trimmed) return { ok: false, error: "Type a message before sending." };
  if (trimmed.length > 5000) {
    return { ok: false, error: "Message is too long (5000 character max)." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("feedback")
    .insert({ user_id: user.id, message: trimmed });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function setRealCpmOverrideAction(
  value: number | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  if (value != null && (!Number.isFinite(value) || value < 0)) {
    return { ok: false, error: "Invalid value." };
  }

  const { error } = await supabase
    .from("cost_profiles")
    .update({
      real_cpm_override: value,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteSnapshotAction(
  snapshotId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("cost_profile_snapshots")
    .delete()
    .eq("id", snapshotId)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/profile");
  return { ok: true };
}

import type { Load } from "@/lib/loads";
import { MAX_PARTIALS, asPartial } from "@/lib/partials";
import { keepDismissals } from "@/lib/checks";
import { isRoadCategory } from "@/lib/roadExpenses";

function nullableNum(v: number | null): number | null {
  if (v == null) return null;
  return Number.isFinite(v) ? v : null;
}

export async function saveLoadAction(
  input: Load,
  /** The scan a new load was filled in from (lib/scan). */
  scanId?: string
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  // Whether this is a partial is decided here, not by the browser: an edit
  // keeps whatever primary the saved row already has, so a crafted request
  // cannot quietly turn a partial back into a full-mileage load.
  let parentId: string | null = input.parent_load_id || null;
  let existing: Record<string, unknown> | null = null;
  if (input.id) {
    const { data } = await supabase
      .from("loads")
      .select("*")
      .eq("id", input.id)
      .eq("user_id", user.id)
      .maybeSingle();
    existing = data;
    if (existing && typeof existing.parent_load_id === "string") {
      parentId = existing.parent_load_id;
    }
  }

  // Checked before a partial's miles are folded into one figure, so a
  // negative entry is refused rather than quietly clamped to zero.
  if (input.loaded_miles < 0 || input.deadhead_miles < 0) {
    return { ok: false, error: "Miles can't be negative." };
  }

  let load = input;
  if (parentId) {
    const { data: primary } = await supabase
      .from("loads")
      .select("*")
      .eq("id", parentId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!primary) return { ok: false, error: "That load no longer exists." };
    if (primary.parent_load_id) {
      return { ok: false, error: "A partial can't be added to another partial." };
    }
    if (!input.id) {
      const { count } = await supabase
        .from("loads")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("parent_load_id", parentId);
      if ((count ?? 0) >= MAX_PARTIALS) {
        return { ok: false, error: `A load can carry at most ${MAX_PARTIALS} partials.` };
      }
    }
    load = asPartial(input, { id: parentId, load_date: String(primary.load_date) });
  }

  if (!load.load_date) return { ok: false, error: "Pick a date." };
  if (load.loaded_miles < 0 || load.deadhead_miles < 0) {
    return { ok: false, error: "Miles can't be negative." };
  }
  if (
    load.carrier_pct != null &&
    (!Number.isFinite(load.carrier_pct) ||
      load.carrier_pct < 0 ||
      load.carrier_pct >= 100)
  ) {
    return { ok: false, error: "Carrier % must be between 0 and 99." };
  }

  const row = {
    user_id: user.id,
    load_date: load.load_date,
    broker: load.broker.trim() || null,
    origin: load.origin.trim() || null,
    destination: load.destination.trim() || null,
    loaded_miles: load.loaded_miles,
    deadhead_miles: load.deadhead_miles,
    linehaul_pay: load.linehaul_pay,
    fuel_surcharge: load.fuel_surcharge,
    accessorials: load.accessorials,
    fuel_actual: nullableNum(load.fuel_actual),
    tolls_actual: nullableNum(load.tolls_actual),
    lumpers_actual: nullableNum(load.lumpers_actual),
    // Sent only when there is a split, so an independent driver's save never
    // touches the column — and keeps working before migration 013 runs.
    ...(load.carrier_pct != null
      ? { carrier_pct: Math.round(load.carrier_pct * 100) / 100 }
      : {}),
    notes: load.notes.trim() || null,
    // Sent only for a partial, so an ordinary save never names the column
    // and keeps working before migration 017 runs.
    ...(parentId ? { parent_load_id: parentId } : {}),
    // The alerts the driver has marked "this is right". The form sends only
    // marks that still match an alert; this caps their size. Sent only once
    // migration 018 has added the column, which an edit can see.
    ...(existing && "dismissed_checks" in existing
      ? { dismissed_checks: keepDismissals(load.dismissed_checks, null) }
      : {}),
    updated_at: new Date().toISOString(),
  };

  if (load.id) {
    const { error } = await supabase
      .from("loads")
      .update(row)
      .eq("id", load.id)
      .eq("user_id", user.id);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/loads");
    if (parentId) revalidatePath(`/loads/${parentId}`);
    return { ok: true, id: load.id };
  }

  // A brand-new load can carry marks made while it was being entered. Try
  // with them; if migration 018 has not added the column yet, save the load
  // without them rather than lose it.
  const marks = keepDismissals(load.dismissed_checks, null);
  const insert = (r: typeof row & { dismissed_checks?: string[] }) =>
    supabase.from("loads").insert(r).select("id").single();
  let { data, error } = await insert(marks.length ? { ...row, dismissed_checks: marks } : row);
  if (error && marks.length && /dismissed_checks/.test(error.message)) {
    ({ data, error } = await insert(row));
  }
  if (error || !data) return { ok: false, error: error?.message ?? "Couldn't save the load." };
  // The original document stays with the load it became. Only the driver's
  // own scan, and only one not already used; drivers cannot write scans, so
  // the server does. A failure here never loses the load.
  if (scanId && !parentId && /^[0-9a-f-]{36}$/i.test(scanId)) {
    const admin = createSupabaseAdminClient();
    const { error: linkError } = admin
      ? await admin
          .from("scans")
          .update({ load_id: data.id })
          .eq("id", scanId)
          .eq("user_id", user.id)
          .is("load_id", null)
      : { error: new Error("no service role key") };
    if (linkError) console.error("save load: could not link scan", linkError);
  }
  revalidatePath("/loads");
  if (parentId) revalidatePath(`/loads/${parentId}`);
  return { ok: true, id: data.id };
}

/**
 * Mark one alert on a load "this is right" — or take the mark back. The mark
 * is the alert's exact wording (lib/checks), so if the load's figures later
 * change, the alert returns on its own.
 */
export async function setLoadCheckAction(
  loadId: string,
  wording: string,
  confirmed: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  if (typeof wording !== "string" || !wording || wording.length > 300) {
    return { ok: false, error: "That alert couldn't be saved." };
  }

  const { data: row } = await supabase
    .from("loads")
    .select("*")
    .eq("id", loadId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!row) return { ok: false, error: "That load no longer exists." };
  if (!("dismissed_checks" in row)) {
    return { ok: false, error: "Marking alerts isn't switched on yet. The alert stays for now." };
  }

  const current = Array.isArray(row.dismissed_checks) ? row.dismissed_checks : [];
  const next = confirmed
    ? keepDismissals([...current, wording], null)
    : keepDismissals(current.filter((d: unknown) => d !== wording), null);

  const { error } = await supabase
    .from("loads")
    .update({ dismissed_checks: next })
    .eq("id", loadId)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/loads");
  revalidatePath(`/loads/${loadId}`);
  return { ok: true };
}

export async function deleteLoadAction(
  loadId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("loads")
    .delete()
    .eq("id", loadId)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/loads");
  return { ok: true };
}

export async function addRoadExpenseAction(input: {
  spent_on: string;
  category: string;
  amount: number;
  note: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.spent_on)) {
    return { ok: false, error: "Pick a date." };
  }
  if (!isRoadCategory(input.category)) {
    return { ok: false, error: "Pick a category." };
  }
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "Enter an amount." };
  }
  if (amount > 1_000_000) {
    return { ok: false, error: "That amount looks too large." };
  }

  const { error } = await supabase.from("road_expenses").insert({
    user_id: user.id,
    spent_on: input.spent_on,
    category: input.category,
    amount,
    note: input.note.trim().slice(0, 300) || null,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/loads");
  revalidatePath("/tax");
  return { ok: true };
}

export async function deleteRoadExpenseAction(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("road_expenses")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/loads");
  revalidatePath("/tax");
  return { ok: true };
}

import { headers } from "next/headers";
import {
  getStripe,
  STRIPE_PRICE_MONTHLY,
  STRIPE_PRICE_PRO_PLUS,
  STRIPE_PRICE_YEARLY,
} from "@/lib/stripe/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fetchSubscription, isPro } from "@/lib/subscription";

async function siteOrigin(): Promise<string> {
  const h = await headers();
  const host =
    h.get("x-forwarded-host") ?? h.get("host") ?? "www.profitrig.com";
  const proto =
    h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

import type { Rig } from "@/lib/fuel";

/** The driver's truck and the odometer they started tracking fuel from. */
export async function saveRigAction(
  rig: Rig
): Promise<{ ok: true } | { ok: false; error: string }> {
  const latestModelYear = new Date().getFullYear() + 1;
  if (
    rig.year != null &&
    (!Number.isInteger(rig.year) || rig.year < 1950 || rig.year > latestModelYear)
  ) {
    return { ok: false, error: `Year must be between 1950 and ${latestModelYear}.` };
  }
  if (
    rig.transmission !== "" &&
    rig.transmission !== "automatic" &&
    rig.transmission !== "manual"
  ) {
    return { ok: false, error: "Pick automatic or manual." };
  }
  if (
    rig.starting_odometer != null &&
    (!Number.isFinite(rig.starting_odometer) ||
      rig.starting_odometer < 0 ||
      rig.starting_odometer > 10_000_000)
  ) {
    return { ok: false, error: "That starting odometer doesn't look right." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const text = (v: string) => v.trim().slice(0, 60) || null;
  const { error } = await supabase.from("rigs").upsert(
    {
      user_id: user.id,
      make: text(rig.make),
      model: text(rig.model),
      year: rig.year,
      engine: text(rig.engine),
      transmission: rig.transmission || null,
      starting_odometer:
        rig.starting_odometer == null
          ? null
          : Math.round(rig.starting_odometer * 10) / 10,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) {
    return {
      ok: false,
      error: "Couldn't save your truck. Try again, or tap Talk to a human.",
    };
  }
  revalidatePath("/fuel");
  return { ok: true };
}

/** One week on the Fuel tab: the odometer now and gallons bought since the last reading. */
export async function addFuelLogAction(input: {
  logged_on: string;
  odometer: number;
  gallons: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.logged_on)) {
    return { ok: false, error: "Pick a date." };
  }
  const odometer = Number(input.odometer);
  const gallons = Number(input.gallons);
  if (!Number.isFinite(odometer) || odometer <= 0 || odometer > 10_000_000) {
    return { ok: false, error: "Enter the odometer reading." };
  }
  if (!Number.isFinite(gallons) || gallons <= 0) {
    return { ok: false, error: "Enter the gallons you filled up." };
  }
  if (gallons > 5000) {
    return {
      ok: false,
      error: "That's more fuel than a week of driving — double-check the gallons.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase.from("fuel_logs").insert({
    user_id: user.id,
    logged_on: input.logged_on,
    odometer: Math.round(odometer * 10) / 10,
    gallons: Math.round(gallons * 100) / 100,
  });
  if (error) {
    return {
      ok: false,
      error: "Couldn't save that week. Try again, or tap Talk to a human.",
    };
  }
  revalidatePath("/fuel");
  return { ok: true };
}

export async function deleteFuelLogAction(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase
    .from("fuel_logs")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) {
    return { ok: false, error: "Couldn't delete that week. Try again." };
  }
  revalidatePath("/fuel");
  return { ok: true };
}

export async function createCheckoutAction(input: {
  plan: "monthly" | "yearly" | "pro_plus";
  promoCode?: string | null;
}): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const stripe = getStripe();
  if (!stripe) return { ok: false, error: "Stripe is not configured yet." };

  const priceId =
    input.plan === "pro_plus"
      ? STRIPE_PRICE_PRO_PLUS
      : input.plan === "yearly"
        ? STRIPE_PRICE_YEARLY
        : STRIPE_PRICE_MONTHLY;
  if (!priceId) {
    return {
      ok: false,
      error: `Missing STRIPE_PRICE_${input.plan.toUpperCase()} env var.`,
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  // A second checkout would start a second subscription, billed alongside
  // the first. Someone already on a plan changes it instead.
  const existing = await fetchSubscription(supabase, user.id);
  if (isPro(existing)) {
    return {
      ok: false,
      error: "You already have a plan. Change it from Manage subscription.",
    };
  }

  // Resolve a discount (if a promo code was entered) or fall back to letting
  // Stripe's own checkout UI take a code.
  const discounts: { promotion_code: string }[] = [];
  if (input.promoCode && input.promoCode.trim()) {
    try {
      const list = await stripe.promotionCodes.list({
        code: input.promoCode.trim(),
        active: true,
        limit: 1,
      });
      const promo = list.data[0];
      if (!promo) {
        return { ok: false, error: "That code isn't valid." };
      }
      discounts.push({ promotion_code: promo.id });
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : "Could not check that code.",
      };
    }
  }

  // Find or create Stripe customer for this user.
  const admin = createSupabaseAdminClient();
  let stripeCustomerId: string | undefined;
  if (admin) {
    stripeCustomerId = existing?.stripe_customer_id ?? undefined;
  }
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { user_id: user.id },
    });
    stripeCustomerId = customer.id;
    if (admin) {
      await admin.from("subscriptions").upsert(
        {
          user_id: user.id,
          stripe_customer_id: stripeCustomerId,
          status: "inactive",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
    }
  }

  const origin = await siteOrigin();
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: stripeCustomerId,
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: 7,
      metadata: { user_id: user.id, plan: input.plan },
    },
    discounts: discounts.length > 0 ? discounts : undefined,
    allow_promotion_codes: discounts.length === 0 ? true : undefined,
    // A card is taken to start the 7-day trial (Stripe's default for
    // subscriptions), and charged only when the trial ends. It used to be
    // if_required, which a free trial never is — so trials had no card.
    payment_method_collection: "always",
    client_reference_id: user.id,
    success_url: `${origin}/loads?upgraded=1`,
    cancel_url: `${origin}/upgrade?canceled=1`,
    metadata: { user_id: user.id, plan: input.plan },
  });

  if (!session.url) {
    return { ok: false, error: "Stripe returned no checkout URL." };
  }
  return { ok: true, url: session.url };
}

/**
 * Pro → Pro Plus for someone already paying. Opens Stripe's own page, which
 * shows exactly what changes and what it costs today, and switches only when
 * the driver confirms there. Nothing is charged from here.
 */
export async function switchToProPlusAction(): Promise<
  { ok: true; url: string } | { ok: false; error: string }
> {
  const stripe = getStripe();
  if (!stripe) return { ok: false, error: "Stripe is not configured yet." };
  if (!STRIPE_PRICE_PRO_PLUS) {
    return { ok: false, error: "Pro Plus isn't available yet." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const sub = await fetchSubscription(supabase, user.id);
  if (!isPro(sub) || !sub?.stripe_customer_id || !sub.stripe_subscription_id) {
    return { ok: false, error: "There's no active plan to switch." };
  }
  if (sub.plan === "pro_plus") {
    return { ok: false, error: "You're already on Pro Plus." };
  }

  const origin = await siteOrigin();
  try {
    const live = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
    const item = live.items.data[0];
    if (!item || live.items.data.length !== 1) {
      return {
        ok: false,
        error: "This plan can't be switched here. Tap Talk to a human and we'll do it for you.",
      };
    }
    const portal = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${origin}/upgrade`,
      flow_data: {
        type: "subscription_update_confirm",
        subscription_update_confirm: {
          subscription: live.id,
          items: [{ id: item.id, price: STRIPE_PRICE_PRO_PLUS, quantity: 1 }],
        },
        after_completion: {
          type: "redirect",
          redirect: { return_url: `${origin}/upgrade?switched=1` },
        },
      },
    });
    return { ok: true, url: portal.url };
  } catch (err) {
    console.error("switch to pro plus failed", err);
    return {
      ok: false,
      error: "Couldn't open the switch. Try Manage subscription, or tap Talk to a human.",
    };
  }
}

export async function createPortalAction(): Promise<
  { ok: true; url: string } | { ok: false; error: string }
> {
  const stripe = getStripe();
  if (!stripe) return { ok: false, error: "Stripe is not configured yet." };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const sub = await fetchSubscription(supabase, user.id);
  if (!sub?.stripe_customer_id) {
    return { ok: false, error: "No Stripe customer record yet." };
  }

  const origin = await siteOrigin();
  const portal = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${origin}/upgrade`,
  });
  return { ok: true, url: portal.url };
}
