# ProfitRig — handoff

Updated 18 Sep 2026. **Read this first in any new session.**

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

**Likely next step:** he says "push it" → push the final 3b commits → give
him the preview link → he checks it → "merge it" → merge 3b. **Phase 3c does
not start until he says "Go Build".**

## Repository state (18 Sep 2026)

- Branch: `design/03b-surfaces-hierarchy`. Latest code commit `f1f8b12`
  (Tax: the (1099) contract-pay space); the tip is the handoff commit on top
  of it — check `git log -3`.
- Pushed: only `caeeef2`. **Not pushed:** `8053709`, `f1f8b12` and the
  handoff commit.
- Phase 3b is **not merged**.
- Production `main` = `origin/main` = `cc90307` (Phase 3a, live).
- 3b preview (still shows `caeeef2` until the next push):
  https://profitrig-git-design-03b-surfaces-hierarchy-hellotrucker.vercel.app
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
| Phase 3a — financial instruments | `63ad0be`, `cc90307` | merged, live |
| Phase 3b — surfaces and hierarchy | `caeeef2`, `8053709`, `f1f8b12` | awaiting final preview and merge |

## Locked design decisions

- Direction: **AMERICAN IRON × FINANCIAL PRECISION.** Tagline KNOW YOUR
  NUMBERS. TAKE CONTROL. The charging bison and the Option 01 wordmark are
  decided; `PENDING.md` under `assets/logos/` only means the vectors are late.
- Palette: Rig Green `#173C2B`, Profit Green `#16A34A`, Sage `#8FAE91`,
  Off White `#F6F7F4`, Charcoal `#1F2937`, Loss Red `#B85C57`,
  Deep Loss `#943F3B`, Loss Wash `#F2DEDA`.
- Type: **Satoshi** = interface hierarchy. **Inter** = work and input.
  **JetBrains Mono** = financial answers and results (never inside inputs).
  **Montserrat Black** = temporary wordmark construction only.
- **Phase 3a financial instruments are LOCKED** (`components/instruments/`).
- Dark surfaces = financial intelligence and results. White surfaces = work
  and input.
- Profit Green means action or a positive financial meaning, never decoration.
- Loss: signed negative value + `↓ LOSS` + a thin Loss Red rule; the panel
  stays Rig Green.
- Positive realized profit: the signed `+$…` only, no `↑ PROFIT`.
- Money: drop only `.00`; meaningful cents always stay. Rates always show two
  decimals. Visual work never changes what a number says.

## Phase 3b status

Built (`components/ui/`): `PageHeader`, `Card` / `CardHeader`,
`SectionHeading`, `EmptyState` (Surfaces.tsx), `Notice` and its error tone
(Notice.tsx), `Chip` (Chip.tsx), plus the `--pr-surface-muted` token.
Converted: Calculator, Loads (list, new, edit, LoadForm), Fuel, Tax and its
subpages, Profile, Upgrade, Admin, ProfileBanner, RoadExpenseCard.

Sebastian reviewed Calculator, Loads, Tax, Fuel and the Load editor. Decided:

- The 3b system is approved.
- The Notice with the Sage left rule is approved, and was made more compact.
- The standard Card is unchanged.
- The large empty space on Fuel is intentional. **Do not fill it** with
  decorative content.
- Fixed in the last pass: the W-2 wages and (1099) contract-pay spaces on Tax.

Belongs to later phases, not 3b:

- **3c:** inputs, buttons, links, the dashed estimate box, the Upgrade plan
  toggle, the chat launcher colour.
- **3d:** records and lists (load card profit pills, grey tiles).
- **Phase 5:** signed-out and marketing surfaces (VisitorPitch, login,
  landing), PWA theme colour, the wordmark vector.

## Stack, commands, gotchas

- Next.js 16 (App Router, Turbopack) — **read `node_modules/next/dist/docs/`
  before using Next APIs.** React 19, Tailwind v4, Supabase, Stripe,
  Anthropic SDK, Vercel deploying `main` of `github.com/Sebabrzek/profitrig`.
- `npm test` = 147 checks in `tests/money.ts` (money math, CSV, calculator,
  nav, formatters).
- Migrations: `supabase-migration-NNN.sql` at the repo root, run by hand.
  Latest is **014**.
- Local preview: `.claude/launch.json` → "profitrig", port 3000. Signed-in
  pages redirect to /login; for visual checks, a temporary page under
  `src/app/login-harness/` gets through the middleware. **Delete it before
  committing.**
- If the dev server serves stale CSS (after `npm run build`): stop it,
  `rm -rf .next/dev`, restart.
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
