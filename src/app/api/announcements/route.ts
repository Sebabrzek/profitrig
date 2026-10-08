import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The banner a signed-in driver should see now: the newest one showing that
 * they haven't closed. Row-level security limits drivers to banners that are
 * showing, and to their own dismissals.
 */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ announcement: null }, { status: 401 });
  const [{ data: showing, error }, { data: closed }] = await Promise.all([
    supabase.from("announcements").select("id,title,body,starts_at").order("starts_at", { ascending: false }).limit(5),
    supabase.from("announcement_dismissals").select("announcement_id").eq("user_id", user.id),
  ]);
  if (error) return NextResponse.json({ announcement: null });
  const closedIds = new Set((closed ?? []).map((d) => String(d.announcement_id)));
  const next = (showing ?? []).find((a) => !closedIds.has(String(a.id))) ?? null;
  return NextResponse.json(
    { announcement: next ? { id: String(next.id), title: String(next.title), body: String(next.body) } : null },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

/** Close a banner, for this driver, on every device. */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  if (!UUID.test(id)) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  await supabase
    .from("announcement_dismissals")
    .upsert({ user_id: user.id, announcement_id: id }, { onConflict: "user_id,announcement_id", ignoreDuplicates: true });
  return NextResponse.json({ ok: true });
}
