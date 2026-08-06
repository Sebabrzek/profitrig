# Competitive Report: ProfitGauges (Let's Truck) vs ProfitRig
*Prepared June 2026 — based on a hands-on walkthrough of a live ProfitGauges account*

## 1. What ProfitGauges is

ProfitGauges is the accounting module of Let's Truck's "Gauges" platform (Trucks / Fuel / Profit).
Pricing: **$19/mo** (current lock-in promo). Positioning: *"Track your income, expenses and
settlements in under 30 minutes a month."*

Their model in one sentence: **monthly-cadence bookkeeping for leased owner-operators, organized
around settlement statements and a once-a-month expense worksheet, with a Schedule C-shaped tax
report at the end of the year.**

### Product structure observed

| Area | What it does |
|---|---|
| **Profit → Overview** | Per-truck dashboard: Total Profit, Profit/Mile, Total Expenses, Cost/Mile, odometer-style Miles Driven. Year selector. |
| **Profit → Expenses** | Monthly worksheets. Each month starts with: odometer start/end (miles), nights away (driver AND spouse), personal-vehicle miles. Then category grid. |
| **Profit → Settlements** | Revenue entry = carrier settlement statements (date + carrier + gross + deductions). "The 2-minute settlement" — categories personalized per carrier. |
| **Business Report** | Month/quarter/year views. Revenue, Fixed Costs, Variable Costs — each as Total, Per-Mile, and % of Revenue. A teaching tool. |
| **Profit & Loss** | Clean Income/Expenses/Total statement "for banks" — financing-ready. |
| **Tax Report** | Company-level, literally structured as Schedule C Parts I–V: Income, Expenses by line, COGS (n/a), Personal Vehicle (standard mileage $0.725/mi), Other Expenses. Per-diem worksheet with DOT HOS meal deduction, driver days. Depreciation box. |
| **Fuel gauge** | Fuel-up logging → rolling 30/60/90-day MPG, avg $/mile, $/gallon, best/worst MPG. **IFTA report** (gallons by state, pick a date range). Maintenance checklist + modification tracking. Community benchmarking (compare trucks by spec). |
| **Trucks gauge** | Community truck registry — spec sharing, filter by tires/axle ratio, popular trucks. |
| **Categories** | User-customizable expense/settlement category lists. |
| **Cheat Sheet** | 3-page PDF: 18 expense categories with item-level guidance and tax notes (what's deductible, what isn't, receipt rules). |

### Their 18 expense categories (from the cheat sheet)
Accounting · Communication · Fees · Fuel · Insurance · Interest · Loading (lumpers) ·
Maintenance · Office · Physicals (DOT/drug tests) · Rent/Lease · Scales · Supplies ·
Tax/License · Tolls/Parking · Travel · Uniforms · Wages
Plus embedded tax guidance: citations/fines not deductible, personal medical not deductible,
estimated tax payments not deductible, lodging always needs receipts, <$75 travel expenses
don't, entertainment tests, spouse per-diem nights.

---

## 2. Honest scorecard: where they beat us today

| # | ProfitGauges advantage | Why it matters | Severity |
|---|---|---|---|
| 1 | **Settlement-based revenue entry** | Most leased owner-ops get paid via weekly carrier settlements, not per-load rate cons. Entering one settlement = 2 minutes; entering 8 loads = 15. Their model matches how leased drivers actually see money. | HIGH |
| 2 | **Odometer-based mileage** | OD start/end per month captures ALL miles (personal moves, bobtail, shop runs) with zero thinking. Our loaded+deadhead-per-load misses miles and depends on discipline. | HIGH |
| 3 | **Fuel-up tracking + real MPG** | They compute actual MPG from fuel-ups; we ask the driver to type an MPG guess. Their fuel number is measured; ours is assumed. | HIGH |
| 4 | **IFTA report** | Gallons-by-state for a date range. Required quarterly for every own-authority operator. We have nothing. | MEDIUM-HIGH |
| 5 | **Richer expense taxonomy + cheat sheet** | 18 categories with item-level "put this here" guidance vs our 14. Theirs teaches while it categorizes. | MEDIUM |
| 6 | **Per-diem: spouse nights + personal-vehicle mileage** | They capture spouse per-diem (legit if spouse is on the truck with a business function) and personal-vehicle business miles at the standard rate. We capture neither. | MEDIUM |
| 7 | **Financing-ready P&L** | Framed as "the report banks want" — owner-ops applying for truck loans need this. Our Tax Pack is CPA-oriented, not lender-oriented. | MEDIUM |
| 8 | **Depreciation schedule guidance** | "The correct depreciation schedule for tractor and trailer" surfaced to the accountant. We list assets but offer zero schedule context. | LOW-MEDIUM |
| 9 | **Maintenance tracking + quarterly checklist** | Modification/repair logging tied to the truck; prevention framing. | LOW |
| 10 | **Community benchmarking** | Compare your MPG/specs against similar trucks. Sticky, social, hard to copy quickly. | LOW |

## 3. Where ProfitRig is already better

| # | ProfitRig advantage | Notes |
|---|---|---|
| 1 | **Per-load profitability** | PG has NO per-load view at all. They can't tell a driver "this load loses money." Our live load form with rate-achieved vs cost flag is a genuine decision tool at the moment of booking. PG is backward-looking bookkeeping; we're forward-looking decision support. |
| 2 | **The free calculator funnel** | PG has no free tier — $19/mo from day one. Our free Rate-Per-Mile calculator is a cold-traffic acquisition machine they can't match. |
| 3 | **Cost-per-mile target setting** | PG reports what CPM *was*; we compute what it *should be* and what rate to demand, then close the loop with actuals (Phase 0 insight card). Nothing like that exists in PG. |
| 4 | **Management vs tax lens separation** | Our two-lens architecture (estimates for decisions, actuals for the accountant) is cleaner than their single-ledger approach, which mixes cheat-sheet tax guidance into daily bookkeeping. |
| 5 | **Modern mobile UX** | PG is a ~2012-era desktop web app: tiny fonts, no mobile nav, odometer skeuomorphism. We are mobile-first with bottom tabs, thumb-sized inputs, PWA install. Drivers live on phones. |
| 6 | **MTD-based fixed-cost allocation** | Our per-load fixed-cost share by actual month miles is more honest than their monthly-bucket averages for load decisions. |
| 7 | **Price** | $9.99/mo or $99/yr vs their $19/mo ($228/yr). We're less than half. |
| 8 | **Deadhead awareness** | Explicit deadhead capture, DH% on every load and week, double-count guard. PG's odometer approach can't split loaded vs empty. |

## 4. The strategic read

ProfitGauges' core insight — steal it: **"under 30 minutes a month."** Their whole product
minimizes bookkeeping effort with a monthly cadence, and revenue entry that mirrors the actual
paperwork a leased driver receives (settlements). They cut everything that doesn't matter.

ProfitGauges' core weakness — attack it: **no per-load intelligence, no free tier, dated UX,
double the price.** They tell you how last month went; they cannot help you decide whether to
take the load in front of you.

ProfitRig's winning position: **"Know before you haul, organized when you file."**
Decision tool first (free calculator → per-load profit), bookkeeping second (Tax Pack),
both faster and cheaper than PG on a phone.

---

## 5. Roadmap to "best simple accounting for owner-operators"

### Tier 1 — Close the gaps that lose us head-to-head deals (next 4–6 weeks)

**1a. Settlement entry mode (HIGH)**
Add a "Settlement" record: date, carrier, gross pay, itemized deductions (fuel advances,
insurance, ELD, escrow, etc. — user-customizable lines like PG). Let a settlement optionally
link to that week's loads for reconciliation ("settlement gross $6,240 vs loads booked $6,390 —
$150 unexplained"). Leased drivers can then live in settlements; own-authority drivers in loads.
*This is the single biggest conversion blocker for leased drivers coming from PG.*

**1b. Fuel-up logging with computed MPG (HIGH)**
Odometer + gallons + price per fill-up. Compute rolling MPG and auto-feed it into the
calculator's MPG field ("Your last 90 days: 6.8 MPG — use it?" one-tap, mirroring our
real-CPM insight pattern). Kills their "measured vs guessed" advantage and makes our
fuel-cost estimates self-correcting. Also the prerequisite for IFTA.

**1c. Monthly odometer checkpoint (MEDIUM-HIGH)**
First of each month, ask one question: "Odometer reading?" Diff vs last month = total actual
miles. Show "you logged 8,900 mi of loads but drove 9,600 — 700 untracked" — which also
strengthens our MTD fixed-cost allocation with true totals.

**1d. Expense category upgrade (MEDIUM)**
Add the missing categories: Communication/Phone (split from misc), Fees (ATM/Comcheck/broker),
Physicals/DOT-medical (exists), Uniforms/PPE, Supplies, Travel/Lodging, Interest (rename
truck-loan-interest to cover CC/business-loan interest), Rent/Lease (exists), Scales (fold into
Tolls or separate). Port the cheat-sheet idea: expandable "what goes here" list under each
category with the same do/don't tax notes. Our hint system already supports this — it's content
work, not architecture.

### Tier 2 — Extend the win (6–12 weeks)

**2a. IFTA quarterly report (own-authority segment)**
Needs per-state miles. Simplest viable version: on each load, optional multi-state mileage
split (or integrate a mileage API later); fuel-ups already carry state. Output: gallons
purchased + miles per state for a date range, CSV. PG has this; own-authority drivers file it
quarterly and hate it.

**2b. Per-diem completeness**
Add spouse nights (with the eligibility caveat text) and personal-vehicle business miles at the
standard mileage rate (rate as config with effective dates, like per-diem rates — it changes
annually; currently $0.725). Both flow into the Tax Pack as separate informational lines.

**2c. Lender-ready P&L**
One-click monthly/quarterly/annual P&L (income, expenses by category, net) formatted for a
bank. Same actuals source as the Tax Pack, different framing. "Applying for truck financing?
Print this." PG explicitly markets this; it's cheap for us to add on top of the Tax Pack data.

**2d. Business Report (the teaching view)**
Monthly view showing revenue, fixed, variable — each as total, per-mile, and % of revenue,
with 3-month PPM trend. We have all the data; it's a presentation layer. This is PG's
"what you'll learn" pitch — drivers love feeling smarter each month.

### Tier 3 — Moats they can't quickly copy (3–6 months)

**3a. Close-the-loop intelligence (extend Phase 0)**
"Your real CPM is $1.62 vs your $1.45 estimate — fuel is the whole gap. Update?" Then push into
load decisions: "At your real numbers, this load nets $107. Pass unless deadhead < 40 mi."
PG cannot do any of this without a per-load model — this is our structural advantage.

**3b. Broker/lane memory**
After N loads: profit by broker, by lane, by weekday. "CH Robinson loads averaged $0.31/mi
net less than TQL this quarter." Nobody in the simple-tools segment has this.

**3c. Receipt photo capture**
Snap a receipt → attach to an expense (amount/date entered by hand at first, OCR later).
Ends the shoebox. PG has nothing here; mobile-first makes it natural for us.

**3d. Year-round tax readiness score**
"Tax Pack 78% ready — missing: Q3 fuel actuals on 12 loads, no insurance expenses since July."
Turns year-end panic into a monthly nudge, and gives Pro a reason to be opened weekly.

### Explicitly do NOT copy

- **Community truck registry / spec benchmarking** — big build, low accounting value; their
  community exists because of the Kevin Rutherford audience, not the feature.
- **Single-ledger design** — mixing tax guidance into daily entry is exactly the confusion our
  two-lens architecture avoids.
- **Desktop-first layout** — their biggest liability; don't inherit it.
- **Monthly-only cadence as the ONLY mode** — keep per-load as the primary lens (it's our
  moat); add monthly conveniences (odometer checkpoint, settlements) on top.

---

## 6. Positioning one-liners (for the landing page, against PG)

- "ProfitGauges tells you how last month went. ProfitRig tells you whether to take the load."
- "Half the price. Built for your phone. Free to start."
- "Per-load profit — something a settlement summary can never show you."

## 7. Suggested sequence

1. **1b Fuel-ups** (unlocks measured MPG + is the IFTA prerequisite)
2. **1a Settlements** (biggest leased-driver conversion blocker)
3. **1d Categories + cheat-sheet content** (fast, content-heavy, low-risk)
4. **1c Odometer checkpoint** (small)
5. **2d Business Report** (presentation layer on existing data)
6. **2c Lender P&L** (small delta from Tax Pack)
7. **2b Per-diem completeness** (small)
8. **2a IFTA** (needs per-state data model — schedule after fuel-ups bed in)
9. Tier 3 items as ongoing differentiation
