"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  isPro?: boolean;
};

export function BottomNav({ isPro = false }: Props) {
  const pathname = usePathname() ?? "/";

  // Hide on login (user not signed in there)
  if (pathname.startsWith("/login") || pathname.startsWith("/auth")) {
    return null;
  }

  const tabs: {
    key: string;
    label: string;
    href: string;
    active: boolean;
    locked: boolean;
    icon: React.ReactNode;
  }[] = [
    {
      key: "calc",
      label: "Calculator",
      href: "/",
      active: pathname === "/",
      locked: false,
      icon: <CalcIcon />,
    },
    {
      key: "loads",
      label: "Loads",
      href: isPro ? "/loads" : "/upgrade",
      active: pathname.startsWith("/loads"),
      locked: !isPro,
      icon: <TruckIcon />,
    },
    {
      key: "history",
      label: "History",
      href: "/history",
      active: pathname.startsWith("/history"),
      locked: false,
      icon: <ClockIcon />,
    },
    {
      key: "profile",
      label: "Profile",
      href: "/profile",
      active: pathname.startsWith("/profile"),
      locked: false,
      icon: <UserIcon />,
    },
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-border"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="max-w-2xl mx-auto grid grid-cols-4">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            className={`flex flex-col items-center justify-center gap-1 py-2.5 transition ${
              t.active
                ? "text-brand-dark"
                : "text-muted hover:text-foreground"
            }`}
          >
            <div className="relative">
              <span className={t.active ? "opacity-100" : "opacity-80"}>
                {t.icon}
              </span>
              {t.locked && (
                <span
                  className="absolute -top-1 -right-1 bg-gray-900 text-white rounded-full w-4 h-4 flex items-center justify-center"
                  aria-label="Pro only"
                >
                  <LockIcon />
                </span>
              )}
            </div>
            <span
              className={`text-[11px] leading-none ${
                t.active ? "font-bold" : "font-semibold"
              }`}
            >
              {t.label}
            </span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

function CalcIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <rect x="8" y="6" width="8" height="3" rx="0.5" fill="currentColor" />
      <circle cx="9" cy="13" r="0.8" fill="currentColor" />
      <circle cx="12" cy="13" r="0.8" fill="currentColor" />
      <circle cx="15" cy="13" r="0.8" fill="currentColor" />
      <circle cx="9" cy="17" r="0.8" fill="currentColor" />
      <circle cx="12" cy="17" r="0.8" fill="currentColor" />
      <circle cx="15" cy="17" r="0.8" fill="currentColor" />
    </svg>
  );
}

function TruckIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="1" y="6" width="13" height="10" rx="1" />
      <path d="M14 9 L18 9 L21 12 L21 16 L14 16 Z" />
      <circle cx="6" cy="18" r="2" fill="currentColor" />
      <circle cx="17.5" cy="18" r="2" fill="currentColor" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 14" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21 a8 8 0 0 1 16 0" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 10V7a6 6 0 1 1 12 0v3h1a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h1zm2 0h8V7a4 4 0 0 0-8 0v3z" />
    </svg>
  );
}
