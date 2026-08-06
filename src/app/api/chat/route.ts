import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchSubscription, isPro } from "@/lib/subscription";
import {
  CHAT_DAILY_MESSAGE_LIMIT,
  CHAT_MAX_HISTORY_MESSAGES,
  CHAT_MAX_MESSAGE_CHARS,
  CHAT_MAX_TOKENS,
  CHAT_MODEL,
  CHAT_SYSTEM_PROMPT,
} from "@/lib/supportChat";

export const runtime = "nodejs";

type IncomingMessage = { role: "user" | "assistant"; content: string };

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Chat isn't set up yet on this server. Use Profile → Send feedback instead.",
      },
      { status: 503 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: { messages?: IncomingMessage[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const raw = Array.isArray(body.messages) ? body.messages : [];
  const history = raw
    .filter(
      (m): m is IncomingMessage =>
        !!m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0
    )
    .slice(-CHAT_MAX_HISTORY_MESSAGES)
    .map((m) => ({
      role: m.role,
      content: m.content.slice(0, CHAT_MAX_MESSAGE_CHARS),
    }));

  const latest = history[history.length - 1];
  if (!latest || latest.role !== "user") {
    return NextResponse.json({ error: "Nothing to answer." }, { status: 400 });
  }

  // Rate limit: count of user messages sent since midnight UTC.
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const { count } = await supabase
    .from("support_chats")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("role", "user")
    .gte("created_at", startOfDay.toISOString());
  if ((count ?? 0) >= CHAT_DAILY_MESSAGE_LIMIT) {
    return NextResponse.json(
      {
        error:
          "You've hit today's chat limit. It resets tomorrow — for anything urgent, use Talk to a human below.",
      },
      { status: 429 }
    );
  }

  // Light per-user context in a second system block so the big block above it
  // stays byte-identical (prompt-cache prefix).
  const sub = await fetchSubscription(supabase, user.id);
  const userContext = `About this driver: plan = ${
    isPro(sub) ? "Pro (paid)" : "Free (calculator only — Loads and Tax are locked)"
  }.`;

  // Persist the user's message before calling the model.
  await supabase.from("support_chats").insert({
    user_id: user.id,
    role: "user",
    content: latest.content,
  });

  const anthropic = new Anthropic({ apiKey });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let assistantText = "";
      try {
        const messageStream = anthropic.messages.stream({
          model: CHAT_MODEL,
          max_tokens: CHAT_MAX_TOKENS,
          system: [
            {
              type: "text",
              text: CHAT_SYSTEM_PROMPT,
              cache_control: { type: "ephemeral" },
            },
            { type: "text", text: userContext },
          ],
          messages: history,
        });

        for await (const event of messageStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            assistantText += event.delta.text;
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        await messageStream.finalMessage();
      } catch (err) {
        console.error("support chat error", err);
        const fallback =
          "\n\nSorry — I hit a snag answering that. Try again in a minute, or tap Talk to a human.";
        assistantText += fallback;
        controller.enqueue(encoder.encode(fallback));
      }

      if (assistantText.trim()) {
        await supabase.from("support_chats").insert({
          user_id: user.id,
          role: "assistant",
          content: assistantText,
        });
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
