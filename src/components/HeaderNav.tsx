import Link from "next/link";
import { signOutAction } from "@/app/actions";

type Variant = "calculator" | "history" | "profile";

const linkClass =
  "text-sm font-semibold text-brand hover:text-brand-dark whitespace-nowrap";

export function HeaderNav({
  variant,
  email,
  isAdmin = false,
}: {
  variant: Variant;
  email?: string;
  isAdmin?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 sm:gap-4">
      {variant !== "calculator" && (
        <Link href="/" className={linkClass}>
          ← Calculator
        </Link>
      )}
      {variant !== "profile" && (
        <Link href="/profile" className={linkClass}>
          Profile
        </Link>
      )}
      {variant !== "history" && variant !== "profile" && (
        <Link href="/history" className={linkClass}>
          History
        </Link>
      )}
      {isAdmin && (
        <Link
          href="/admin"
          className="text-xs font-bold uppercase tracking-wider bg-brand-soft text-brand-dark px-2 py-1 rounded-full hover:bg-brand hover:text-white transition"
        >
          Admin
        </Link>
      )}
      <form action={signOutAction}>
        <button
          type="submit"
          className="text-sm text-muted hover:text-foreground"
          title={email}
        >
          Sign Out
        </button>
      </form>
    </div>
  );
}
