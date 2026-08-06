"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { submitFeedbackAction } from "@/app/actions";

type ChatMessage = { role: "user" | "assistant"; content: string };

const STORAGE_KEY = "profitrig.chat.v1";

function loadStoredMessages(): ChatMessage[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m): m is ChatMessage =>
        !!m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string"
    );
  } catch {
    return [];
  }
}

export function SupportChat() {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [humanMode, setHumanMode] = useState(false);
  const [humanText, setHumanText] = useState("");
  const [humanStatus, setHumanStatus] = useState<
    "idle" | "sending" | "sent" | "error"
  >("idle");
  const scrollRef = useRef<HTMLDivElement>(null);
  const hydratedRef = useRef(false);

  useEffect(() => {
    setMessages(loadStoredMessages());
    hydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-40)));
    } catch {
      // storage full / private mode — chat still works, just not persisted
    }
  }, [messages]);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [open, messages]);

  // Hide on login/auth pages (widget is only mounted for signed-in users,
  // but the pathname check keeps it away from auth flows just in case).
  if (pathname.startsWith("/login") || pathname.startsWith("/auth")) {
    return null;
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setBusy(true);

    const outgoing: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages([...outgoing, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: outgoing }),
      });

      if (!res.ok) {
        let msg = "Something went wrong. Try again in a minute.";
        try {
          const data = await res.json();
          if (typeof data?.error === "string") msg = data.error;
        } catch {
          // non-JSON error body — keep default message
        }
        setMessages([...outgoing, { role: "assistant", content: msg }]);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setMessages([
          ...outgoing,
          { role: "assistant", content: "No response — try again." },
        ]);
        return;
      }

      const decoder = new TextDecoder();
      let assistant = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistant += decoder.decode(value, { stream: true });
        setMessages([...outgoing, { role: "assistant", content: assistant }]);
      }
    } catch {
      setMessages([
        ...outgoing,
        {
          role: "assistant",
          content:
            "Couldn't reach the server. Check your connection and try again.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function sendToHuman() {
    const note = humanText.trim();
    if (!note || humanStatus === "sending") return;
    setHumanStatus("sending");
    const recent = messages
      .slice(-6)
      .map((m) => `${m.role === "user" ? "Driver" : "ProfitRig"}: ${m.content}`)
      .join("\n");
    const payload = `[Support chat — talk to a human]\n\n${note}${
      recent ? `\n\n--- Recent chat ---\n${recent}` : ""
    }`;
    const result = await submitFeedbackAction(payload.slice(0, 5000));
    if (result.ok) {
      setHumanStatus("sent");
      setHumanText("");
    } else {
      setHumanStatus("error");
    }
  }

  return (
    <>
      {/* Floating launcher — sits above the mobile bottom nav */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Ask ProfitRig"
          className="fixed right-4 bottom-24 md:bottom-6 z-40 flex items-center gap-2 rounded-full bg-brand hover:bg-brand-dark text-white pl-3 pr-4 py-3 shadow-lg shadow-black/20 transition"
        >
          <ChatIcon />
          <span className="text-sm font-bold">Ask ProfitRig</span>
        </button>
      )}

      {open && (
        <div className="fixed inset-x-0 bottom-0 md:inset-x-auto md:right-6 md:bottom-6 z-50 md:w-[380px]">
          <div className="flex flex-col bg-white md:rounded-2xl rounded-t-2xl border border-border shadow-2xl shadow-black/25 overflow-hidden h-[75dvh] md:h-[560px]">
            {/* Header */}
            <div className="flex items-center justify-between bg-brand text-white px-4 py-3">
              <div className="flex items-center gap-2">
                <ChatIcon />
                <div>
                  <div className="text-sm font-bold leading-tight">
                    Ask ProfitRig
                  </div>
                  <div className="text-[11px] text-white/80 leading-tight">
                    Answers about the app &amp; where things go
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close chat"
                className="p-1.5 rounded-lg hover:bg-white/15 transition"
              >
                <CloseIcon />
              </button>
            </div>

            {/* Messages */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 bg-gray-50"
            >
              <Bubble role="assistant">
                Hey! I can help you find your way around ProfitRig — where to
                put an expense, how the calculator works, what a number means.
                What&apos;s up?
              </Bubble>
              {messages.map((m, i) => (
                <Bubble key={i} role={m.role}>
                  {m.content ||
                    (busy && i === messages.length - 1 ? "…" : m.content)}
                </Bubble>
              ))}
              <p className="text-[10px] text-muted text-center pt-1">
                AI assistant — for tax questions, always confirm with your
                accountant.
              </p>
            </div>

            {/* Talk to a human */}
            {humanMode ? (
              <div className="border-t border-border px-3 py-3 space-y-2 bg-white">
                {humanStatus === "sent" ? (
                  <div className="text-sm text-brand-dark font-semibold">
                    Sent! Sebastian reads every message — you&apos;ll hear
                    back.
                    <button
                      type="button"
                      onClick={() => {
                        setHumanMode(false);
                        setHumanStatus("idle");
                      }}
                      className="ml-2 text-muted underline font-normal"
                    >
                      Back to chat
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="text-xs font-semibold text-foreground">
                      Message a human (goes straight to the founder)
                    </div>
                    <textarea
                      value={humanText}
                      onChange={(e) => setHumanText(e.target.value)}
                      rows={3}
                      placeholder="What do you need help with?"
                      className="w-full rounded-xl border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                    />
                    {humanStatus === "error" && (
                      <div className="text-xs text-red-600">
                        Couldn&apos;t send — try again.
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={sendToHuman}
                        disabled={humanStatus === "sending" || !humanText.trim()}
                        className="flex-1 rounded-xl bg-brand hover:bg-brand-dark disabled:opacity-50 text-white text-sm font-bold py-2 transition"
                      >
                        {humanStatus === "sending" ? "Sending…" : "Send"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setHumanMode(false)}
                        className="rounded-xl border border-border text-sm font-semibold px-3 py-2 text-muted hover:text-foreground transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="border-t border-border bg-white">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    send();
                  }}
                  className="flex items-end gap-2 px-3 pt-2.5"
                >
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    rows={1}
                    placeholder="Type a question…"
                    className="flex-1 resize-none rounded-xl border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  />
                  <button
                    type="submit"
                    disabled={busy || !input.trim()}
                    aria-label="Send"
                    className="rounded-xl bg-brand hover:bg-brand-dark disabled:opacity-50 text-white p-2.5 transition"
                  >
                    <SendIcon />
                  </button>
                </form>
                <div className="px-3 pb-2.5 pt-1.5">
                  <button
                    type="button"
                    onClick={() => setHumanMode(true)}
                    className="text-[11px] text-muted hover:text-foreground underline"
                  >
                    Talk to a human
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Bubble({
  role,
  children,
}: {
  role: "user" | "assistant";
  children: React.ReactNode;
}) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
          isUser
            ? "bg-brand text-white rounded-br-sm"
            : "bg-white border border-border text-foreground rounded-bl-sm"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function ChatIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a8 8 0 0 1-8 8H5l-2 2V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8z" />
      <circle cx="9" cy="12" r="0.8" fill="currentColor" />
      <circle cx="13" cy="12" r="0.8" fill="currentColor" />
      <circle cx="17" cy="12" r="0.8" fill="currentColor" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" fill="currentColor" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}
