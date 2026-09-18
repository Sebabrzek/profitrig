"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The answer column, pinned in view while the work column scrolls — but
 * only when all of it fits. It measures instead of guessing, because the
 * answer changes height (the "From your loads" card, the MANUAL badge, a
 * second allocation note), and a pinned column taller than the window would
 * hide its own bottom.
 *
 * It pins only when:
 *   - the answer actually sits beside the work (a wide content area),
 *   - the whole answer fits between the top of the window — or under a
 *     visible sticky top bar — and the first fixed control along the bottom
 *     that shares its column (a save bar, the chat button).
 * Otherwise it scrolls with the page like everything else.
 */

const GUTTER = 32; // desktop workspace gutter, --pr-shell-gutter at lg
const CLEARANCE = 16;

export function PinnedAnswer({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Measured directly, not in an animation frame: a tab opened in the
    // background never runs animation frames until it is shown.
    const measure = () => setTop(pinTop(el));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener("resize", measure);
    // Pinning only matters while the page moves, so re-check then too. That
    // catches anything fixed that arrives after the first check (the chat
    // button, a save bar) and any resize the browser reports late. A few
    // position reads; React ignores an unchanged result.
    window.addEventListener("scroll", measure, { passive: true });
    const late = window.setTimeout(measure, 600);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure);
      window.clearTimeout(late);
    };
  }, []);

  return (
    <div
      ref={ref}
      className="pr-answer-layout-answer"
      data-pinned={top == null ? undefined : ""}
      style={top == null ? undefined : { top }}
    >
      {children}
    </div>
  );
}

function pinTop(el: HTMLElement): number | null {
  const layout = el.parentElement;
  if (!layout || getComputedStyle(layout).display !== "grid") return null;

  const header = document.querySelector<HTMLElement>(".pr-shell > header");
  const headerHeight =
    header && getComputedStyle(header).display !== "none"
      ? header.getBoundingClientRect().height
      : 0;
  const top = Math.max(GUTTER, headerHeight + CLEARANCE);

  const box = el.getBoundingClientRect();
  let floor = window.innerHeight;
  document
    .querySelectorAll<HTMLElement>(".pr-action-bar, .pr-chat-launcher")
    .forEach((fixed) => {
      const r = fixed.getBoundingClientRect();
      if (r.width > 0 && r.left < box.right && r.right > box.left) {
        floor = Math.min(floor, r.top);
      }
    });

  return top + el.offsetHeight + CLEARANCE <= floor ? top : null;
}
