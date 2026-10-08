"use client";

import { useActionState, useState, useTransition } from "react";
import { resendConfirmationAction, signInAction, signUpAction, type AuthState } from "../actions";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Card } from "@/components/ui/Surfaces";

const initialState: AuthState = {};

/**
 * Sign in and sign up, on the shared field, button and selection systems.
 * Choosing between the two is a neutral choice, so the segmented control is
 * Rig Green; the one thing that submits is Profit Green. What the form
 * sends, and the two server actions behind it, are unchanged.
 */
export function LoginForm({ expiredLink = false }: { expiredLink?: boolean }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const action = mode === "signin" ? signInAction : signUpAction;
  const [state, formAction, pending] = useActionState(action, initialState);

  // Signed up: the account waits for the link we just emailed.
  if (state.checkEmail) {
    return (
      <Card>
        <h1 className="font-display text-xl font-bold leading-snug text-[var(--pr-rig-green)]">
          Check your email
        </h1>
        <p className="mt-2 text-sm leading-snug">
          We sent a link to <span className="font-semibold">{state.checkEmail}</span>. Click it to
          finish signing up, and you&apos;re in.
        </p>
        <p className="mt-3 text-sm text-muted leading-snug">
          Nothing after a minute? Look in spam or promotions, or send it again.
        </p>
        <ResendLink email={state.checkEmail} />
        <button
          type="button"
          className="pr-link mt-4 text-sm"
          onClick={() => window.location.reload()}
        >
          Wrong email? Start over
        </button>
      </Card>
    );
  }

  return (
    <Card>
      <h1 className="font-display text-xl font-bold leading-snug text-[var(--pr-rig-green)]">
        {mode === "signin" ? "Sign in" : "Create your account"}
      </h1>
      <p className="text-sm text-muted mt-1 mb-5 leading-snug">
        Your numbers stay private to you.
      </p>

      <SegmentedControl
        label="Sign in or sign up"
        block
        value={mode}
        onChange={setMode}
        options={[
          { value: "signin", label: "Sign In" },
          { value: "signup", label: "Sign Up" },
        ]}
      />

      {expiredLink && !state.error && (
        <Notice className="mt-5">
          That link has expired or was already used. Sign in — if your account isn&apos;t
          confirmed yet, you can get a new link.
        </Notice>
      )}

      <form action={formAction} className="flex flex-col gap-4 mt-5">
        <Field label="Email">
          <TextInput
            name="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
          />
        </Field>
        <Field label="Password">
          <TextInput
            name="password"
            type="password"
            required
            autoComplete={
              mode === "signin" ? "current-password" : "new-password"
            }
            minLength={6}
            placeholder="At least 6 characters"
          />
        </Field>

        {state.error && (
          <Notice tone="error">
            {state.error}
            {state.unconfirmed && <ResendLink email={state.unconfirmed} />}
          </Notice>
        )}

        <Button type="submit" variant="primary" block pending={pending}>
          {pending
            ? "Please wait..."
            : mode === "signin"
            ? "Sign In"
            : "Create Account"}
        </Button>

        {mode === "signup" && (
          <p className="text-xs text-muted text-center leading-snug">
            By signing up you create a free ProfitRig account. Your numbers
            stay private to you.
          </p>
        )}
      </form>
    </Card>
  );
}

/** Send the confirmation link again — the same answer whether or not the email has an account. */
function ResendLink({ email }: { email: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  return (
    <span className="mt-3 block text-sm">
      {result ? (
        <span role="status">{result}</span>
      ) : (
        <button
          type="button"
          className="pr-link font-semibold"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await resendConfirmationAction(email);
              setResult(r.ok ? `A new link is on its way to ${email}.` : r.error);
            })
          }
        >
          {pending ? "Sending…" : "Send the link again"}
        </button>
      )}
    </span>
  );
}
