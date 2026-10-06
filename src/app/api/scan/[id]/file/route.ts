import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/admin";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The original of a scanned document. The bucket is private and has no
 * storage policies, so this is the only way in: the driver who scanned it
 * (or the admin) gets a link that works for one minute.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Not available." }, { status: 503 });

  const { data: scan } = await admin
    .from("scans")
    .select("user_id,storage_path")
    .eq("id", id)
    .maybeSingle();
  if (!scan || (scan.user_id !== user.id && !isAdminEmail(user.email))) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const { data: signed, error } = await admin.storage
    .from("scans")
    .createSignedUrl(String(scan.storage_path), 60);
  if (error || !signed?.signedUrl) {
    return NextResponse.json({ error: "That file couldn't be opened." }, { status: 404 });
  }
  return NextResponse.redirect(signed.signedUrl, { status: 302 });
}
