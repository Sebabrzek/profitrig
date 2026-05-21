import Link from "next/link";
import { signOutAction } from "@/app/actions";

type Variant = "calculator" | "loads" | "history" | "profile" | "admin";

const linkClass =
  "text-sm font-semibold text-brand hover:text-brand-dark whitespace-nowrap";

const navItems: Array<{
  variant: Exclude<Variant, "admin">;
  href: string;
  label: string;
}> = [
  { variant: "calculator", href: "/", label: "Calculator" },
  { variant: "loads", href: "/loads", label: "Loads" },
  { variant: "history", href: "/history", label: "History" },
  { variant: "profile", href: "/profile", label: "Profile" },
];

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
    <div className="flex items-center gap-3 sm:gap-4 overflow-x-auto">
      {navItems
        .filter((n) => n.variant !== variant)
        .map((n) => (
          <Link key={n.variant} href={n.href} className={linkClass}>
            {n.label}
          </Link>
        ))}
      {isAdmin && variant !== "admin" && (
        <Link
          href="/admin"
          className="text-xs font-bold uppercase tracking-wider bg-brand-soft text-brand-dark px-2 py-1 rounded-full hover:bg-brand hover:text-white transition whitespace-nowrap"
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
  );
}
