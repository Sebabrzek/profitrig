# ProfitRig — handoff

Updated 17 Sep 2026. **Read this first in any new session.**

## How we work

- The founder, Sebastian, is not an engineer. Keep answers short and plain,
  show visuals when they help, and end with one clear next step. Sell outcomes,
  not features.
- **Go Build gate:** do not change app code until he says "Go Build" for that
  specific step. Reading code and running tests from a scratch folder is fine.
- **Ship flow, every step:**
  1. Branch off `main`, build, add tests to `tests/money.ts`.
  2. Give him the SQL migration as a code block to paste into Supabase →
     SQL Editor. Code must tolerate the migration not having run yet.
  3. He says "push it" → push the branch → Vercel preview at
     `https://profitrig-git-<branch>-hellotrucker.vercel.app` (behind Vercel
     login; **uses the live database**).
  4. He checks it and says "merge it" → fast-forward `main`, push, and confirm
     the production deploy (profitrig.com → www.profitrig.com, HTTP 200).
- Never push or merge without his word for that exact action.

## Stack and commands

- Next.js 16 — **read `node_modules/next/dist/docs/` before using Next APIs**
  (see AGENTS.md). Supabase, Stripe, Anthropic SDK, Tailwind v4, Vercel
  deploying `main` of `github.com/Sebabrzek/profitrig`.
- `npm test` (85 checks in `tests/money.ts`) · `npx tsc --noEmit` ·
  `npx eslint <files>` · `npm run build`.
- Lint issues that predate this work: `app/loads/LoadForm.tsx` NumInput
  setState-in-effect error; unused imports in `app/api/tax/export/route.ts`.
- Migrations are `supabase-migration-NNN.sql` at the repo root, run by hand
  before the code ships. Latest is **014**.
- Local preview: `.claude/launch.json` → "profitrig" on port 3000. Signed-in
  pages redirect to /login, so only he can check them (on the Vercel preview).

## What's live (`main` = `a2268f8`)

| Shipped | What it does | Commit · migration |
|---|---|---|
| Accurate weeks | Driver's own date (tz cookie), Mon–Sun or Sun–Sat weeks, a note explaining why a week's profit can move, week CSV matches the Loads tab | `d223d83` · 012 |
| Carrier split | Profile switch + carrier %, stored on every load; revenue is the driver's share | `4bf838f` · 013 |
| Fuel tab | Replaced History. Truck details + weekly odometer and gallons → real MPG. Snapshot history moved to the bottom of Profile, stamped with carrier and split | `a2268f8` · 014 |

Where things live:

- `lib/loads.ts` — `computeLoadEconomics` (revenue = load pay − carrier cut),
  `resolveAllocationBasis`, `describeMonthAllocation`, week helpers with
  `WeekStart`, `todayIsoIn`. **Read every `loads` row through `loadFromRow`.**
- `lib/driverClock.ts` `driverToday()` — the driver's date, from the `pr_tz`
  cookie set by `components/TimeZoneCookie.tsx`.
- `lib/driverSettings.ts` `fetchDriverSettings()` — week start, carrier %,
  carrier name, authority.
- `lib/fuel.ts` `computeFuelStats()` and `app/fuel/`.
- The tax report **deliberately** still reads what loads paid, not the
  driver's share, until the 1099 question (D4) is answered.

## Next up (nothing started)

1. **Break-even and target rate on every load and week** — each shows below
   break-even / covering costs / hit target, from the calculator's numbers and
   the driver's share after the carrier %. Watch out: the fixed-cost sum is
   copied in `Calculator.tsx`, `actions.ts computeTotals` and
   `lib/loads.ts sumFixedMonthly`. Consolidate it, or at least test parity.
2. **Design and branding rollout** — everything is already in `docs/design/`:
   `CLAUDE_IMPLEMENTATION_START.md` (start there), `PROFITRIG_DESIGN_SYSTEM.md`,
   `LOGO_AND_COMPONENT_GUIDE.md`, `README.md`, and under `assets/`: `fonts/`
   (Satoshi Variable, Inter, JetBrains Mono, each with a LICENSE — check web
   use before self-hosting), `logos/` (mark, wordmark, lockup), `illustrations/`,
   `references/` (component board). Read them, compare with the live styling
   (`app/globals.css` tokens: brand #16a34a, Geist + Orbitron via next/font),
   and propose the change and its size before building anything.

After that: carrier fees and the double-count guard (D3), escrow balance (D2),
settlements and reconciliation (Phase 2), upload and extract (Phase 3), lane
data from Truckstop.com (idea only).

Still-open audit bugs: #1 lumpers field says "meals", #2 tolls field shows
$0.00 while charging an estimate, #3 CSV formula injection.

## Open questions (for Sebastian or D. Lewis)

- What Box 1 of the D. Lewis 1099 reports — gross or net (D4).
- Rate confirmations for the 08/09–08/15 settlement, to test gross verification.
- Whether settlement `MILEAGE` is loaded-only or includes deadhead.
- Lease vs settlement mismatches: $30/wk ELD fee not in Appendix A, insurance
  $235 vs $229, escrow missing from every settlement, detention split 80/20.

## Reference

- `docs/plan-carrier-pay-and-fees.md` — plan and status table.
- `docs/phase0-carrier-pay.md` — Phase 0 findings and decisions D1–D5.
- `docs/audit-2026-08-25.md` — audit, with fixed items marked.
- `docs/phase0-source-documents/` — real settlements. **Gitignored: driver
  PII. Never commit.**
- ProfitRig Number Map (visual status):
  https://claude.ai/artifact/5NNa4B9FcfsjuGgTKsL5Z8 — update it whenever
  something ships (read the artifact, rewrite, republish to the same URL).
- Inbox to Ledger (email/camera pipeline design):
  https://claude.ai/artifact/P27DMM9DUePh72cRFiXVMo

## Uncommitted on `main` right now

`.gitignore` (ignores the source documents — keep it), `docs/phase0-carrier-pay.md`
(untracked), status edits to the plan and audit docs, and this file. Commit
them when Sebastian says to.
