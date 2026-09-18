"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { activeNavKey, navItems } from "@/lib/nav";
import { LockIcon, NavIcon } from "./NavIcons";

/** The five destinations as a vertical list, for the Rig Green sidebar. */
export function SidebarNav({ isPro }: { isPro: boolean }) {
  const active = activeNavKey(usePathname());

  return (
    <nav aria-label="Primary" className="flex-1 px-3 py-2">
      <ul className="flex flex-col gap-1">
        {navItems(isPro).map((it) => {
          const isActive = it.key === active;
          return (
            <li key={it.key}>
              <Link
                href={it.href}
                aria-current={isActive ? "page" : undefined}
                className={`relative flex items-center gap-3 min-h-11 pl-4 pr-3 rounded-[var(--pr-radius-button)] font-display text-[15px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--pr-sage)] ${
                  isActive
                    ? "bg-white/10 text-white font-bold"
                    : "text-white/75 font-medium hover:bg-white/5 hover:text-white"
                }`}
              >
                {/* Sage rule + weight + surface mark the current page, so the
                    state never depends on colour alone. */}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-[var(--pr-sage)]"
                  />
                )}
                <NavIcon navKey={it.key} />
                <span className="flex-1">{it.label}</span>
                {it.locked && (
                  <>
                    <span
                      aria-hidden="true"
                      className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[var(--pr-sage)]"
                    >
                      <LockIcon size={11} />
                      Pro
                    </span>
                    <span className="sr-only">(Pro only)</span>
                  </>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
