# PROFITRIG — PRODUCT DESIGN SYSTEM v1.0

## Claude Code implementation preamble

> **Read `PROFITRIG_DESIGN_SYSTEM.md` completely before modifying any frontend code. Treat it as the authoritative visual and UX specification. First audit the existing application against the system. Do not begin a wholesale redesign immediately. Identify shared components, global styles, typography, color tokens, layout primitives and duplicated CSS. Propose an implementation sequence that preserves all existing business logic and financial calculations. Once approved, implement the system globally through reusable components and tokens rather than page-by-page hacks. Do not invent design choices where the design system already provides an answer.**

Claude's job is implementation. Do not invent design choices where this system already provides an answer.

## Phase 4A identity approval — 21 September 2026

The user approved the primary horizontal and compact previews. Production wordmark and lockup files now reside in `assets/logos/wordmark/` and `assets/logos/lockup/`. Their custom path geometry is the approved Phase 4A execution of Option 01, not a recovered historical source. The existing charging-bison SVG remains unchanged. Refer to `assets/logos/references/IDENTITY_REFERENCE.md` and the identity proof sheet. This approval supersedes the historical pending-vectorization statements below; it does not approve the earlier rejected Montserrat reconstruction or authorize frontend implementation.

## Approved typography — mandatory correction

Do not choose, substitute, or reinterpret fonts.

- **PROFITRIG wordmark:** Approved **Option 01** — wide, heavy geometric wordmark based initially on Montserrat ExtraBold/Black, eventually supplied as a custom vector asset. Do not recreate or replace the official wordmark with another font. The Montserrat origin describes its history; it is not permission to typeset or reconstruct it from Montserrat.
- **Product headings/UI: Satoshi.** Use for headings, navigation, buttons, card titles, and short UI emphasis.
- **Body copy: Inter.** Use for paragraphs, descriptions, helper text, forms, and longer reading.
- **Financial KPIs/data: JetBrains Mono.** Use selectively for important financial values such as `$1.96`, `$2.46 / mi`, `+$5,420`, `-$842`, `7.2 MPG`, and percentages.

**Authoritative wordmark reference:** `assets/logos/references/APPROVED-OPTION-01-REFERENCE.png`, **Option 01 in the upper-left panel**. Other options on that sheet are not approved alternatives. Preserve the approved tagline: **KNOW YOUR NUMBERS. TAKE CONTROL.**

The previously generated Montserrat-based `profitrig-wordmark*` and `profitrig-lockup-*` SVG/PNG files are **superseded drafts, not official assets**. Their wordmark appears in the archived logo and component boards; those wordmarks are not approved references. The active component board omits the rejected wordmark. The approved Phase 4A production wordmark is now available; do not substitute another font.

This correction takes precedence over conflicting examples or historical asset-status statements elsewhere in this document or the handoff files.

## Purpose

This document is the visual and UX source of truth for the ProfitRig application.

**Do not reinterpret, modernize, simplify, or redesign this system unless explicitly instructed.**

ProfitRig's design concept is:

> **AMERICAN IRON × FINANCIAL PRECISION**

ProfitRig is financial software built specifically for owner-operators and small trucking businesses.

The product should feel:

**Strong. Precise. Independent. Controlled. Profitable.**

It must NOT feel like:

- generic green fintech
- generic SaaS
- a trucking-company website
- a diesel repair website
- a playful consumer app
- a crypto/trading platform
- a futuristic automotive interface

The interface is modern financial instrumentation.

The broader brand brings the personality of classic American trucking.

---

# 1. BRAND IDENTITY

## Primary brand mark

Use the approved **charging bison**.

The bison communicates strength, independence, momentum, resilience and control.

Never redraw or approximate the bison in CSS.

Always use the official SVG asset once supplied.

Do not:

- add gradients
- add drop shadows
- round the geometry
- animate individual pieces
- add outlines
- add truck imagery inside it
- texture the official logo
- alter proportions

Brand illustrations may contain stylized/engraved bison imagery, but the official logo remains clean.

## Wordmark

Use the approved custom **PROFITRIG** wordmark asset.

Visual construction:

**PROFIT** = Rig Green  
**RIG** = Sage Green

Do NOT reproduce the wordmark by typing `PROFITRIG` in any font. Use the official Option 01 custom vector asset when supplied; its absence does not authorize a substitute.

## Primary tagline

> **KNOW YOUR NUMBERS. TAKE CONTROL.**

---

# 2. COLOR TOKENS

Use semantic variables. Do not scatter arbitrary hex values throughout components.

```css
:root {
  /* =========================================
     PROFITRIG BRAND
     ========================================= */

  --pr-rig-green: #173C2B;
  --pr-profit-green: #16A34A;
  --pr-sage: #8FAE91;
  --pr-off-white: #F6F7F4;
  --pr-charcoal: #1F2937;
  --pr-white: #FFFFFF;

  /* =========================================
     FINANCIAL STATES
     ========================================= */

  --pr-loss: #B85C57;
  --pr-loss-deep: #943F3B;
  --pr-loss-wash: #F2DEDA;

  /* =========================================
     SURFACES
     ========================================= */

  --pr-bg: #F6F7F4;
  --pr-surface: #FFFFFF;
  --pr-surface-dark: #173C2B;
  --pr-text: #1F2937;
  --pr-text-dark-surface: #FFFFFF;
  --pr-text-muted: #667085;

  /* =========================================
     BORDERS
     ========================================= */

  --pr-border: rgba(31, 41, 55, 0.12);
  --pr-border-dark: rgba(255, 255, 255, 0.12);

  /* =========================================
     SEMANTIC
     ========================================= */

  --pr-positive: #16A34A;
  --pr-negative: #B85C57;
  --pr-negative-strong: #943F3B;
}
```

## Color meaning is mandatory

Colors carry semantic meaning.

### Rig Green

Represents **ProfitRig itself**.

Use for:

- branding
- dark dashboards
- primary navigation
- major surfaces
- headings
- selected structural UI

### Profit Green

Represents:

**profit / growth / positive financial performance / primary action**

Examples:

`+$5,420`

`+18%`

primary CTA

positive chart series

Do not use Profit Green simply because a page needs more color.

### Sage

Represents:

**secondary brand information / neutral supportive information**

Use sparingly.

### Loss Red

Represents:

**loss / negative financial movement / financial warning**

Examples:

`-$842`

`↑ 12% COST`

`LOSS`

Use the pale Loss Wash for warning backgrounds.

### Accessibility rule

Never communicate financial state using color alone.

Use combinations such as:

```text
↑ PROFIT +$5,420
↓ LOSS -$842
```

---

# 3. TYPOGRAPHY

## Primary UI font

**Satoshi**

Use for:

- navigation
- headings
- buttons
- card titles
- UI controls
- short prominent statements

Preferred weights:

`500 / 700 / 900`

## Body font

**Inter**

Use for:

- paragraphs
- descriptions
- helper text
- forms
- longer explanations
- tables

Preferred weights:

`400 / 500 / 600`

## Financial/data font

**JetBrains Mono**

Use selectively for:

- currency
- CPM
- RPM
- MPG
- percentages
- dashboard KPIs
- important totals

Example:

```text
TRUE COST / MI

$1.96
```

`TRUE COST / MI` → Satoshi (short UI/KPI label)

`$1.96` → JetBrains Mono

Do NOT use JetBrains Mono for normal body text.

---

# 4. TYPE SCALE

Desktop starting values:

```css
--pr-text-xs: 12px;
--pr-text-sm: 14px;
--pr-text-base: 16px;
--pr-text-lg: 18px;
--pr-text-xl: 24px;
--pr-text-2xl: 32px;
--pr-text-3xl: 40px;

--pr-kpi-md: 32px;
--pr-kpi-lg: 48px;
--pr-kpi-xl: 64px;
```

Marketing hero headings may reach `56–72px`.

Product pages should generally remain below that.

Financial numbers should often be significantly larger than their labels.

---

# 5. SPACING SYSTEM

Use an 8px-derived system.

```css
--pr-space-1: 4px;
--pr-space-2: 8px;
--pr-space-3: 12px;
--pr-space-4: 16px;
--pr-space-5: 20px;
--pr-space-6: 24px;
--pr-space-8: 32px;
--pr-space-10: 40px;
--pr-space-12: 48px;
--pr-space-16: 64px;
--pr-space-24: 96px;
```

Do not invent random values such as `17px`, `27px`, `37px` without a functional reason.

---

# 6. CORNER RADII

ProfitRig is strong and somewhat angular.

Avoid excessively soft/bubbly UI.

```css
--pr-radius-sm: 6px;
--pr-radius-input: 10px;
--pr-radius-button: 10px;
--pr-radius-card: 14px;
--pr-radius-large: 18px;
--pr-radius-pill: 999px;
```

Pills should primarily be used for **status indicators**, not every button.

---

# 7. SHADOWS

Use shadows sparingly.

ProfitRig should achieve hierarchy primarily through:

- surface color
- borders
- typography
- spacing

rather than floating-card shadows.

Suggested:

```css
--pr-shadow-card:
  0 1px 2px rgba(0,0,0,.04),
  0 4px 12px rgba(0,0,0,.05);
```

Never use giant soft SaaS shadows.

---

# 8. PRODUCT SURFACE MODEL

This is a major ProfitRig design principle.

## DARK = INTELLIGENCE / RESULTS

Dark Rig Green surfaces should contain:

- major financial summaries
- KPIs
- dashboard intelligence
- analytics
- important calculated results

## LIGHT = WORK / INPUT

Off White and White surfaces should contain:

- forms
- cost entry
- settings
- profile
- editing
- configuration
- tables

This creates a consistent visual rhythm:

> **ENTER DATA → LIGHT**

> **UNDERSTAND DATA → DARK**

---

# 9. KPI COMPONENTS

Financial KPIs are among the most important visual elements in ProfitRig.

Every KPI should establish:

1. What is being measured?
2. What is the number?
3. Is it good or bad?
4. What changed?

Example:

```text
TRUE COST / MI

$1.96

↓ $0.08 FROM LAST MONTH
```

Hierarchy:

**Label:** small  
**Number:** enormous  
**Trend:** secondary

Do not create dashboard cards where the title, number and description all have similar visual weight.

### Positive KPI

Use Profit Green.

### Negative KPI

Use Loss Red.

### Neutral KPI

Use Charcoal/White depending on surface.

---

# 10. CARDS

Default:

```css
.pr-card {
  background: var(--pr-surface);
  border: 1px solid var(--pr-border);
  border-radius: var(--pr-radius-card);
  padding: var(--pr-space-6);
}
```

Cards should organize information, not decorate the screen.

Avoid nesting cards inside cards unless hierarchy requires it.

---

# 11. INPUTS

Inputs must feel practical and substantial.

Minimum height:

**44px**

Preferred desktop:

**48–52px**

Always show persistent labels.

Good:

```text
TRUCK PAYMENT

$ 1,500
```

Bad:

```text
[ Enter truck payment... ]
```

Do not depend on placeholder text as the label.

Numeric financial fields should trigger appropriate numeric keyboards on mobile where possible.

---

# 12. BUTTONS

## Primary

Profit Green background.

White text.

Used for the primary action on a screen.

Examples:

**Update Costs**

**Save Load**

**Add Expense**

## Secondary

White/off-white background with visible border.

## Dark

Rig Green background.

Use where stronger structural action is appropriate.

## Destructive

Loss Red.

Only for genuinely destructive actions.

Do not make multiple competing buttons Profit Green.

A screen should usually have **one obvious primary action**.

---

# 13. STATUS CHIPS

Allowed examples:

**PROFITABLE**

**LOSS**

**BELOW TARGET**

**ABOVE TARGET**

**PAID**

**DUE**

**OVER BUDGET**

Use pill geometry.

Status chips may use lighter semantic backgrounds.

---

# 14. NAVIGATION

Desktop may use:

- sidebar navigation for application dashboards
- top navigation where appropriate

Mobile should prioritize bottom navigation for frequent destinations.

Recommended core mobile destinations:

**Dashboard**

**Loads**

**Calculator**

**Reports**

**More**

Avoid stuffing every feature into bottom navigation.

Touch targets must be at least approximately **44 × 44px**.

---

# 15. ICONOGRAPHY

Icons must be:

- simple
- geometric
- immediately readable
- consistent in stroke/weight
- functional

Avoid:

- cartoon icons
- detailed truck illustrations as icons
- random icon libraries mixed together
- excessive filled/outline mixing

Truck imagery belongs primarily in the brand illustration system, not everywhere in the interface.

---

# 16. CHARTS

Charts are financial tools, not decoration.

Primary series:

**Profit Green**

Secondary:

**Sage**

Negative:

**Loss Red**

Gridlines should be subtle.

Never use rainbow charts unless categories genuinely require differentiation.

When possible, label important values directly.

Do not force users to interpret a legend unnecessarily.

---

# 17. MOBILE-FIRST BEHAVIOR

ProfitRig users may operate the product from a truck, terminal, shop or road environment.

Mobile is a first-class interface.

Requirements:

- minimum ~44px touch targets
- major KPI above fold
- large financial numbers
- readable without zooming
- numeric keyboards for financial entry
- avoid cramped two-column forms
- important actions accessible with thumb
- persistent bottom navigation where useful
- tables must adapt intelligently rather than simply overflow

Do not create desktop layouts first and blindly shrink them.

---

# 18. MOTION

Motion should feel:

**mechanical / controlled / precise**

Allowed:

- subtle number count-up
- short fades
- chart reveals
- restrained panel transitions
- immediate button feedback

Avoid:

- bouncing
- confetti
- playful springs
- excessive parallax
- unnecessary loading animations

ProfitRig is a serious financial tool.

---

# 19. BRAND ILLUSTRATION SYSTEM

Illustration and application UI serve different roles.

The **UI stays clean.**

Illustration carries brand personality.

Official style:

> **Mid-century American commercial trucking illustration × vintage comic printing × U.S. currency engraving × modern editorial composition**

Reference the approved ProfitRig trucking artwork.

### Illustration characteristics

Use:

- engraved line work
- crosshatching
- halftone printing
- limited color
- warm paper texture
- dramatic perspective
- strong dark shadows
- subtle print imperfections
- American road environments

Never make the art look like generic vector stock illustration.

---

# 20. TRUCK ART DIRECTION

Two iconic American long-nose truck archetypes establish the visual language:

**Kenworth W900-inspired**

and

**Peterbilt 379-inspired**

Do not require manufacturer branding in marketing artwork.

Trucks should usually look like **proud owner-operator customs**, not factory fleet trucks.

Characteristics:

- lowered/custom stance
- long wheelbase
- tall stacks
- polished tanks
- large chrome bumper
- visor
- custom marker lights
- aggressive but tasteful appearance
- clean proportions
- heavy presence

Preferred camera angle:

### LOW FRONT ¾

This is the signature ProfitRig truck angle.

Also permitted:

- straight front
- low side profile
- rear ¾
- highway tracking
- high establishing view

Avoid obvious AI/mechanical errors:

- duplicate exhaust stacks
- impossible axles
- malformed wheels
- duplicated mirrors
- broken grille geometry
- impossible trailer connections
- random manufacturer badges
- mismatched perspective

Truck anatomy must be visually inspected before artwork is approved.

---

# 21. ILLUSTRATION COLOR RULES

Use approximately **2–4 dominant colors** per illustration.

Core:

Rig Green  
Off White  
Sage  
Charcoal

Optional accents:

Profit Green  
Loss Red

Loss Red may be used decoratively **inside marketing illustrations**, because those illustrations use a controlled vintage-print palette.

Within the **product UI**, however, Loss Red remains semantic.

---

# 22. CURRENCY TEXTURE

Currency engraving is a signature ProfitRig visual device.

Use:

- guilloché-inspired curves
- fine engraved line shading
- crosshatched shadows
- banknote-like ornamental line structures

Do not copy identifiable currency artwork or reproduce complete banknotes.

The goal is to evoke **money printing**, not reproduce money.

---

# 23. BISON IN BRAND ART

The clean charging bison is the official mark.

Brand artwork may additionally use a huge **ghosted engraved bison** integrated into:

- sky
- clouds
- mountains
- background texture
- poster composition

This is a signature ProfitRig device.

Do not let the ghost bison overpower the truck/headline.

---

# 24. COPY STYLE

ProfitRig copy is concise and confident.

Prefer:

> **KNOW YOUR COST.**

> **SET BETTER RATES.**

> **KEEP MORE OF WHAT YOU EARN.**

> **RUN YOUR TRUCK LIKE A BUSINESS.**

> **REAL NUMBERS. BETTER DECISIONS.**

> **FREEDOM RUNS DEEP.**

Avoid corporate language such as:

> Leverage comprehensive analytics to optimize operational financial performance.

Write for a business owner, not an MBA presentation.

---

# 25. UX RULE: SHOW THE NUMBER FIRST

Whenever a page answers a financial question, surface the answer before explanation.

Instead of:

> Based on the information you provided, your estimated true cost per mile is...

Use:

# $1.96 / MI

Then explain it.

ProfitRig exists to make complicated business numbers **obvious**.

---

# 26. DO NOT

Claude must NOT independently introduce:

- new brand colors
- blue fintech colors
- purple gradients
- neon green
- glassmorphism
- excessive gradients
- giant shadows
- cartoon trucks
- random illustrations
- arbitrary fonts
- random radii
- excessive pills
- decorative dashboards
- gauges resembling automotive speedometers unless functionally justified
- chrome textures inside the actual application UI
- dollar-bill texture behind financial data
- vintage texture on forms
- distressed typography inside the product

The **marketing brand can be rugged.**

The **financial product must remain precise.**

---

# 27. COMPONENT ARCHITECTURE

When implementing or refactoring ProfitRig, create reusable primitives instead of page-specific styling.

Prefer components such as:

```text
PRButton
PRInput
PRCard
PRKPI
PRStatusChip
PRAlert
PRMoney
PRPercent
PRTrend
PRChart
PRPageHeader
PRSection
PRNav
PRBottomNav
PRModal
PRTable
```

Naming can adapt to the existing framework, but the architecture should remain reusable.

Do not duplicate styling across pages.

---

# 28. FINANCIAL FORMATTING

Financial display must be consistent.

Currency:

`$1,500`

Cents when meaningful:

`$1.96`

Profit:

`+$5,420`

Loss:

`-$842`

Rate:

`$2.46 / mi`

Fuel:

`$3.72 / gal`

Efficiency:

`7.2 MPG`

Percentage:

`+18%`

Use thousands separators.

Do not show meaningless `.00` everywhere.

---

# 29. REFACTORING RULES FOR EXISTING PROFITRIG

When applying this system to the current application:

**DO NOT change business logic simply to redesign the UI.**

Preserve:

- calculations
- database behavior
- authentication
- routes
- user data
- permissions
- API behavior
- validation
- existing working functionality

Separate visual refactoring from functional refactoring.

Before changing a major component:

1. identify its current behavior
2. preserve behavior
3. replace visual implementation
4. verify calculations
5. verify mobile behavior
6. verify loading/error/empty states

Financial correctness is more important than visual polish.

---

# 30. CLAUDE'S DECISION RULE

When the design system does not explicitly cover a situation, choose the solution that best satisfies:

> **AMERICAN IRON × FINANCIAL PRECISION**

But inside the application itself, favor **financial precision**.

If a design decision is primarily decorative, question whether it belongs.

---

---

# APPROVED BRAND DETAILS AND IMPLEMENTATION HANDOFF

The following details preserve approved decisions from the preceding brand-system specification and the implementation handoff. The exact `--pr-*` tokens in Sections 2–7 are the implementation tokens; the earlier approximate sizing guidance below provides context.

## A. APPROVED LOGO CONSTRUCTION AND LOCKUPS

### Primary mark — Charging Bison

The approved charging bison is the official ProfitRig symbol.

It represents:

**Forward momentum** — charging posture  
**Control** — deliberate, powerful movement  
**Resilience** — built to survive difficult conditions  
**America** — unmistakably North American  
**Independence** — owner-operator mentality  
**Strength** — visual relationship to heavy equipment

The bison should eventually become recognizable independently of the PROFITRIG name.

### Critical rule

**Do not redesign, decorate or texture the official bison.**

The illustration system can contain enormous engraved bison graphics, distressed bison artwork, ghosted bison imagery, etc.

The **logo itself remains clean geometric artwork.**

### Primary lockup

```text
     [ CHARGING BISON ]

     PROFITRIG
KNOW YOUR NUMBERS. TAKE CONTROL.
```

Horizontal lockup:

```text
[BISON]  PROFITRIG
         KNOW YOUR NUMBERS. TAKE CONTROL.
```

### Wordmark

Selected direction: **Option 01**

Wide, heavy, geometric sans-serif construction based initially around **Montserrat ExtraBold/Black**, but the final logo should be converted into custom vector outlines.

**PROFIT** — Rig Green  
**RIG** — Sage Green

The wordmark must not be generated in the UI by typing PROFITRIG in Montserrat or another font. Use the official Option 01 vector asset; do not reconstruct it from its historical font basis.

### Logo colors

On light:

**Bison:** Rig Green  
**PROFIT:** Rig Green  
**RIG:** Sage

On Rig Green:

**Bison:** Off White  
**PROFIT:** Off White  
**RIG:** Sage

One-color applications:

All Rig Green, all white, or all black.

---

## B. ADDITIONAL TYPOGRAPHIC HIERARCHY

Approximate desktop targets:

| Element | Typeface | Size |
|---|---|---:|
| Marketing Hero | Satoshi Black | 56–72 |
| Page Title | Satoshi Bold | 32–40 |
| Section Title | Satoshi Bold | 22–28 |
| Card Title | Satoshi Bold | 16–18 |
| Body | Inter Regular | 15–17 |
| Label | Inter Medium | 12–14 |
| Hero KPI | JetBrains Mono Bold | 48–64 |
| Secondary KPI | JetBrains Mono SemiBold | 20–30 |
| Small Data | JetBrains Mono Medium | 13–16 |

Don't make everything uppercase.

Uppercase belongs primarily to short instrumentation labels:

**TRUE COST / MI**

**TARGET RATE**

**PROJECTED PROFIT**

**BREAK EVEN**

---

## C. ILLUSTRATION CONSTRUCTION

This needs to be repeatable.

Every ProfitRig illustration starts with a **clean underlying composition**.

Then apply these layers:

### Layer 1 — Base illustration

Bold simplified shapes.

### Layer 2 — Engraved shading

Parallel curved lines similar to currency engraving.

Use line direction to describe the object's volume.

### Layer 3 — Crosshatching

Used primarily for deep shadows.

Do not crosshatch everything.

### Layer 4 — Halftone

Dots used for:

sky  
midtones  
smoke/clouds  
background transitions

### Layer 5 — Paper

Warm Off White base.

Very subtle fiber/grain.

### Layer 6 — Print imperfection

Very restrained:

ink breakup  
slight edge wear  
occasional registration imperfection

It should look **printed**, not dirty.

---

## D. ILLUSTRATION COMPOSITION AND PHOTOGRAPHY

ProfitRig artwork should favor dramatic angles.

Especially:

**Low ¾ front truck view**

This makes the truck appear:

powerful  
heavy  
forward-moving

Use roads and landscape lines to direct the eye toward the truck or headline.

Avoid centered stock-photo composition.

Artwork should feel like a **poster**.

---

## Photography

Photography isn't prohibited.

But it becomes secondary.

Use photography for:

real customers  
testimonials  
team  
educational content  
actual equipment  
documentary storytelling

Use **illustration for brand storytelling.**

This prevents generic truck-at-sunset imagery from defining ProfitRig.

---

## E. APPROVED BRAND COPY

ProfitRig copy should be short.

Not:

> Utilize our comprehensive financial analytics platform to optimize your trucking operation.

Instead:

> **KNOW YOUR COST.**

> **SET BETTER RATES.**

> **KEEP MORE OF WHAT YOU EARN.**

Other approved brand territory:

**REAL NUMBERS. REAL FREEDOM.**

**FREEDOM RUNS DEEP.**

**RUN YOUR TRUCK LIKE A BUSINESS.**

**EVERY MILE COUNTS.**

**A MORE PROFITABLE NEXT MILE.**

**REAL NUMBERS. BETTER DECISIONS.**

Primary remains:

**KNOW YOUR NUMBERS. TAKE CONTROL.**

---

## F. RESPONSIVE SPACING AND ACCESSIBILITY

## Spacing

Use an **8px base system**.

Common values:

`4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96`

Default card padding:

**24px desktop**

**16–20px mobile**

Large sections:

**64–96px desktop**

**40–64px mobile**

Consistency here will make Claude's output dramatically better.

---

## Mobile

ProfitRig is being built for people who live on the road.

Mobile cannot be the desktop design squeezed smaller.

Priorities:

**Large touch targets**

Minimum around **44px**

Important financial values above the fold.

Bottom navigation for major product areas.

Forms optimized for numeric entry.

Avoid side-by-side financial fields when the phone becomes cramped.

Important actions should remain reachable with one hand.

---

## Accessibility

Minimum text contrast should meet **WCAG AA**.

Do not communicate:

profit = green only  
loss = red only

Use:

color + sign + icon + text.

Example:

**↓ LOSS -$842**

not simply a red `$842`.

Animations should respect reduced-motion preferences.

Inputs require actual labels.

---

## G. TRUCK REFERENCE AND MANUFACTURER BADGES

The approved original custom W900/379 poster is the visual benchmark. Preserve the low, custom owner-operator appearance of the originals. Later variations that look like vector stock art or contain mechanical errors are not a replacement benchmark.

Remove Kenworth and Peterbilt logos from the sides of the trucks. Logos on the front hood may remain.

Future illustration variations may include trucks side by side, a single truck, and different angles. Every variation must follow the same approved style and pass the truck-anatomy inspection in Section 20.

## H. INITIAL CLAUDE CODE AUDIT — BEFORE IMPLEMENTATION

> Read `brand/PROFITRIG_DESIGN_SYSTEM.md` completely. This is the authoritative visual and UX specification for ProfitRig. Do not modify any code yet.
>
> Audit the existing frontend against this design system. Identify:
> 1. frontend framework and styling architecture,
> 2. global CSS/theme files,
> 3. existing fonts,
> 4. reusable components,
> 5. duplicated styling,
> 6. current color variables,
> 7. navigation architecture,
> 8. responsive/mobile architecture,
> 9. every major page that will need visual migration,
> 10. anything that could cause business logic or financial calculations to be affected by a UI refactor.
>
> Then propose a phased implementation plan.
>
> **Do not implement anything yet. Do not alter calculations, authentication, database logic, routes, APIs or working functionality.**

Review and approve the audit and phased plan before implementation. Start with the application shell and reusable components, then migrate individual product pages. The anticipated sequence is fonts → design tokens → global surfaces → shared components → navigation. Build the landing/sign-in experience after the core product is consistent.

## I. BRAND FOLDER AND ASSET HANDOFF

Current identity package: `docs/design/assets/logos/mark/`, `wordmark/`, `lockup/`, and `references/`. Existing bison assets are preserved in `mark/`. The production wordmark and dependent lockups now use the user-approved Phase 4A geometry; see `references/IDENTITY_REFERENCE.md`. The tree below is the original proposed handoff layout, not the current identity-folder structure.

Recommended repository structure:

```text
/brand
│
├── PROFITRIG_DESIGN_SYSTEM.md
│
├── /logos
│   ├── profitrig-bison.svg
│   ├── profitrig-wordmark.svg
│   ├── profitrig-lockup-horizontal.svg
│   └── profitrig-mark-white.svg
│
├── /references
│   └── profitrig-design-system-board.png
│
└── /illustrations
    ├── profitrig-american-iron-01.png
    └── profitrig-truck-angle-reference.png
```

The official SVG logo assets were still unfinished at the time of the handoff. These paths define the intended asset package; this Markdown file does not supply or recreate the artwork.

Package the approved design-system board, original approved trucking illustration, bison mark, and Option 01 wordmark reference alongside this document. Use those approved references as the visual target. Preserve the official mark as clean vector artwork.

## J. THE PROFITRIG DESIGN TEST

> **Could this belong to another fintech company if we changed the logo?**

If yes, it isn't branded enough.

> **Does this look like a trucking company instead of a financial technology product?**

If yes, we've gone too far the other direction.

> **AMERICAN IRON × FINANCIAL PRECISION**

