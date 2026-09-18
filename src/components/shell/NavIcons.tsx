import type { NavKey } from "@/lib/nav";

// The existing ProfitRig nav icons, moved here unchanged so the bottom nav
// and the sidebar draw the same set: 24px, 2px round stroke, one family.

export function NavIcon({ navKey }: { navKey: NavKey }) {
  switch (navKey) {
    case "calc":
      return <CalcIcon />;
    case "loads":
      return <TruckIcon />;
    case "tax":
      return <ReceiptIcon />;
    case "fuel":
      return <FuelIcon />;
    case "profile":
      return <UserIcon />;
  }
}

function CalcIcon() {
  return (
    <svg
      aria-hidden="true"
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
      aria-hidden="true"
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

function FuelIcon() {
  return (
    <svg
      aria-hidden="true"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 21 L4 5 a2 2 0 0 1 2 -2 h6 a2 2 0 0 1 2 2 v16" />
      <line x1="3" y1="21" x2="15" y2="21" />
      <rect x="7" y="6" width="4" height="4" rx="0.5" />
      <path d="M14 11 h2 a2 2 0 0 1 2 2 v3 a1.5 1.5 0 0 0 3 0 v-7 l-3 -3" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg
      aria-hidden="true"
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

function ReceiptIcon() {
  return (
    <svg
      aria-hidden="true"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 3 L18 3 L18 21 L15 19 L12 21 L9 19 L6 21 Z" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="9" y1="12" x2="15" y2="12" />
      <line x1="9" y1="16" x2="13" y2="16" />
    </svg>
  );
}

export function LockIcon({ size = 9 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M6 10V7a6 6 0 1 1 12 0v3h1a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h1zm2 0h8V7a4 4 0 0 0-8 0v3z" />
    </svg>
  );
}
