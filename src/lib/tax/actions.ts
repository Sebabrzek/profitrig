"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchSubscription, isPro } from "@/lib/subscription";
import type {
  CapitalAsset,
  Expense,
  PerDiemSummary,
  TaxProfile,
} from "./types";

type Result<T = void> =
  | (T extends void
      ? { ok: true }
      : { ok: true; data: T })
  | { ok: false; error: string };

async function requireProUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, error: "Not signed in." };
  const sub = await fetchSubscription(supabase, user.id);
  if (!isPro(sub))
    return { supabase, user: null, error: "Tax Pack requires ProfitRig Pro." };
  return { supabase, user, error: null };
}

export async function saveTaxProfileAction(
  profile: TaxProfile
): Promise<Result> {
  const { supabase, user, error } = await requireProUser();
  if (!user) return { ok: false, error: error ?? "Not signed in." };
  const { error: dbErr } = await supabase.from("tax_profiles").upsert(
    {
      user_id: user.id,
      entity_type: profile.entity_type,
      has_hired_driver: profile.has_hired_driver,
      truck_financing: profile.truck_financing,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (dbErr) return { ok: false, error: dbErr.message };
  revalidatePath("/tax", "layout");
  return { ok: true };
}

function normalizeText(v: string): string | null {
  const t = v.trim();
  return t.length > 0 ? t : null;
}

export async function upsertExpenseAction(
  e: Expense
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { supabase, user, error } = await requireProUser();
  if (!user) return { ok: false, error: error ?? "Not signed in." };

  if (!e.expense_date) return { ok: false, error: "Pick a date." };
  if (!Number.isFinite(e.amount) || e.amount < 0)
    return { ok: false, error: "Amount must be 0 or more." };

  const row = {
    user_id: user.id,
    expense_date: e.expense_date,
    category: e.category,
    amount: e.amount,
    vendor: normalizeText(e.vendor),
    note: normalizeText(e.note),
    updated_at: new Date().toISOString(),
  };

  if (e.id) {
    const { error: dbErr } = await supabase
      .from("expenses")
      .update(row)
      .eq("id", e.id)
      .eq("user_id", user.id);
    if (dbErr) return { ok: false, error: dbErr.message };
    revalidatePath("/tax", "layout");
    return { ok: true, id: e.id };
  }
  const { data, error: dbErr } = await supabase
    .from("expenses")
    .insert(row)
    .select("id")
    .single();
  if (dbErr) return { ok: false, error: dbErr.message };
  revalidatePath("/tax", "layout");
  return { ok: true, id: data.id };
}

export async function deleteExpenseAction(id: string): Promise<Result> {
  const { supabase, user, error } = await requireProUser();
  if (!user) return { ok: false, error: error ?? "Not signed in." };
  const { error: dbErr } = await supabase
    .from("expenses")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (dbErr) return { ok: false, error: dbErr.message };
  revalidatePath("/tax", "layout");
  return { ok: true };
}

export async function upsertCapitalAssetAction(
  a: CapitalAsset
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { supabase, user, error } = await requireProUser();
  if (!user) return { ok: false, error: error ?? "Not signed in." };

  if (!a.description.trim()) return { ok: false, error: "Description required." };
  if (!a.placed_in_service)
    return { ok: false, error: "Pick a placed-in-service date." };
  if (!Number.isFinite(a.cost) || a.cost < 0)
    return { ok: false, error: "Cost must be 0 or more." };

  const row = {
    user_id: user.id,
    description: a.description.trim(),
    placed_in_service: a.placed_in_service,
    cost: a.cost,
    updated_at: new Date().toISOString(),
  };

  if (a.id) {
    const { error: dbErr } = await supabase
      .from("capital_assets")
      .update(row)
      .eq("id", a.id)
      .eq("user_id", user.id);
    if (dbErr) return { ok: false, error: dbErr.message };
    revalidatePath("/tax", "layout");
    return { ok: true, id: a.id };
  }
  const { data, error: dbErr } = await supabase
    .from("capital_assets")
    .insert(row)
    .select("id")
    .single();
  if (dbErr) return { ok: false, error: dbErr.message };
  revalidatePath("/tax", "layout");
  return { ok: true, id: data.id };
}

export async function deleteCapitalAssetAction(id: string): Promise<Result> {
  const { supabase, user, error } = await requireProUser();
  if (!user) return { ok: false, error: error ?? "Not signed in." };
  const { error: dbErr } = await supabase
    .from("capital_assets")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (dbErr) return { ok: false, error: dbErr.message };
  revalidatePath("/tax", "layout");
  return { ok: true };
}

export async function savePerDiemSummaryAction(
  s: PerDiemSummary
): Promise<Result> {
  const { supabase, user, error } = await requireProUser();
  if (!user) return { ok: false, error: error ?? "Not signed in." };
  if (!Number.isFinite(s.period_a_nights) || s.period_a_nights < 0)
    return { ok: false, error: "Period A nights must be 0 or more." };
  if (!Number.isFinite(s.period_b_nights) || s.period_b_nights < 0)
    return { ok: false, error: "Period B nights must be 0 or more." };

  const { error: dbErr } = await supabase.from("per_diem_summary").upsert(
    {
      user_id: user.id,
      tax_year: s.tax_year,
      period_a_nights: s.period_a_nights,
      period_b_nights: s.period_b_nights,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,tax_year" }
  );
  if (dbErr) return { ok: false, error: dbErr.message };
  revalidatePath("/tax", "layout");
  return { ok: true };
}
