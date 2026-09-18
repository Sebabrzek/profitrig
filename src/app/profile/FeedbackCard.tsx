"use client";

import { useState, useTransition } from "react";
import { Card, CardHeader } from "@/components/ui/Surfaces";
import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/Field";
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
    <Card>
      <CardHeader
        title="Send Feedback"
        description="Hit a bug? Have an idea? Want a feature that would save you time on the road? Type away — every message gets read."
      />
      <TextArea
        value={message}
        onChange={(e) => setMessage(e.target.value.slice(0, MAX_LEN))}
        rows={5}
        aria-label="Your feedback"
        placeholder="What's on your mind?"
      />
      <div className="mt-3 flex items-center gap-3">
        <div className="flex-1 text-xs text-muted">
          {result === "ok" ? (
            <span className="text-brand-dark font-semibold">
              ✓ Thanks! We read every message.
            </span>
          ) : result && result !== "ok" ? (
            <span role="alert" className="text-[var(--pr-loss-deep)]">
              Error: {result}
            </span>
          ) : (
            <span>
              {message.length} / {MAX_LEN}
            </span>
          )}
        </div>
        <Button
          variant="primary"
          onClick={send}
          pending={pending}
          disabled={!canSend}
        >
          {pending ? "Sending…" : "Send"}
        </Button>
      </div>
    </Card>
  );
}
