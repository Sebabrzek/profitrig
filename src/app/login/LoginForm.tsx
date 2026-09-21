"use client";

import { useActionState, useState } from "react";
import { signInAction, signUpAction, type AuthState } from "../actions";
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
export function LoginForm() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const action = mode === "signin" ? signInAction : signUpAction;
  const [state, formAction, pending] = useActionState(action, initialState);

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

        {state.error && <Notice tone="error">{state.error}</Notice>}

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
