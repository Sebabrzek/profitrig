"use client";

import { useState, useTransition } from "react";
import { submitFeedbackAction } from "../actions";

const MAX_LEN = 5000;

export function FeedbackCard() {
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<null | "ok" | string>(null);

  function send() {
    setResult(null);
    startTransition(async () => {
      const r = await submitFeedbackAction(message);
      if (r.ok) {
        setMessage("");
        setResult("ok");
        setTimeout(() => setResult(null), 4000);
      } else {
        setResult(r.error);
      }
    });
  }

  const trimmed = message.trim();
  const canSend = trimmed.length > 0 && trimmed.length <= MAX_LEN && !pending;

  return (
    <section className="bg-white border border-border rounded-2xl p-5">
      <h2 className="text-lg font-bold mb-1">Send Feedback</h2>
      <p className="text-sm text-muted mb-3 leading-snug">
        Hit a bug? Have an idea? Want a feature that would save you time on the
        road? Type away — every message gets read.
      </p>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value.slice(0, MAX_LEN))}
        rows={5}
        placeholder="What's on your mind?"
        className="w-full p-4 rounded-xl border border-border bg-white text-base focus:outline-none focus:ring-2 focus:ring-brand resize-y"
      />
      <div className="mt-3 flex items-center gap-3">
        <div className="flex-1 text-xs text-muted">
          {result === "ok" ? (
            <span className="text-brand-dark font-semibold">
              ✓ Thanks! We read every message.
            </span>
          ) : result && result !== "ok" ? (
            <span className="text-red-600">Error: {result}</span>
          ) : (
            <span>
              {message.length} / {MAX_LEN}
            </span>
          )}
        </div>
        <button
          onClick={send}
          disabled={!canSend}
          className="h-12 px-6 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold disabled:opacity-50 transition"
        >
          {pending ? "Sending..." : "Send"}
        </button>
      </div>
    </section>
  );
}
