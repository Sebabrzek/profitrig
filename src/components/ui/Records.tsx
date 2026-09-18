import type { ButtonHTMLAttributes } from "react";

/**
 * Small pieces shared by ProfitRig's records (loads, road expenses, fuel
 * weeks). The record surfaces themselves are CSS classes in globals.css
 * ("RECORDS AND LISTS"): .pr-record, .pr-record-link, .pr-row-link and
 * .pr-record-label.
 */

/**
 * "↓ LOSS" beside a negative result on a white record. The number already
 * carries its minus; this says it in words so colour is never the only
 * signal. The arrow is decoration and is not read aloud.
 */
export function LossTag() {
  return (
    <span className="pr-loss-tag">
      <span aria-hidden="true">↓ </span>
      Loss
    </span>
  );
}

/**
 * Delete on a record row: a small trash icon inside a 44px target. The
 * label must say which record ("Delete week of Sep 13"). What happens on
 * press — a confirmation or not — stays with the caller.
 */
export function RecordDeleteButton({
  "aria-label": label,
  className = "",
  ...rest
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "type"> & {
  "aria-label": string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className={`pr-icon-action ${className}`}
      {...rest}
    >
      <svg
        aria-hidden="true"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </svg>
    </button>
  );
}
