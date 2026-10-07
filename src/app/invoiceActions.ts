"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fetchSubscription, isPro } from "@/lib/subscription";
import {
  canInvoice,
  checkInvoice,
  checkInvoiceSettings,
  fromBlock,
  invoiceSettingsFromRow,
  nextInvoiceNumber,
  remitBlock,
  type InvoiceInput,
} from "@/lib/invoices";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

/**
 * Who may invoice: a signed-in Pro driver who isn't leased (a leased driver
 * is paid by their carrier). Every action below starts here.
 */
async function invoicingDriver() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, error: "Not signed in." } as const;
  if (!isPro(await fetchSubscription(supabase, user.id))) {
    return { supabase, user: null, error: "Invoicing comes with ProfitRig Pro." } as const;
  }
  const { data: profile } = await supabase
    .from("driver_profiles")
    .select("authority_type")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!canInvoice(profile?.authority_type as string | undefined)) {
    return {
      supabase,
      user: null,
      error: "Your Profile says you're leased — your carrier invoices the broker.",
    } as const;
  }
  return { supabase, user, error: null } as const;
}

/** The business details invoices are issued with. */
export async function saveInvoiceSettingsAction(raw: Record<string, unknown>): Promise<Result> {
  const { supabase, user, error } = await invoicingDriver();
  if (!user) return { ok: false, error };
  const checked = checkInvoiceSettings(raw ?? {});
  if (!checked.ok) return { ok: false, error: checked.error };
  const s = checked.settings;
  const { error: saveError } = await supabase.from("invoice_settings").upsert(
    {
      user_id: user.id,
      ...s,
      // Blank stays blank in the database, not an empty string.
      mc_number: s.mc_number || null,
      state: s.state || null,
      factor_name: s.factor_name || null,
      factor_address: s.factor_address || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (saveError) {
    return {
      ok: false,
      error: /invoice_settings/.test(saveError.message)
        ? "Invoicing isn't switched on yet."
        : "Couldn't save. Try again.",
    };
  }
  revalidatePath("/profile");
  return { ok: true };
}

const rowFor = (inv: InvoiceInput) => ({
  bill_to_name: inv.bill_to_name,
  bill_to_email: inv.bill_to_email || null,
  bill_to_address: inv.bill_to_address || null,
  broker_load_number: inv.broker_load_number || null,
  invoice_date: inv.invoice_date,
  net_days: inv.net_days,
  pickup_date: inv.pickup_date || null,
  origin: inv.origin || null,
  destination: inv.destination || null,
  linehaul: inv.linehaul,
  fuel_surcharge: inv.fuel_surcharge,
  accessorials: inv.accessorials,
  notes: inv.notes || null,
});

/**
 * A new invoice for one of the driver's loads, numbered after the last, with
 * today's business details stamped on it. The load itself is not touched.
 */
export async function createInvoiceAction(
  loadId: string,
  raw: Record<string, unknown>
): Promise<Result<{ id: string }>> {
  const { supabase, user, error } = await invoicingDriver();
  if (!user) return { ok: false, error };
  const checked = checkInvoice(raw ?? {});
  if (!checked.ok) return { ok: false, error: checked.error };

  const [{ data: load }, { data: settingsRow }, { data: highest }] = await Promise.all([
    supabase.from("loads").select("id").eq("id", loadId).eq("user_id", user.id).maybeSingle(),
    supabase.from("invoice_settings").select("*").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("invoices")
      .select("number")
      .eq("user_id", user.id)
      .order("number", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (!load) return { ok: false, error: "That load no longer exists." };
  const settings = invoiceSettingsFromRow(settingsRow);
  if (!settings) return { ok: false, error: "Add your invoice details on Profile first." };

  const from = fromBlock(settings);
  let number = nextInvoiceNumber(settings.next_number, highest ? Number(highest.number) : null);
  // Two invoices made at the same moment can't share a number: try the next.
  for (let attempt = 0; attempt < 3; attempt++, number++) {
    const { data, error: insertError } = await supabase
      .from("invoices")
      .insert({
        user_id: user.id,
        load_id: loadId,
        number,
        ...rowFor(checked.invoice),
        from_company: from.company,
        from_mc: from.mc || null,
        from_address: from.address || null,
        from_phone: from.phone || null,
        from_email: from.email || null,
        remit_to: remitBlock(settings),
      })
      .select("id")
      .single();
    if (data) {
      revalidatePath("/loads/invoices");
      revalidatePath(`/loads/${loadId}`);
      return { ok: true, id: String(data.id) };
    }
    if (insertError?.code !== "23505") {
      console.error("invoice: could not create", insertError);
      return { ok: false, error: "Couldn't create the invoice. Try again." };
    }
  }
  return { ok: false, error: "Couldn't number the invoice. Try again." };
}

/** Change an unpaid invoice. Its number and business details stay as issued. */
export async function updateInvoiceAction(id: string, raw: Record<string, unknown>): Promise<Result> {
  const { supabase, user, error } = await invoicingDriver();
  if (!user) return { ok: false, error };
  const checked = checkInvoice(raw ?? {});
  if (!checked.ok) return { ok: false, error: checked.error };
  const { data, error: updateError } = await supabase
    .from("invoices")
    .update({ ...rowFor(checked.invoice), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("status", "open")
    .select("id,load_id")
    .maybeSingle();
  if (updateError || !data) return { ok: false, error: "Only an unpaid invoice can be changed." };
  revalidatePath("/loads/invoices");
  revalidatePath(`/loads/invoices/${id}`);
  if (data.load_id) revalidatePath(`/loads/${data.load_id}`);
  return { ok: true };
}

/**
 * Paid (on a date), back to unpaid, or cancelled. A cancelled invoice keeps
 * its number, so numbers are never reused.
 */
export async function setInvoiceStatusAction(
  id: string,
  status: "open" | "paid" | "void",
  paidOn?: string
): Promise<Result> {
  const { supabase, user, error } = await invoicingDriver();
  if (!user) return { ok: false, error };
  if (!["open", "paid", "void"].includes(status)) return { ok: false, error: "Unknown status." };
  const paidAt = status === "paid" ? paidOn : null;
  if (status === "paid" && !(typeof paidAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(paidAt))) {
    return { ok: false, error: "Pick the day it was paid." };
  }
  const { data, error: updateError } = await supabase
    .from("invoices")
    .update({ status, paid_at: paidAt, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id,load_id")
    .maybeSingle();
  if (updateError || !data) return { ok: false, error: "Couldn't update the invoice. Try again." };
  revalidatePath("/loads/invoices");
  revalidatePath(`/loads/invoices/${id}`);
  if (data.load_id) revalidatePath(`/loads/${data.load_id}`);
  return { ok: true };
}

/** Take a BOL or other paperwork off an invoice. The driver's own only. */
export async function removeInvoiceDocumentAction(docId: string): Promise<Result> {
  const { supabase, user, error } = await invoicingDriver();
  if (!user) return { ok: false, error };
  const { data: doc } = await supabase
    .from("invoice_documents")
    .select("id,invoice_id,storage_path")
    .eq("id", docId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!doc) return { ok: false, error: "That file is already gone." };
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "This isn't available right now. Try again shortly." };
  await admin.storage.from("scans").remove([String(doc.storage_path)]);
  await admin.from("invoice_documents").delete().eq("id", docId).eq("user_id", user.id);
  revalidatePath(`/loads/invoices/${doc.invoice_id}`);
  return { ok: true };
}
