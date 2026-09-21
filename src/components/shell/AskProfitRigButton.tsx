"use client";

/**
 * Ask ProfitRig in the top bar, where the bottom nav shows (under 1024px).
 * There, a floating launcher would sit on top of a page's numbers and
 * buttons; docked in the bar it never covers anything. It opens the same
 * chat panel (SupportChat listens for ASK_PROFITRIG_EVENT). On a desktop
 * the top bar is hidden and the floating launcher is used instead.
 */
export const ASK_PROFITRIG_EVENT = "profitrig:ask";

export function AskProfitRigButton() {
  return (
    <button
      type="button"
      aria-label="Ask ProfitRig"
      title="Ask ProfitRig"
      onClick={() => window.dispatchEvent(new Event(ASK_PROFITRIG_EVENT))}
      className="group -mx-2 -my-2.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--pr-rig-green)]"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--pr-rig-green)] text-white transition group-hover:bg-[var(--pr-action-dark-hover)]">
        <ChatIcon size={17} />
      </span>
    </button>
  );
}

export function ChatIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a8 8 0 0 1-8 8H5l-2 2V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8z" />
      <circle cx="9" cy="12" r="0.8" fill="currentColor" />
      <circle cx="13" cy="12" r="0.8" fill="currentColor" />
      <circle cx="17" cy="12" r="0.8" fill="currentColor" />
    </svg>
  );
}
