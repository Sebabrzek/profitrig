import { LoginForm } from "./LoginForm";
import { Wordmark } from "@/components/Wordmark";

/**
 * Sign in / sign up.
 *
 * On a phone this is what it always was: the mark, then the form, on Off
 * White. From 1024px up the form keeps its own column and the space beside
 * it becomes a Rig Green panel carrying the identity — the approved
 * reversed lockup and the tagline — rather than empty page.
 *
 * Flat surfaces on purpose: the old sage-to-white gradient is not part of
 * the system, and the engraved illustration deliberately stays away from
 * forms.
 */
export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[var(--pr-bg)] lg:grid lg:grid-cols-[minmax(0,440px)_1fr]">
      <aside className="hidden lg:flex flex-col justify-between bg-[var(--pr-surface-dark)] text-white p-10">
        <Wordmark size="lg" tone="dark" />
        <div>
          <p className="font-display text-[length:var(--pr-text-xl)] xl:text-[length:var(--pr-text-2xl)] font-bold leading-tight tracking-tight text-balance">
            Know your real cost per mile.
            <br />
            Stop hauling cheap freight.
          </p>
          <p className="text-[var(--pr-sage)] mt-3 leading-snug">
            Free to use. No credit card. The calculator stays free either
            way.
          </p>
        </div>
        <p className="font-display text-xs font-semibold uppercase tracking-[0.14em] text-[var(--pr-sage)]">
          Know your numbers. Take control.
        </p>
      </aside>

      <div className="flex items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-[400px]">
          <div className="flex justify-center mb-6 lg:hidden">
            <Wordmark size="md" />
          </div>
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
