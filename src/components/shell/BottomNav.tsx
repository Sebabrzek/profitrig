"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeNavKey, navItems } from "@/lib/nav";
import { LockIcon, NavIcon } from "./NavIcons";

/**
 * Phone and portrait-tablet navigation: the five destinations along the
 * bottom, in thumb reach. Hidden once the sidebar takes over (lg, 1024px).
 */
export function BottomNav({ isPro }: { isPro: boolean }) {
  const active = activeNavKey(usePathname());

  return (
    <nav
      aria-label="Primary"
      className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-border"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="max-w-2xl mx-auto grid grid-cols-5 h-[calc(var(--pr-bottom-nav-h)-1px)]">
        {navItems(isPro).map((t) => {
          const isActive = t.key === active;
          return (
            <li key={t.key} className="flex">
              <Link
                href={t.href}
                aria-current={isActive ? "page" : undefined}
                className={`relative flex flex-1 flex-col items-center justify-center gap-1 font-display transition focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-[var(--pr-rig-green)] ${
                  isActive
                    ? "text-brand-dark"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {/* Active tab carries a bar as well as colour and weight, so
                    the state never depends on colour alone. */}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute top-0 inset-x-4 h-[3px] rounded-b-full bg-[var(--pr-rig-green)]"
                  />
                )}
                <span className="relative">
                  <span className={isActive ? "opacity-100" : "opacity-80"}>
                    <NavIcon navKey={t.key} />
                  </span>
                  {t.locked && (
                    <span
                      aria-hidden="true"
                      className="absolute -top-1 -right-1 bg-[var(--pr-charcoal)] text-white rounded-full w-4 h-4 flex items-center justify-center"
                    >
                      <LockIcon />
                    </span>
                  )}
                </span>
                <span
                  className={`text-[11px] leading-none ${
                    isActive ? "font-bold" : "font-semibold"
                  }`}
                >
                  {t.shortLabel}
                  {t.locked && <span className="sr-only"> (Pro only)</span>}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
