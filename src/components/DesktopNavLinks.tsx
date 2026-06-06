"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  isPro?: boolean;
};

const items: { key: string; label: string; href: (isPro: boolean) => string; match: (p: string) => boolean }[] = [
  {
    key: "calc",
    label: "Calculator",
    href: () => "/",
    match: (p) => p === "/",
  },
  {
    key: "loads",
    label: "Loads",
    href: (isPro) => (isPro ? "/loads" : "/upgrade"),
    match: (p) => p.startsWith("/loads"),
  },
  {
    key: "tax",
    label: "Tax",
    href: (isPro) => (isPro ? "/tax" : "/upgrade"),
    match: (p) => p.startsWith("/tax"),
  },
  {
    key: "history",
    label: "History",
    href: () => "/history",
    match: (p) => p.startsWith("/history"),
  },
  {
    key: "profile",
    label: "Profile",
    href: () => "/profile",
    match: (p) => p.startsWith("/profile"),
  },
];

export function DesktopNavLinks({ isPro = false }: Props) {
  const pathname = usePathname() ?? "/";

  return (
    <div className="hidden md:flex items-center gap-5">
      {items.map((it) => {
        const active = it.match(pathname);
        const locked = (it.key === "loads" || it.key === "tax") && !isPro;
        return (
          <Link
            key={it.key}
            href={it.href(isPro)}
            className={`relative text-sm font-semibold whitespace-nowrap transition ${
              active
                ? "text-brand-dark"
                : "text-foreground/70 hover:text-foreground"
            }`}
          >
            {it.label}
            {locked && (
              <span
                className="ml-1 inline-flex items-center"
                aria-label="Pro only"
              >
                <LockIcon />
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

function LockIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" className="opacity-60">
      <path d="M6 10V7a6 6 0 1 1 12 0v3h1a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h1zm2 0h8V7a4 4 0 0 0-8 0v3z" />
    </svg>
  );
}
