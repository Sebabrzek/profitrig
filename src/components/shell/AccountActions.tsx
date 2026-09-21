import Link from "next/link";
import { signOutAction } from "@/app/actions";
import { ButtonLink } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";

/**
 * Plan badge, Admin link and Sign Out — or, for a visitor, Sign In and
 * Create Account. "light" sits in the white top bar (phone and portrait
 * tablet); "dark" sits at the foot of the Rig Green sidebar.
 */
export function AccountActions({
  variant,
  signedIn,
  email = "",
  isPro = false,
  isAdmin = false,
}: {
  variant: "light" | "dark";
  signedIn: boolean;
  email?: string;
  isPro?: boolean;
  isAdmin?: boolean;
}) {
  if (!signedIn) {
    // Dark, not Profit Green: the signed-out page already has one green
    // action in the bar at the foot of the calculator, and a screen gets
    // one obvious primary.
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/login"
          className="inline-flex items-center min-h-11 -my-2.5 text-sm font-semibold text-[var(--pr-rig-green)] hover:text-[var(--pr-action-dark-hover)] whitespace-nowrap"
        >
          Sign In
        </Link>
        <ButtonLink
          href="/login"
          variant="dark"
          size="sm"
          className="whitespace-nowrap"
        >
          Create Account
        </ButtonLink>
      </div>
    );
  }

  if (variant === "light") {
    return (
      <div className="flex items-center gap-2 sm:gap-3">
        {isPro && <Chip>Pro</Chip>}
        {isAdmin && (
          <Link
            href="/admin"
            className="inline-flex items-center min-h-11 -my-2.5 whitespace-nowrap"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider bg-[var(--pr-charcoal)] text-white px-2 py-0.5 rounded-full hover:bg-foreground transition">
              Admin
            </span>
          </Link>
        )}
        <form action={signOutAction}>
          <button
            type="submit"
            className="inline-flex items-center min-h-11 -my-2.5 text-sm text-muted hover:text-foreground whitespace-nowrap"
            title={email}
          >
            Sign Out
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="border-t border-[var(--pr-border-dark)] px-3 pt-3 pb-4 flex flex-col gap-1">
      {(isPro || isAdmin) && (
        <div className="flex items-center gap-2 px-4 min-h-11">
          {isPro && (
            <span className="text-[10px] font-bold uppercase tracking-wider bg-white/10 text-[var(--pr-sage)] px-2 py-0.5 rounded-full">
              Pro
            </span>
          )}
          {isAdmin && (
            <Link
              href="/admin"
              className="inline-flex items-center min-h-11 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pr-sage)]"
            >
              <span className="text-[10px] font-bold uppercase tracking-wider bg-white/10 text-white px-2 py-0.5 rounded-full hover:bg-white/20 transition">
                Admin
              </span>
            </Link>
          )}
        </div>
      )}
      <form action={signOutAction}>
        <button
          type="submit"
          title={email}
          className="w-full flex items-center min-h-11 px-4 rounded-[var(--pr-radius-button)] font-display text-sm font-medium text-white/75 hover:bg-white/5 hover:text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pr-sage)]"
        >
          Sign Out
        </button>
      </form>
    </div>
  );
}
