"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuthState = { error?: string };

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
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/");
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
  const { error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/");
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
  monthly_miles: number;
  mpg: number;
  fuel_price_per_gallon: number;
  maintenance_per_mile: number;
  tires_per_mile: number;
  def_per_mile: number;
  driver_pay_per_mile: number;
  tolls_misc_per_mile: number;
  desired_profit_per_mile: number;
};

function computeTotals(p: CostProfile) {
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
    p.driver_pay_per_mile +
    p.tolls_misc_per_mile;
  const fixedPerMile = p.monthly_miles > 0 ? fixed / p.monthly_miles : 0;
  const totalCpm = fixedPerMile + variablePerMile;
  return { totalCpm, requiredRate: totalCpm + p.desired_profit_per_mile };
}

export async function saveProfileAction(
  profile: CostProfile,
  label: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Not signed in." };
  }

  const now = new Date().toISOString();

  const { error: profileErr } = await supabase.from("cost_profiles").upsert(
    {
      user_id: user.id,
      ...profile,
      updated_at: now,
    },
    { onConflict: "user_id" }
  );
  if (profileErr) return { ok: false, error: profileErr.message };

  const { totalCpm, requiredRate } = computeTotals(profile);

  const { error: snapErr } = await supabase
    .from("cost_profile_snapshots")
    .insert({
      user_id: user.id,
      label: label && label.length > 0 ? label : null,
      ...profile,
      total_cpm: totalCpm,
      required_rate: requiredRate,
    });
  if (snapErr) return { ok: false, error: snapErr.message };

  revalidatePath("/history");
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

  revalidatePath("/history");
  return { ok: true };
}
