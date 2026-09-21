import { Wordmark } from "@/components/Wordmark";
import { AccountActions } from "./AccountActions";
import { AskProfitRigButton } from "./AskProfitRigButton";
import { BottomNav } from "./BottomNav";
import { SidebarNav } from "./SidebarNav";

/**
 * The application frame every page sits in. It owns navigation, the Off
 * White workspace, the content column, the skip link and the space the
 * fixed navigation takes up — and nothing about any particular page.
 *
 *   under 1024px   white top bar + bottom nav (phones, portrait tablets)
 *   1024px and up  Rig Green sidebar, no top bar, no bottom nav
 *
 * Visitors (signed out, on "/") get the top bar only: there is nowhere for
 * them to navigate to yet.
 *
 * A page chooses how wide its content column is:
 *   form      focused forms, settings and short lists — 640px at every size
 *   standard  the normal application page — one 720px column until the
 *             content area can reach 960px, then up to 1120px so a
 *             work/answer page (AnswerLayout) can sit side by side
 *   wide      data-heavy pages — up to 1360px
 * The widths are tokens in globals.css (--pr-content-*). Signed in on a
 * desktop the column is left-aligned beside the sidebar; visitors centre.
 *
 * A page with a sticky action bar marks it with `pr-action-bar`; the shell
 * reserves room for it and keeps it clear of the bottom nav and sidebar.
 */

export type ContentWidth = "form" | "standard" | "wide";

/** What the page already knows about who is signed in. null = visitor. */
export type ShellAccount = {
  email: string;
  isPro: boolean;
  isAdmin: boolean;
};

export function AppShell({
  account,
  width = "standard",
  children,
}: {
  account: ShellAccount | null;
  width?: ContentWidth;
  children: React.ReactNode;
}) {
  const signedIn = account != null;
  const email = account?.email ?? "";
  const isPro = account?.isPro ?? false;
  const isAdmin = account?.isAdmin ?? false;

  return (
    <div
      className="pr-shell"
      data-nav={signedIn ? "app" : "visitor"}
      data-width={width}
    >
      <a href="#main-content" className="pr-skip-link">
        Skip to content
      </a>

      {signedIn && (
        <aside className="hidden lg:flex fixed inset-y-0 left-0 z-30 w-[var(--pr-sidebar-w)] flex-col overflow-y-auto bg-[var(--pr-surface-dark)] text-[var(--pr-text-dark-surface)]">
          <div className="px-2.5 pt-4 pb-3">
            <Wordmark size="md" tone="dark" />
          </div>
          <SidebarNav isPro={isPro} />
          <AccountActions
            variant="dark"
            signedIn
            email={email}
            isPro={isPro}
            isAdmin={isAdmin}
          />
        </aside>
      )}

      <header
        className={`sticky top-0 z-10 bg-white border-b border-border px-[var(--pr-shell-gutter)] ${
          signedIn ? "lg:hidden" : ""
        }`}
      >
        <div className="pr-shell-column flex flex-wrap items-center justify-between gap-2 py-3 sm:gap-3">
          <Wordmark size="md" />
          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-3">
            {/* Signed in, this bar only shows where the bottom nav does. */}
            {signedIn && <AskProfitRigButton />}
            <AccountActions
              variant="light"
              signedIn={signedIn}
              email={email}
              isPro={isPro}
              isAdmin={isAdmin}
            />
          </div>
        </div>
      </header>

      <main id="main-content" tabIndex={-1} className="pr-shell-main">
        <div className="pr-shell-column">{children}</div>
      </main>

      {signedIn && <BottomNav isPro={isPro} />}
    </div>
  );
}
