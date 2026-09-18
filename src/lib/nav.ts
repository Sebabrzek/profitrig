/**
 * The five primary destinations, and the one place their Pro gating and
 * active-route rules live. The phone bottom nav and the desktop sidebar both
 * read from here, so a free driver sees the same locks, and every route
 * lights up the same tab, whichever screen they are on.
 *
 * Plain data and functions only — no JSX — so tests/money.ts can check the
 * rules without a React test setup.
 */

export type NavKey = "calc" | "loads" | "tax" | "fuel" | "profile";

type Destination = {
  key: NavKey;
  /** Sidebar label, where there is room for the full word. */
  label: string;
  /** Bottom-nav label, sized for a fifth of a phone screen. */
  shortLabel: string;
  path: string;
  /** Free drivers are sent to /upgrade instead, and see a lock. */
  proOnly: boolean;
};

export const UPGRADE_PATH = "/upgrade";

// Order is the product's information architecture. Do not reorder.
const DESTINATIONS: readonly Destination[] = [
  { key: "calc", label: "Calculator", shortLabel: "Calc", path: "/", proOnly: false },
  { key: "loads", label: "Loads", shortLabel: "Loads", path: "/loads", proOnly: true },
  { key: "tax", label: "Tax", shortLabel: "Tax", path: "/tax", proOnly: true },
  { key: "fuel", label: "Fuel", shortLabel: "Fuel", path: "/fuel", proOnly: false },
  { key: "profile", label: "Profile", shortLabel: "Profile", path: "/profile", proOnly: false },
];

export type NavItem = {
  key: NavKey;
  label: string;
  shortLabel: string;
  href: string;
  locked: boolean;
};

export function navItems(isPro: boolean): NavItem[] {
  return DESTINATIONS.map((d) => {
    const locked = d.proOnly && !isPro;
    return {
      key: d.key,
      label: d.label,
      shortLabel: d.shortLabel,
      href: locked ? UPGRADE_PATH : d.path,
      locked,
    };
  });
}

/**
 * Which destination a pathname belongs to. `/` matches only itself — every
 * path starts with a slash, so a prefix test would light Calc up everywhere.
 * The others match their own path and anything nested under it
 * (`/loads/new`, `/tax/expenses/abc`), but not a sibling that merely shares
 * the letters (`/loadsheet`). Pages outside the five — `/upgrade`, `/admin` —
 * highlight nothing.
 */
export function activeNavKey(pathname: string | null | undefined): NavKey | null {
  const p = pathname || "/";
  for (const d of DESTINATIONS) {
    if (d.path === "/") {
      if (p === "/") return d.key;
    } else if (p === d.path || p.startsWith(`${d.path}/`)) {
      return d.key;
    }
  }
  return null;
}
