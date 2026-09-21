"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { submitFeedbackAction } from "@/app/actions";
import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/Field";
import {
  ASK_PROFITRIG_EVENT,
  ChatIcon,
} from "@/components/shell/AskProfitRigButton";
import {
  CHAT_MAX_MESSAGE_CHARS,
  CHAT_REMAINING_NOTICE_AT,
} from "@/lib/aiGuard";

type ChatMessage = { role: "user" | "assistant"; content: string };

/** Chats used to be kept in this browser. They live with the account now. */
const RETIRED_STORAGE_KEY = "profitrig.chat.v1";

function isChatMessage(m: unknown): m is ChatMessage {
  const row = m as ChatMessage | null;
  return (
    !!row &&
    (row.role === "user" || row.role === "assistant") &&
    typeof row.content === "string"
  );
}

/** "2 questions remaining today." — only when a driver is nearly out. */
function remainingNotice(header: string | null): string | null {
  const left = Number(header);
  if (!Number.isFinite(left) || left > CHAT_REMAINING_NOTICE_AT) return null;
  if (left <= 0) return "No questions remaining today.";
  return `${left} question${left === 1 ? "" : "s"} remaining today.`;
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
  const [notice, setNotice] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const answerRef = useRef<AbortController | null>(null);

  // Nothing is kept in this browser any more; clear what older versions left.
  useEffect(() => {
    try {
      sessionStorage.removeItem(RETIRED_STORAGE_KEY);
    } catch {
      // private mode — nothing to clear
    }
  }, []);

  // The conversation comes back from the driver's own account, once, when
  // they open the chat.
  useEffect(() => {
    if (!open || historyLoaded) return;
    let dropped = false;
    (async () => {
      try {
        const res = await fetch("/api/chat/history", { cache: "no-store" });
        const data = res.ok ? await res.json() : null;
        const rows = Array.isArray(data?.messages)
          ? data.messages.filter(isChatMessage)
          : [];
        if (!dropped && rows.length > 0) {
          setMessages((current) => (current.length === 0 ? rows : current));
        }
      } catch {
        // an empty chat is fine; the answer still works
      } finally {
        if (!dropped) setHistoryLoaded(true);
      }
    })();
    return () => {
      dropped = true;
    };
  }, [open, historyLoaded]);

  // Closing the chat drops the answer. It also asks the server to stop
  // generating, though the host may let that request finish.
  useEffect(() => {
    if (!open) answerRef.current?.abort();
  }, [open]);
  useEffect(() => () => answerRef.current?.abort(), []);

  // The top-bar button (phones and tablets) opens the same panel.
  useEffect(() => {
    const openChat = () => setOpen(true);
    window.addEventListener(ASK_PROFITRIG_EVENT, openChat);
    return () => window.removeEventListener(ASK_PROFITRIG_EVENT, openChat);
  }, []);

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
    if (!text || busy || [...text].length > CHAT_MAX_MESSAGE_CHARS) return;
    setInput("");
    setBusy(true);
    setNotice(null);

    const outgoing: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages([...outgoing, { role: "assistant", content: "" }]);

    const controller = new AbortController();
    answerRef.current = controller;
    try {
      // Only the question travels. What was said before is read back on the
      // server from this driver's own records.
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
        signal: controller.signal,
      });
      setNotice(remainingNotice(res.headers.get("X-Ask-Remaining-Day")));

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

      // Belt-and-suspenders: if anything but the answer stream comes back
      // (e.g. a redirect to an HTML page after a session expires), don't
      // render it as an answer.
      if (!res.headers.get("content-type")?.startsWith("text/plain")) {
        setMessages([
          ...outgoing,
          {
            role: "assistant",
            content:
              "Looks like you got signed out. Refresh the page and sign back in, then ask me again.",
          },
        ]);
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
    } catch (err) {
      // An abort is the driver closing the chat, not a failure.
      if ((err as Error)?.name !== "AbortError") {
        setMessages([
          ...outgoing,
          {
            role: "assistant",
            content:
              "Couldn't reach the server. Check your connection and try again.",
          },
        ]);
      }
    } finally {
      answerRef.current = null;
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
      {/* Floating launcher — desktop only (1024px up). Where the bottom nav
          shows, Ask ProfitRig is docked in the top bar instead, so it can
          never sit on top of a page's numbers or buttons. Rig Green: help
          is a neutral action, so it never competes with a page's Profit
          Green save. */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Ask ProfitRig"
          className="pr-chat-launcher fixed right-4 z-40 hidden min-h-11 items-center gap-2 lg:flex rounded-full bg-[var(--pr-rig-green)] hover:bg-[var(--pr-action-dark-hover)] text-white pl-3 pr-4 py-3 shadow-lg shadow-black/20 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pr-rig-green)]"
        >
          <ChatIcon />
          <span className="font-display text-sm font-bold">Ask ProfitRig</span>
        </button>
      )}

      {open && (
        <div className="fixed inset-x-0 bottom-0 lg:inset-x-auto lg:right-6 lg:bottom-6 z-50 lg:w-[380px]">
          <div className="flex flex-col bg-white md:rounded-2xl rounded-t-2xl border border-border shadow-2xl shadow-black/25 overflow-hidden h-[75dvh] md:h-[560px]">
            {/* Header */}
            <div className="flex items-center justify-between bg-[var(--pr-rig-green)] text-white px-4 py-2">
              <div className="flex items-center gap-2">
                <ChatIcon />
                <div>
                  <div className="font-display text-sm font-bold leading-tight">
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
                className="-mr-2 flex h-11 w-11 items-center justify-center rounded-[var(--pr-radius-button)] hover:bg-white/15 transition focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-white"
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
              {/* Said once, at the top, where a driver starts reading. */}
              <p className="px-1 text-[11px] leading-snug text-muted">
                Your Ask ProfitRig messages are saved to your account and
                processed by our AI provider, Anthropic, to answer you.
                ProfitRig may review them to help you and improve the app.
                Please don&apos;t share passwords or bank details here.
              </p>
              {messages.map((m, i) => (
                <Bubble key={i} role={m.role}>
                  {m.content ||
                    (busy && i === messages.length - 1 ? "…" : m.content)}
                </Bubble>
              ))}
              {notice && (
                <p
                  role="status"
                  className="pt-1 text-center text-[11px] font-semibold text-[var(--pr-rig-green)]"
                >
                  {notice}
                </p>
              )}
              <p className="text-[11px] text-muted text-center pt-1">
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
                      className="pr-link ml-2 font-normal"
                    >
                      Back to chat
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="text-xs font-semibold text-foreground">
                      Message a human (goes straight to the founder)
                    </div>
                    <TextArea
                      value={humanText}
                      onChange={(e) => setHumanText(e.target.value)}
                      rows={3}
                      aria-label="Message to a human"
                      placeholder="What do you need help with?"
                    />
                    {humanStatus === "error" && (
                      <div role="alert" className="text-xs text-[var(--pr-loss-deep)]">
                        Couldn&apos;t send — try again.
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button
                        variant="dark"
                        size="sm"
                        className="flex-1"
                        onClick={sendToHuman}
                        pending={humanStatus === "sending"}
                        disabled={!humanText.trim()}
                      >
                        {humanStatus === "sending" ? "Sending…" : "Send"}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setHumanMode(false)}
                      >
                        Cancel
                      </Button>
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
                  <TextArea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    rows={1}
                    maxLength={CHAT_MAX_MESSAGE_CHARS}
                    aria-label="Your question"
                    placeholder="Type a question…"
                    className="flex-1 resize-none"
                  />
                  <Button
                    type="submit"
                    variant="dark"
                    size="sm"
                    className="w-11 shrink-0 px-0"
                    pending={busy}
                    disabled={!input.trim()}
                    aria-label="Send"
                  >
                    <SendIcon />
                  </Button>
                </form>
                <div className="flex items-center justify-between gap-3 px-3 pb-2.5 pt-1.5">
                  <button
                    type="button"
                    onClick={() => setHumanMode(true)}
                    className="pr-link text-xs"
                  >
                    Talk to a human
                  </button>
                  {/* Only near the limit, so it stays out of the way. */}
                  {[...input].length > CHAT_MAX_MESSAGE_CHARS - 200 && (
                    <span className="text-[11px] text-muted tabular-nums">
                      {CHAT_MAX_MESSAGE_CHARS - [...input].length} left
                    </span>
                  )}
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
            ? "bg-[var(--pr-rig-green)] text-white rounded-br-sm"
            : "bg-white border border-border text-foreground rounded-bl-sm"
        }`}
      >
        {children}
      </div>
    </div>
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
