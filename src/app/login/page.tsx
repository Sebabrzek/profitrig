import { LoginForm } from "./LoginForm";
import { Wordmark } from "@/components/Wordmark";

export default function LoginPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-10 bg-gradient-to-b from-brand-soft to-white">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-2.5 mb-8">
          <Wordmark size="lg" />
          <p className="text-foreground text-center text-xl font-extrabold tracking-tight leading-tight">
            Rate Per Mile Calculator
          </p>
          <span className="inline-flex items-center gap-1.5 bg-brand text-white text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full">
            Free for Owner Operators
          </span>
          <p className="text-muted text-center text-sm leading-snug mt-1">
            Know your real cost per mile.
            <br />
            Stop hauling cheap freight.
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
