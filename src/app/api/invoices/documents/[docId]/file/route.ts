import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A file attached to an invoice: its owner gets a link that works for one minute. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ docId: string }> }
) {
  const { docId } = await params;
  if (!UUID.test(docId)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  // Row-level security: only the driver's own paperwork comes back.
  const { data: doc } = await supabase
    .from("invoice_documents")
    .select("storage_path")
    .eq("id", docId)
    .eq("user_id", user.id)
    .maybeSingle();
  const admin = createSupabaseAdminClient();
  if (!doc || !admin) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const { data: signed } = await admin.storage.from("scans").createSignedUrl(String(doc.storage_path), 60);
  if (!signed?.signedUrl) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.redirect(signed.signedUrl, { status: 302 });
}
