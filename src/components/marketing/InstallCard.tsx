"use client";

import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";

/**
 * The install experience.
 *
 * Android and desktop Chrome hand the page a deferred install prompt; when
 * we have one, the button is real and opens the browser's own dialog. An
 * iPhone gives us nothing to call — iOS only installs through the Share
 * menu — so we say so honestly and show the two taps, rather than pretending
 * a button can do it.
 *
 * If ProfitRig is already running as an installed app, none of this is
 * shown. If someone closes the instructions, that is remembered so the page
 * does not keep asking.
 *
 * This adds no offline storage and no service worker: it is the install
 * step only, on top of the manifest and icons that already exist.
 *
 * What the browser tells us lives outside React — an event that may have
 * fired before this mounted, a display mode, a stored dismissal — so it is
 * read through a store rather than copied into state by an effect.
 */

const DISMISSED_KEY = "profitrig.install.dismissed.v1";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type Env = {
  /** False until the browser has been asked; the card stays quiet. */
  ready: boolean;
  installed: boolean;
  ios: boolean;
  canPrompt: boolean;
  dismissed: boolean;
};

const SERVER_ENV: Env = {
  ready: false,
  installed: false,
  ios: false,
  canPrompt: false,
  dismissed: false,
};

let env: Env = SERVER_ENV;
let deferredPrompt: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
let started = false;

function emit() {
  for (const l of listeners) l();
}

function isStandalone(): boolean {
  return Boolean(
    window.matchMedia?.("(display-mode: standalone)").matches ||
      // iOS Safari's own flag, which is not in the standard Navigator type.
      (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  const ua = navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS reports itself as a Mac; a touch point gives it away.
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  );
}

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    // Private windows and blocked site data: just show it.
    return false;
  }
}

function update(patch: Partial<Env>) {
  env = { ...env, ...patch };
  emit();
}

function onBeforeInstallPrompt(e: Event) {
  // Keep the event so our own button can open the dialog later.
  e.preventDefault();
  deferredPrompt = e as InstallPromptEvent;
  update({ canPrompt: true });
}

function onAppInstalled() {
  deferredPrompt = null;
  update({ installed: true, canPrompt: false });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!started) {
    started = true;
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    env = {
      ready: true,
      installed: isStandalone(),
      ios: isIos(),
      canPrompt: deferredPrompt != null,
      dismissed: readDismissed(),
    };
    // Let the first render finish before telling React it changed.
    queueMicrotask(emit);
  }
  return () => {
    listeners.delete(cb);
  };
}

const getSnapshot = () => env;
const getServerSnapshot = () => SERVER_ENV;

function setDismissed(value: boolean) {
  try {
    if (value) window.localStorage.setItem(DISMISSED_KEY, "1");
    else window.localStorage.removeItem(DISMISSED_KEY);
  } catch {
    // Not remembering is a smaller problem than not working.
  }
  update({ dismissed: value });
}

export function InstallCard() {
  const { ready, installed, ios, canPrompt, dismissed } = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<"accepted" | "dismissed" | null>(null);

  async function install() {
    if (!deferredPrompt) return;
    setBusy(true);
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      setOutcome(choice.outcome);
      if (choice.outcome === "accepted") {
        deferredPrompt = null;
        update({ canPrompt: false });
      }
    } catch {
      // The browser refused to show it; the written steps still apply.
      setOutcome("dismissed");
    } finally {
      setBusy(false);
    }
  }

  if (installed) {
    return (
      <Notice title="ProfitRig is installed on this device.">
        You are running it as an app right now. It opens from your home
        screen like any other.
      </Notice>
    );
  }

  // Nothing is rendered until we know what we are on, so the server markup
  // and the first client paint agree.
  if (!ready) return <div className="min-h-[108px]" aria-hidden="true" />;

  if (dismissed) {
    return (
      <button
        type="button"
        onClick={() => setDismissed(false)}
        className="pr-link text-sm"
      >
        Show me how to add ProfitRig to my phone
      </button>
    );
  }

  if (canPrompt) {
    return (
      <div>
        <Button variant="primary" onClick={install} pending={busy}>
          {busy ? "Opening…" : "Install ProfitRig"}
        </Button>
        {outcome === "dismissed" && (
          <p className="mt-3 text-sm leading-snug text-muted">
            No problem. You can install it later from your browser menu —
            look for <strong>Install app</strong> or{" "}
            <strong>Add to Home screen</strong>.
          </p>
        )}
        {outcome === "accepted" && (
          <p className="mt-3 text-sm leading-snug text-muted">
            Installing. ProfitRig will appear with your other apps.
          </p>
        )}
      </div>
    );
  }

  if (ios) {
    return (
      <div>
        <p className="font-display text-base font-bold text-[var(--pr-rig-green)]">
          On an iPhone or iPad
        </p>
        <p className="mt-1 text-sm leading-snug text-muted">
          Safari does not have an install button — you add it from the Share
          menu. It takes two taps.
        </p>
        <ol className="mt-4 space-y-3">
          <Step n={1}>
            Tap <strong>Share</strong> in Safari&apos;s toolbar — the square
            with an arrow coming out of it.
          </Step>
          <Step n={2}>
            Scroll down and tap <strong>Add to Home Screen</strong>, then{" "}
            <strong>Add</strong>.
          </Step>
        </ol>
        <p className="mt-4 text-sm leading-snug text-muted">
          ProfitRig then opens full screen from your home screen, with the
          bison icon.
        </p>
        <DismissLink />
      </div>
    );
  }

  return (
    <div>
      <p className="font-display text-base font-bold text-[var(--pr-rig-green)]">
        Add it from your browser menu
      </p>
      <p className="mt-1 text-sm leading-snug text-muted">
        Open your browser&apos;s menu and look for{" "}
        <strong>Install app</strong> or <strong>Add to Home screen</strong>. On
        a phone it is usually under the three dots.
      </p>
      <DismissLink />
    </div>
  );
}

function DismissLink() {
  return (
    <button
      type="button"
      onClick={() => setDismissed(true)}
      className="pr-link mt-4 text-sm"
    >
      Got it, don&apos;t show this again
    </button>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--pr-rig-green)] font-display text-xs font-bold text-white">
        {n}
      </span>
      <span className="text-sm leading-snug">{children}</span>
    </li>
  );
}
