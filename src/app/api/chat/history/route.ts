import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  CHAT_HISTORY_HOURS,
  CHAT_HISTORY_MESSAGES,
  orderStoredMessages,
} from "@/lib/aiGuard";

export const runtime = "nodejs";

/**
 * What the chat shows again when a driver reopens it: their own recent
 * messages, read with their own session, so one driver can never be handed
 * another's conversation. Nothing is kept in the browser between visits.
 */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ messages: [] }, { status: 401 });

  const since = new Date(
    Date.now() - CHAT_HISTORY_HOURS * 60 * 60 * 1000
  ).toISOString();
  const { data, error } = await supabase
    .from("support_chats")
    .select("id,role,content,created_at")
    .eq("user_id", user.id)
    .eq("trusted", true)
    .gte("created_at", since)
    // Newest first to take the last few; the id keeps rows saved in the
    // same millisecond from coming back in a different order each time.
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(CHAT_HISTORY_MESSAGES);

  if (error) {
    console.error("ask-profitrig: could not read history", error);
    return NextResponse.json({ messages: [] });
  }

  const messages = orderStoredMessages(data ?? [])
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({ role: m.role, content: m.content }));

  return NextResponse.json(
    { messages },
    { headers: { "Cache-Control": "no-store" } }
  );
}
