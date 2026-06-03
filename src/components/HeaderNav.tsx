import Link from "next/link";
import { signOutAction } from "@/app/actions";
import { DesktopNavLinks } from "./DesktopNavLinks";

// Variant is kept for backwards compatibility with existing page imports
// but no longer affects rendering — primary navigation lives in BottomNav
// (mobile) and DesktopNavLinks (desktop).
type Variant =
  | "calculator"
  | "loads"
  | "history"
  | "profile"
  | "admin"
  | "upgrade";

export function HeaderNav({
  variant,
  email,
  isAdmin = false,
  isPro = false,
}: {
  variant: Variant;
  email?: string;
  isAdmin?: boolean;
  isPro?: boolean;
}) {
  void variant; // intentional: rendering no longer depends on variant
  return (
    <div className="flex items-center gap-3 sm:gap-5">
      <DesktopNavLinks isPro={isPro} />
      <div className="flex items-center gap-2 sm:gap-3">
        {isPro && (
          <span className="text-[10px] font-bold uppercase tracking-wider bg-brand-soft text-brand-dark px-2 py-0.5 rounded-full whitespace-nowrap">
            Pro
          </span>
        )}
        {isAdmin && (
          <Link
            href="/admin"
            className="text-[10px] font-bold uppercase tracking-wider bg-gray-900 text-white px-2 py-0.5 rounded-full hover:bg-foreground transition whitespace-nowrap"
          >
            Admin
          </Link>
        )}
        <form action={signOutAction}>
          <button
            type="submit"
            className="text-sm text-muted hover:text-foreground whitespace-nowrap"
            title={email}
          >
            Sign Out
          </button>
        </form>
      </div>
    </div>
  );
}
