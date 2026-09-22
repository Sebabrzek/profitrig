# ProfitRig — handoff

Updated 21 Sep 2026. **Read this first in any new session.**

## Start of a new session: do not code

1. Read this file, then `AGENTS.md`, then `CLAUDE.md`.
2. Read the design files CLAUDE.md names: `docs/design/README.md`,
   `docs/design/PROFITRIG_DESIGN_SYSTEM.md`,
   `docs/design/CLAUDE_IMPLEMENTATION_START.md`, and look at the images under
   `docs/design/assets/` (bison mark, Option 01 wordmark, component board,
   illustrations).
3. Run `git status` and check the current branch.
4. Tell Sebastian, briefly and in plain words, what you understand.
5. Wait for his instruction.

**Likely next step:** the design rollout is finished — 3a–3d, the Ask
ProfitRig guardrails, the Phase 4A identity and Phase 5 are all merged and
live. Every screen, signed in and signed out, is now on the system. What
follows is Sebastian's call, and the business work is the carrier-pay order
at the bottom of this file. **Nothing starts until he says "Go Build".**

## Repository state (22 Sep 2026)

- Production `main` = `origin/main` = `2f8b6ef` (Phase 5), live.
  `git log --oneline -3` is the truth; this file is a summary.
- **Waiting to merge: `design/04-marketing`** — the marketing homepage and
  the financial fixes, 11 commits ahead of `main`, latest `834c4a3`.
  **Not merged, not in production.** The last two commits — `0270ff5` (the
  calculation audit) and `834c4a3` (the two correctness fixes) — are **local
  only**; the remote branch is still at `eba79e8`, so a push comes first.
- The landing page is approved and ready for final push, merge and deploy
  now that the financial patch is approved.
- Merged branches kept on the remote: `design/03b-surfaces-hierarchy`,
  `design/03c-actions-inputs`, `design/03d-records-lists`,
  `feature/ai-guardrails`, `security/016-chat-writes`, `design/04a-identity`,
  `design/05-signed-out`.
- Untracked and **not ours**: two reference images Sebastian dropped into
  `docs/design/assets/references/archive/` (`ProfitRig Design.png`,
  `webpageexample.png`). Nothing references them. Leave them.
- Uncommitted and **not ours to touch**: `docs/audit-2026-08-25.md`,
  `docs/plan-carrier-pay-and-fees.md` (modified), `docs/phase0-carrier-pay.md`
  (untracked). Never stage, commit, revert or clean them.

## How we work

- Sebastian is the founder, not an engineer. Short, plain answers; show
  visuals when they help; end with one clear next step.
- **Go Build gate:** no code changes until he says "Go Build" for that step.
  Reading code and running checks is fine.
- **One phase or branch at a time.** No unrelated cleanup. Don't invent a
  design decision where one is pending — ask.
- **Tests before "done":** `npm test`, `npx tsc --noEmit`, `npx eslint` on the
  touched files, `npm run build`.
- **Supabase:** if a change needs one, give him the exact SQL to paste into
  Supabase → SQL Editor. Code must tolerate it not having run yet.
- **"push it"** → push the branch → give him the preview link
  `https://profitrig-git-<branch>-hellotrucker.vercel.app` (behind Vercel
  login; **uses the live database**).
- **"merge it"** → fast-forward `main`, push, confirm production is healthy
  (profitrig.com → www.profitrig.com, HTTP 200).
- Never push or merge without his word for that exact action.
- Never create sample data or change live data.

## Done

| Work | Commits | State |
|---|---|---|
| Audit fixes (lumpers label, tolls estimate, CSV injection) | `0424395` | live |
| Design package (`docs/design/`) | `61c0d8c`, `f88c301` | live |
| Phase 1 — tokens and fonts | `1cdad30`, `4d96944` | live |
| Phase 2a — app shell | `808ba59` | live |
| Phase 2b — desktop layout | `584f72c` | live |
| Phase 3a — financial instruments | `63ad0be`, `cc90307` | live |
| Phase 3b — surfaces and hierarchy | `caeeef2`, `8053709`, `f1f8b12`, `e1ce89d` | live |
| Phase 3c — actions and inputs | `9e0af8e`, `f4f13be` | live |
| Phase 3d — records and lists | `b0e1df2`, `cf86249` | live |
| Ask ProfitRig guardrails | `91d5d85`, `2c2c9a9`, `fab6a25` | live (migration 015 applied) |
| Chat rows server-written only | `2e4def2` | live (migration 016 applied) |
| Phase 4A — the approved identity | `3379df7` | live |
| Phase 5 — signed-out surfaces | `460b863` | live |
| Phase 4 — marketing homepage | `3379df7`…`eba79e8` | on `design/04-marketing`, approved, **not merged** |
| Calculation audit (tests only) | `0270ff5` | local only, 195 → 213 checks |
| Financial correctness fixes | `834c4a3` | local only, approved, 213 → 223 checks |

## Locked design decisions

- Direction: **AMERICAN IRON × FINANCIAL PRECISION.** Tagline KNOW YOUR
  NUMBERS. TAKE CONTROL. The charging bison and the Option 01 wordmark are
  decided, and since Phase 4A the production vectors exist: masters under
  `docs/design/assets/logos/`, the two files the app serves in
  `public/brand/`. Never retype or redraw either — the bison and wordmark
  path data is identical in every asset, and must stay that way.
- Palette: Rig Green `#173C2B`, Profit Green `#16A34A`, Sage `#8FAE91`,
  Off White `#F6F7F4`, Charcoal `#1F2937`, Loss Red `#B85C57`,
  Deep Loss `#943F3B`, Loss Wash `#F2DEDA`.
- Type: **Satoshi** = interface hierarchy. **Inter** = work and input.
  **JetBrains Mono** = financial answers and results (never inside inputs).
  No font builds the logo; the wordmark is vector artwork.
- **Phase 3a financial instruments are LOCKED** (`components/instruments/`).
- **Phases 3b, 3c and 3d are LOCKED**: the surface and hierarchy system
  (`components/ui/Surfaces.tsx`, `Notice.tsx`, `Chip.tsx`), the button and
  field systems (`Button.tsx`, `Field.tsx`, `SegmentedControl.tsx`,
  `ActionBar.tsx`) and the record primitives (`Records.tsx`).
- Dark surfaces = financial intelligence and results. White surfaces = work
  and input.
- Profit Green means action or a positive financial meaning, never decoration.
- Loss: signed negative value + `↓ LOSS` + a thin Loss Red rule; the panel
  stays Rig Green.
- Positive realized profit: the signed `+$…` only, no `↑ PROFIT`.
- Money: drop only `.00`; meaningful cents always stay. Rates always show two
  decimals. Visual work never changes what a number says.

## Decisions from the design reviews — keep them

- The large empty space on Fuel is intentional. **Do not fill it** with
  decorative content.
- The Notice with the Sage left rule is approved and deliberately compact.
- The load ledger is desktop only (≥1024px); phones get load **cards**. Do
  not render a compressed ledger on a phone.
- Ask ProfitRig docks in the top bar under 1024px so it cannot cover a
  driver's numbers; it floats only on desktop. Its colour is Rig Green.
- "+ Add a Load" is full width on a phone, 240px from tablet up.
- No grey tiles, and no Profit Green hover borders on records.
- The mobile top bar wraps to two rows when signed out, because the lockup
  has a 200px minimum width. Approved 21 Sep 2026 — not a bug to fix.

Phase 5 added four, on questions the design system deliberately leaves open:

- **The subscription price is Satoshi, not JetBrains Mono.** Mono is what a
  driver's own operating numbers look like; what ProfitRig charges is not
  one of them, and blurring that would cost the mono figures their meaning.
- **Nothing goes above the calculator on the landing page.** No brand band,
  no illustration. A visitor arriving from an ad was promised a calculator,
  so the calculator is the first thing under the headline. The American Iron
  illustration stays unshipped; using it would also need a web export, as
  the master is a 3.6 MB 4K PNG.
- **From 1024px the login page is two panels:** the form keeps its column
  and the space beside it is Rig Green with the reversed lockup. Phones keep
  the single column they always had.
- **One Profit Green action per screen.** Signed out that is "Save my
  numbers"; the header's Create Account is dark and the pitch's is
  secondary. Profit Green is an action or earned money, never decoration —
  which is also why the hero's second line and its ticks are Rig Green.

## Ask ProfitRig — how it is protected

The browser sends one question and nothing else; the server decides
everything (`src/lib/aiGuard.ts` holds the rules, and they are tested).

- Limits per driver, enforced in Postgres by `ai_reserve_request()`, rolling:
  Pro 5/minute, 30/day, 300/month. Free 5/5/25. It fails closed.
- Every request is recorded in `ai_usage` with tokens, status and cost.
  Measured: about 4,400 input tokens a question, so a Pro driver at the cap
  costs roughly $2 a month.
- Chat rows are written **only** by the server with the service-role key.
  A driver can read their own transcript and nothing else (migration 016).
- Only server-written (`trusted`) rows are ever replayed to the model, so a
  driver cannot forge an earlier answer to argue with.
- Cancellation is best effort: Vercel usually lets a request finish, so an
  abandoned answer may still complete. Do not claim otherwise.

## The financial fixes — what was decided, 22 Sep 2026

The calculation audit grew the suite from **195 to 213 to 223 passing
checks**. It proved the three importable copies of the cost-per-mile formula
agree across 400 profiles, that no load or week figure can be NaN or
Infinity across 8,000 combinations, and that a week is exactly the sum of its
loads. It found two real defects, both fixed in **`834c4a3`** and approved.

- **`effectiveCarrierPct` no longer falls back to 0 for out-of-domain
  values.** Anything at or above 100 used to be discarded, which handed the
  driver the *whole* load instead of none of it — an invalid percentage
  overstating revenue, the direction that makes a losing load look
  acceptable. Values are clamped into 0–100: 100 stays 100 and zeroes the
  driver's share, above 100 caps at 100, negative floors at 0. A value that
  is not a usable number at all still reads as 0, because no split was
  recorded and that is the independent driver's case.
- **The UI and save validation still limit carrier percentage to 0–99**, on
  purpose. `LoadForm` and `saveLoadAction` reject anything at or above 100
  ("Carrier % must be between 0 and 99"). The clamp is the last line for rows
  that reach the math some other way. **Do not widen the domain in this
  release** — the two layers disagreeing about 100 is a deliberate decision,
  not an oversight.
- **Malformed optional numeric values on a load resolve to null**, which
  means "estimate this one" — the same path a blank field has always taken.
  They used to pass through as NaN and turn a load's total cost, its profit
  and its whole week into NaN. Zero was rejected as the fallback: it would
  assert the load truly cost nothing and overstate its profit.
- **Blank and whitespace-only optional values are treated as absent, not as
  a literal zero**, because JavaScript reads `""` as 0 — the same dangerous
  direction.
- **No other formula changed.** Only `effectiveCarrierPct` and
  `loadFromRow`'s `optional()` were touched, eight lines between them.

Deferred on purpose, none of them blocking release:

- **The Admin CPM is still a fourth, inline copy** of the cost formula in
  `app/admin/page.tsx`. It cannot be imported, so nothing guards it; it was
  read line by line and matches. Extracting it into `lib/` is its own task.
- **Loads and Tax still report different revenue for the same year** — the
  tab a leased driver's share, the tax report the gross — pending D4. The gap
  is now pinned by test as exactly the carrier's cut, so it cannot drift into
  something else.
- **The marketing design is approved and good enough to release.**
- **The closing CTA still carries the older, heavier two-truck artwork.** It
  is a future visual refinement, not a release blocker.

## Still open

- The design rollout is **complete**: every screen, signed in and signed
  out, is on the system. There is no Phase 6.
- The Phase 1 compatibility colour aliases (`--brand`, `--brand-dark`,
  `--brand-soft`, `text-muted`, `border-border`) are still used by about
  thirty files, including the shared components. Retiring them is its own
  task and needs approval; it is not a side effect of anything else.
- The Admin view of `ai_usage` is not built. Sebastian's own test chat and
  its 12 usage rows are deliberately still in the database.
- Supabase "Confirm email" is still unverified. Do not enable it before
  sign-up has a "check your email" step and a callback route — today it has
  neither, so turning it on would break sign-up.

## Stack, commands, gotchas

- Next.js 16 (App Router, Turbopack) — **read `node_modules/next/dist/docs/`
  before using Next APIs.** React 19, Tailwind v4, Supabase, Stripe,
  Anthropic SDK, Vercel deploying `main` of `github.com/Sebabrzek/profitrig`.
- `npm test` = 194 checks in `tests/money.ts` (money math, CSV, calculator,
  nav, formatters, and the Ask ProfitRig guardrails).
- Migrations: `supabase-migration-NNN.sql` at the repo root, run by hand.
  Latest is **016**, applied 21 Sep 2026.
- Local preview: `.claude/launch.json` → "profitrig", port 3000. Signed-in
  pages redirect to /login, so local checks only reach signed-out screens; a
  temporary page under `src/app/login-harness/` gets through the middleware
  if one is needed. **Delete it before committing.**
- If the dev server serves stale CSS (after `npm run build`): stop it,
  `rm -rf .next/dev`, restart.
- The Vercel CLI now asks for a fresh login, and preview URLs sit behind
  Vercel SSO, so a preview cannot be checked from here — it redirects to a
  Vercel sign-in page. Say so plainly rather than implying it was verified;
  production on www.profitrig.com can still be checked over plain HTTP.
- The JSX compiler drops a space before text containing `&apos;` / `&quot;`
  after an element or expression. Write an explicit `{" "}` and check the
  compiled output.
- Lint findings that predate the design work (compare against `main`, don't
  fix unasked): set-state-in-effect in Calculator (×2), LoadForm,
  ProfileBanner, SupportChat; admin impure render; unused `signOutAction`
  (admin), `categoryMeta` (tax/expenses), `_hasExistingCustomer`
  (UpgradeCard); unused imports in `app/api/tax/export/route.ts`.
- The fixed-cost sum exists in four copies: `lib/calculatorTotals.ts`,
  `actions.ts computeTotals`, `lib/loads.ts sumFixedMonthly`, admin per-user
  CPM. Consolidating them is its own task and needs approval.

## After the design rollout

Order stays: finish the design phases → break-even and target rate on every
load and week → carrier fees and the double-count guard (D3), escrow (D2),
settlements and reconciliation, upload and extract.

Where the money logic lives: `lib/loads.ts` (`computeLoadEconomics`; read
every `loads` row through `loadFromRow`), `lib/format.ts` (`formatMoney`,
`formatRate`, `outcomeOf`), `lib/driverClock.ts`, `lib/driverSettings.ts`,
`lib/fuel.ts`. The tax report **deliberately** reads what loads paid, not the
driver's share, until D4 is answered.

## Open questions (for Sebastian or D. Lewis)

- What Box 1 of the D. Lewis 1099 reports — gross or net (D4).
- Rate confirmations for the 08/09–08/15 settlement.
- Whether settlement `MILEAGE` is loaded-only or includes deadhead.
- Lease vs settlement mismatches: $30/wk ELD fee, insurance $235 vs $229,
  escrow missing, detention split 80/20.

## Reference

- `docs/plan-carrier-pay-and-fees.md`, `docs/phase0-carrier-pay.md` (D1–D5),
  `docs/audit-2026-08-25.md` (stale).
- `docs/phase0-source-documents/` — real settlements. **Gitignored: driver
  PII. Never commit.**
- ProfitRig Number Map (stale, update when asked):
  https://claude.ai/artifact/5NNa4B9FcfsjuGgTKsL5Z8
- Inbox to Ledger: https://claude.ai/artifact/P27DMM9DUePh72cRFiXVMo
