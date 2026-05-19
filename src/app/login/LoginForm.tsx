"use client";

import { useActionState, useState } from "react";
import { signInAction, signUpAction, type AuthState } from "../actions";

const initialState: AuthState = {};

export function LoginForm() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const action = mode === "signin" ? signInAction : signUpAction;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <div className="bg-white border border-border rounded-2xl shadow-sm p-6">
      <div className="flex gap-2 mb-6 bg-gray-100 rounded-full p-1">
        <button
          type="button"
          onClick={() => setMode("signin")}
          className={`flex-1 py-2 rounded-full text-sm font-semibold transition ${
            mode === "signin"
              ? "bg-white shadow text-foreground"
              : "text-muted"
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={`flex-1 py-2 rounded-full text-sm font-semibold transition ${
            mode === "signup"
              ? "bg-white shadow text-foreground"
              : "text-muted"
          }`}
        >
          Sign Up
        </button>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">Email</label>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            className="w-full h-12 px-4 rounded-xl border border-border text-base focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Password</label>
          <input
            name="password"
            type="password"
            required
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            minLength={6}
            placeholder="At least 6 characters"
            className="w-full h-12 px-4 rounded-xl border border-border text-base focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </div>

        {state.error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
            {state.error}
          </div>
        )}

        <button
          type="submit"
          disabled={pending}
          className="h-12 rounded-xl bg-brand hover:bg-brand-dark text-white font-bold text-base transition disabled:opacity-60"
        >
          {pending
            ? "Please wait..."
            : mode === "signin"
            ? "Sign In"
            : "Create Account"}
        </button>

        {mode === "signup" && (
          <p className="text-xs text-muted text-center">
            By signing up you create a free ProfitRig account. Your numbers
            stay private to you.
          </p>
        )}
      </form>
    </div>
  );
}
