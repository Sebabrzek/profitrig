/**
 * Phase 0.6: visitor-mode localStorage backup for the Calculator.
 *
 * Logged-out visitors can use the calculator before signing up; we mirror
 * their state to localStorage so that:
 *   1. A refresh doesn't lose their numbers.
 *   2. After signup, the freshly-created cost_profile row (which is empty
 *      by default) is hydrated from the visitor's typed-in values.
 *
 * We intentionally keep only the cost-profile-shaped fields and nothing
 * about loads or anything else — visitors don't have access to those.
 */

import type { CostProfile } from "@/app/actions";

export const VISITOR_PROFILE_KEY = "profitrig.visitor.v1.costProfile";

export function loadVisitorProfile(): Partial<CostProfile> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(VISITOR_PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CostProfile>;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function saveVisitorProfile(profile: CostProfile): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(VISITOR_PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // localStorage may be unavailable in private mode / quota exceeded —
    // visitor flow still works, just no cross-refresh persistence.
  }
}

export function clearVisitorProfile(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(VISITOR_PROFILE_KEY);
  } catch {
    // ignore
  }
}
