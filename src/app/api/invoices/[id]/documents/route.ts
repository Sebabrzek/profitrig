import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { SCAN_MAX_BYTES } from "@/lib/scan";
import { sniffType } from "@/lib/emailIn";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};
/** A BOL, a POD, a lumper receipt — a handful per invoice, not a filing cabinet. */
const MAX_DOCUMENTS = 5;

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

/**
 * Attach paperwork (a signed BOL or POD) to one of the driver's invoices.
 * Stored privately, never read by the AI — so it costs nothing.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!UUID.test(id)) return fail("That invoice doesn't exist.", 404);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Not signed in.", 401);

  const [{ data: invoice }, { count }] = await Promise.all([
    supabase.from("invoices").select("id").eq("id", id).eq("user_id", user.id).maybeSingle(),
    supabase
      .from("invoice_documents")
      .select("id", { count: "exact", head: true })
      .eq("invoice_id", id)
      .eq("user_id", user.id),
  ]);
  if (!invoice) return fail("That invoice doesn't exist.", 404);
  if ((count ?? 0) >= MAX_DOCUMENTS) return fail(`An invoice can carry ${MAX_DOCUMENTS} files.`, 400);

  let file: File | null = null;
  try {
    const f = (await request.formData()).get("file");
    file = f instanceof File ? f : null;
  } catch {
    return fail("That upload didn't come through. Try again.", 400);
  }
  if (!file || file.size === 0) return fail("Pick a photo or PDF first.", 400);
  if (file.size > SCAN_MAX_BYTES) return fail("That file is over 4 MB. Take a photo instead.", 413);
  const bytes = new Uint8Array(await file.arrayBuffer());
  // What it really is, from its first bytes — not what the browser says.
  const mime = sniffType(bytes);
  if (!mime) return fail("Attach a photo (JPG, PNG) or a PDF.", 415);

  const admin = createSupabaseAdminClient();
  if (!admin) return fail("This isn't available right now. Try again shortly.", 503);
  const docId = crypto.randomUUID();
  const storagePath = `${user.id}/invoices/${id}/${docId}.${EXTENSION[mime]}`;
  const { error: uploadError } = await admin.storage
    .from("scans")
    .upload(storagePath, Buffer.from(bytes), { contentType: mime, upsert: false });
  if (uploadError) {
    console.error("invoice paperwork: could not store", uploadError);
    return fail("Couldn't save that file. Try again.", 503);
  }
  const { error: rowError } = await admin.from("invoice_documents").insert({
    id: docId,
    invoice_id: id,
    user_id: user.id,
    kind: "bol",
    storage_path: storagePath,
    mime_type: mime,
    byte_size: bytes.length,
  });
  if (rowError) {
    await admin.storage.from("scans").remove([storagePath]);
    return fail("Couldn't save that file. Try again.", 503);
  }
  return NextResponse.json({ id: docId });
}
