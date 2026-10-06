# ProfitRig — handoff

Updated 6 Oct 2026. **Read this first in any new session.**

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

## Repository state (6 Oct 2026)

- Production `main` = `origin/main` = `9051f0d` (6 Oct), live: the monthly
  AI allowance (D0), in-app alerts (Phase B), partials for every Pro driver,
  the PWA opening on /calculator, the ivory canvas, per diem by days on the
  road, Admin's shared CPM formula, and the read-only Admin page per driver
  with an Email draft. Migrations 017, 018 and 019 are applied.
  `git log --oneline -3` is the truth; this file is a summary.
- **Pro Plus is created in Stripe** ($19.99/mo, its own product) and the
  Customer portal lets plans switch, prorated and charged immediately,
  downgrades at period end. It stays off the upgrade page until
  `STRIPE_PRICE_PRO_PLUS` is set in Vercel — Sebastian's call, suggested for
  when scanning ships.
- **In review: `feature/scanner` (D1)** — needs migration 020 run by hand
  before merge. Not merged.
- **The money button is PAUSED.** Sebastian has rejected the crossed lathe,
  the dollar wave, a banknote border and a scroll, and is not settled on a
  direction. Do not raise it until he does. `+ Add a Load` keeps production's
  treatment. The attempts are on `design/06-money-and-canvas` (local only):
  its canvas and PWA parts have shipped from the branch above; only the
  button remains there.
- `PARTIAL_LOADS_EMAILS` in Vercel is unused once the branch above is merged,
  and can be deleted.
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
| Phase 4 — marketing homepage | `3379df7`…`eba79e8` | live |
| Calculation audit (tests only) | `0270ff5` | live, 195 → 213 checks |
| Financial correctness fixes | `834c4a3` | live, 213 → 223 checks |
| Partial loads (one Owner first) | `8c3b7f4` | live (migration 017 applied), 223 → 262 checks |
| Partials for every Pro driver | `678ef95` | live |
| PWA opens on /calculator; ivory canvas | `f8935e5` | live |
| Per diem counts days on the road; Admin CPM shared | `d96de91` | live, 259 → 275 checks |
| Admin: one page per driver, read-only, everything they entered | `7fb8005`, `d96310f`, `db835a5` | live (email only — no texting) |
| Phase B — in-app alerts, "This is right" | `6896f8e` | live (migration 018 applied) |
| D0 — monthly AI allowance in dollars; Pro Plus plumbing | `9051f0d` | live (migration 019 applied), 322 → 347 checks |
| Phase B — in-app alerts, "this is right" | — | on `feature/in-app-alerts`, **not merged** (migration 018), 307 → 322 checks |

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

- **A monthly AI allowance in dollars** (D0, migration 019), enforced in
  Postgres by `ai_reserve_budget()`: it locks on the driver, keeps the
  per-minute and per-day caps, adds up this calendar month's spend (UTC, so
  it never resets later than the 1st for a US driver) and starts a request
  only if what it may cost fits whole. It fails closed. Until 019 has run,
  the code falls back to the old `ai_reserve_request()` question counts.
- Every request is recorded in `ai_usage` with tokens, status, cost and
  feature (`chat`, later `scan`). Measured: about 4,400 input tokens a
  question — roughly half a cent on Haiku.
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

## Partial loads — what was decided, 25 Sep 2026

A partial is a second load riding in the same trailer as one already booked
(the primary). It is an ordinary `loads` row with `parent_load_id` set.

- **It records what it ADDED to the trip, not what it is.** Full pay; only
  the extra miles (the drive to pick it up, plus anything past the primary's
  delivery), in one box, stored as deadhead with no loaded miles. Every total
  that adds rows up — week, month, Tax tab, exports, per diem — is therefore
  already right and needed no change. Sebastian chose one number over two.
- **The database enforces it** (migration 017): own primary only, one level,
  at most two per primary (primary row locked while counting), no loaded
  miles, the primary's date — and it follows the primary's date. Deleting a
  primary deletes its partials; the confirmation names them.
- **Fuel and tolls on a partial are always estimated** from its extra miles,
  so a real trip fuel figure can never pay for the same road twice.
- **Screens:** the partial sits under its primary on the Loads list with a
  trip line beneath (`lib/partials` groups; totals never read from the
  grouping). Its figures are marginal — "+40 mi · adds +$770" — and are
  deliberately kept out of the ledger's Revenue / Cost / Profit columns. A
  primary's own page shows a live Trip panel and the Partials card with
  **+ Add Partial**.
- **Who sees it:** every Pro driver, from 3 Oct. It was tried first on one
  Owner (an allowlist, since removed); his one partial checked out clean
  against a read-only query — 600 extra miles that match the geography,
  nothing entered twice.
- **Not in this pass:** auto-filling miles from cities (needs a routing
  provider — PC\*Miler is what brokers pay on; an LLM must never be the
  source of a mileage figure), and turning an existing load into a partial.

## In-app alerts (Phase B) — what was decided, 6 Oct 2026

Sebastian wanted drivers to hear about likely mistakes in the app itself —
not by text — so they are caught where they can be fixed.

- **One set of checks, one wording, everywhere** (`lib/checks`): the load
  form as the driver types ("Worth a look before you save"), the Loads page
  ("N loads worth a look this week", with Open load and This is right), a
  "Worth a look" tag on the load in the list, and Admin. Checks are plain
  code — never AI deciding what is wrong with someone's books.
- **"This is right"** stores the alert's EXACT wording on the load
  (`loads.dismissed_checks`, migration 018, max 20). The wording carries the
  figure, so changing the miles or pay reopens the alert; a stale mark can
  never hide a new problem. Saving from the form keeps only marks that still
  match (the duplicate-load mark is kept, since the form cannot re-check it).
- Admin shows marked alerts as "Driver says right", not as problems.
- Not yet: alerts on the Calculator inputs for drivers (Admin only for now),
  a count on the Loads tab in the navigation, push or email alerts (needs
  the email provider decision).

## The monthly AI allowance (D0) — what was decided, 6 Oct 2026

Sebastian wants thick margins to run ads: AI must never eat a plan's profit,
and scanning (D1) will cost far more per use than a chat question.

- **One allowance, in dollars, per calendar month, for all AI** — Ask
  ProfitRig and scanning together. Numbers live in `lib/aiGuard.ts`
  (`AI_MONTHLY_BUDGET_USD`): Free $0.25 (a few questions, a taste of
  scanning), **Pro $4** ($9.99/mo), Pro yearly $3.30 ($99/yr is $8.25/mo),
  **Pro Plus $8** ($19.99/mo). About 40% of what a plan earns, at most.
- **A trial gets $1, not the plan's allowance.** Checkout asks no card for
  the 7-day trial, so every throwaway sign-up would otherwise be $4 of AI.
  Chosen while building; Sebastian can change it in one line.
- Drivers see a **percentage**, never dollars: Profile → "AI this month"
  (meter, resets date, upgrade link), a heads-up in the chat from 80%, and
  at 100% AI pauses until the 1st with **See plans** when a bigger
  allowance is for sale to them. A request starts only if it fits whole.
- **Admin sees dollars:** "AI mo." per driver (spend / allowance, plan on
  hover), an "AI this month" total, and the driver page's Account section.
- **Pro Plus** — $19.99/mo, monthly only, everything in Pro with twice the
  AI. The plan picker shows it only once `STRIPE_PRICE_PRO_PLUS` is set, so
  Sebastian decides when it goes on sale (chat alone will not get near $4;
  it earns its keep once scanning ships). Existing Pro subscribers switch on
  Stripe's own confirmation page (`subscription_update_confirm`), which
  shows the proration before anything changes; checkout refuses anyone
  already on a plan, so nobody can end up with two subscriptions.
- **Max** — a later, expensive plan with every feature automated. Not
  designed yet.

## Scanning (D1) — what was decided, 6 Oct 2026

- **A photo or PDF of a rate con or load ticket fills in a DRAFT load.** The
  driver checks it and taps Save; nothing is ever saved by the AI. New loads
  only, not partials (a partial records extra miles, which no document
  prints). Free has no Loads, so no scanning — a driver tries it on the trial.
- **Opus 5.5 at low effort**, structured JSON output, server-side
  `fallbacks: "default"`. Measured: about 2¢ and 3–7 seconds a photo, every
  field right on a made-up rate con, made-up scale tickets and Sebastian's
  real Freight Tec rate con — so Pro's $4 is roughly 150–200 scans a month.
- **PDFs are read page 1 first, page 2 only if needed, never further**
  (Sebastian's call). A real 7-page Freight Tec rate con cost 10¢ read whole
  — pages 2–7 are terms, scrambled text and e-signature receipts — and 2.5¢
  read as page 1 alone. Page 2 is read only when page 1 lacks the pay, a
  place or the date, or is a cover sheet (missing miles alone don't count);
  page 2 fills only page 1's gaps, and pay is taken whole from one page. A
  rate con with its pay on page 2 cost 3.7¢. Pages are cut with `pdf-lib`;
  a PDF that can't be cut (locked, damaged) is read whole, capped by the
  token limit. The whole PDF is still what is stored.
- **The AI copies what is printed and nothing else** (`lib/scan.ts`): never
  estimates, calculates or looks up a value; mileage only as printed. Any
  adding up is done in code: accessorial lines summed, a total that disagrees
  with its parts called out rather than picked, a total-only rate con entered
  as line haul with nothing added on top. Malformed or absurd values become
  empty fields. A ticket's tons × rate is NOT turned into pay.
- **Cost:** the file's tokens are counted first (free); the allowance check
  then holds that plus the format overhead and the full output ceiling at
  the dearest fallback model's prices, so a started scan always fits.
  Per day: trial 20, Pro 40, Pro Plus 80.
- **Originals are kept**, private (Storage bucket `scans`, no policies; the
  server hands the owner or admin a one-minute link), linked to the load
  when it is saved. Deleting a load keeps its scan.
- **Several tickets in one photo:** only the first is read, and the driver is
  told to scan each one. Turning one photo into several loads waits for
  Julio's real photos.
- **Still needed before real drivers:** Julio's ticket photos and 2–3 real
  rate cons, to check the reading on messy originals.

## Features asked for, not yet planned (3 Oct 2026)

In Sebastian's rough order of interest. Each needs a decision before it can
be planned.

- **Pay per hour.** Sebastian's own trucks are paid by the hour, and
  ProfitRig only knows "load pay minus the carrier's %" — it cannot tell his
  operation whether a week made money. Needs: what counts as an hour (ELD
  on-duty, clock hours…), whether waiting/detention is paid, anything on top
  (FSC, minimum per day), and whether a truck can switch between hourly and
  per-load. Store the pay basis per load, like `carrier_pct`, so a change
  never rewrites past weeks. Costs stay mile-based; monthly bills may need
  spreading over hours.
- **Snap and scan.** Photograph a BOL, rate con, fuel or expense receipt or a
  carrier settlement; the AI fills a DRAFT the driver confirms — never saves
  on its own. Keep the original image attached (IRS records, audit trail).
  Settlements are the big win for leased drivers: one scan, a week of loads,
  and the carrier % checked. Plus an email-in address. Rate cons and load
  tickets went first (D1, above); still to come: receipts, settlements,
  email-in (Postmark).
- **Invoicing.** Invoice from a load, PDF, email to the broker, paid/unpaid
  and days outstanding. Mainly for drivers with their own authority (leased
  drivers are paid by their carrier), and "send to my factor" may matter as
  much as "send to broker".
- Both of those need an **email service** (send and receive) — one choice,
  e.g. Postmark or Resend, serves both.
- **Auto-fill miles** from origin and destination via a routing provider
  (PC*Miler is what brokers pay on), with a **city picker** — free-typed
  "Halls ,tn" will not survive a lookup or an invoice. Never an LLM as the
  source of a mileage figure.
- Turning an existing load into a partial.
- The Loads-vs-Tax revenue difference (D4) still needs Sebastian's call.

## Still open

- **Login copy now overstates privacy.** The login card says "Your numbers
  stay private to you." Since 3 Oct, an admin can read every driver's
  entries (read-only, `/admin/users/[id]`) to help them. Sebastian to decide
  the wording — e.g. "Your numbers stay private — only you, and ProfitRig
  support when you ask for help, can see them" — and whether the privacy
  policy needs the same line.

- The design rollout is **complete**: every screen, signed in and signed
  out, is on the system. There is no Phase 6.
- The Phase 1 compatibility colour aliases (`--brand`, `--brand-dark`,
  `--brand-soft`, `text-muted`, `border-border`) are still used by about
  thirty files, including the shared components. Retiring them is its own
  task and needs approval; it is not a side effect of anything else.
- Admin shows AI spend per driver this month (D0); a per-request view of
  `ai_usage` is not built. Sebastian's own test chat and its usage rows are
  deliberately still in the database.
- Supabase "Confirm email" is still unverified. Do not enable it before
  sign-up has a "check your email" step and a callback route — today it has
  neither, so turning it on would break sign-up.

## Stack, commands, gotchas

- Next.js 16 (App Router, Turbopack) — **read `node_modules/next/dist/docs/`
  before using Next APIs.** React 19, Tailwind v4, Supabase, Stripe,
  Anthropic SDK, Vercel deploying `main` of `github.com/Sebabrzek/profitrig`.
- `npm test` = 380 checks in `tests/money.ts` (money math, CSV, calculator,
  nav, formatters, partials, alerts, the Ask ProfitRig guardrails, the
  monthly AI allowance and scanning).
- Migrations: `supabase-migration-NNN.sql` at the repo root, run by hand.
  Latest applied is **019** (6 Oct 2026); **020** is written, in review.
  They are checked offline in PGlite before Sebastian runs them.
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
