# ProfitRig logo and component assets

Created 17 September 2026 from Product Design System v1.0. These are newly constructed deliverables, not recovered source artwork from the earlier conversation.

## Superseded wordmark — do not implement

The generated Montserrat-based wordmark and every lockup containing it are superseded drafts. The user supplied `assets/logos/references/APPROVED-OPTION-01-REFERENCE.png`: use **Option 01, upper-left panel**, as the authoritative visual reference. Do not typeset, substitute, or reconstruct the official wordmark from another font. A correct official Option 01 vector asset remains outstanding.

The archived logo and component boards contain the incorrect wordmark and must not be used as references. The active component board now omits the wordmark and uses a neutral Satoshi title. The product typography remains **Satoshi for headings/UI; Inter for body, helper text and forms; JetBrains Mono selectively for important financial values**. Follow the corrected design-system file over any conflicting board example or earlier note below.

## Active identity asset families

- `assets/logos/mark/`: existing charging bison SVG/PNG files, unchanged.
- `assets/logos/wordmark/`: `PENDING.md` lists the required production wordmark files and source dependency.
- `assets/logos/lockup/`: `PENDING.md` lists the required horizontal lockups and source dependency.
- `assets/logos/references/`: original Option 01 visual sheet, original bison references, and `IDENTITY_REFERENCE.md`.

The production package remains incomplete until an adequate approved wordmark source is supplied. The small raster reference is not a final vector asset. Read the identity reference document for exact colors, tagline, typography roles, and required source formats.

Incorrect wordmark/lockup SVGs and PNGs remain in `assets/references/archive/superseded-typography/logos/`. Do not use them.

## Visual component board

`assets/references/profitrig-component-board.svg` is the scalable master. Its PNG is 3200 × 4620. All board typography is outlined from the actual Satoshi, Inter, and JetBrains Mono fonts. The board depicts brand tokens, typography, financial KPIs, a chart, labeled inputs, validation, primary/secondary/destructive/disabled/loading buttons, keyboard focus, status chips, alerts, a financial table, empty-state guidance, and mobile bottom navigation.

It is a static visual reference, not working application components or a substitute for the complete written specification. Numbers and routes are illustrative. Implement responsive behavior, semantic HTML, keyboard interaction, loading announcements, and reduced motion in code according to the full specification. The board's multiple primary buttons are independent component examples, not a recommended single-screen action hierarchy.

## Contrast decisions using the existing palette

- White on Profit Green has approximately 3.30:1 contrast. The board uses 20 px bold primary-button text, meeting the large-text threshold; do not shrink those labels below 19 px bold while retaining that combination.
- Profit Green on Rig Green has approximately 3.71:1 contrast. Use it for large financial numbers and chart marks, not small normal text.
- Loss Red on Rig Green has approximately 2.74:1 contrast, below even the large-text requirement. Dark loss KPIs use Off White numerals, explicit minus/loss text, and a Loss Red accent. Do not implement the literal red-on-green number example from general KPI guidance when it fails contrast.
- Deep Loss on Loss Wash has approximately 5.35:1 contrast and supports small negative-state text.
- Small positive financial values in light tables use readable Rig Green with an explicit plus sign. Use Profit Green for large results or accents where contrast permits.

These clarify the written guide's accessibility requirement without changing its approved brand hex values. Disabled examples are visibly inactive; active controls require adequate contrast and discernible focus.

## Fonts and source

Satoshi was obtained from Fontshare's official download endpoint. Inter and JetBrains Mono came from the Google Fonts repository. Their licenses are beside the font files. Montserrat Black and SemiBold were used only in the rejected, archived logo attempt. They do not constitute the approved custom wordmark. Montserrat ExtraBold/Black is the historical construction starting reference, not the product UI typeface.

## Claude handoff

Read `PROFITRIG_DESIGN_SYSTEM.md`, this guide, the active component board, and `assets/logos/references/IDENTITY_REFERENCE.md` together. Do not use the superseded wordmark or lockup SVGs. Follow the supplied Option 01 reference and wait for the official wordmark asset instead of substituting typography. Keep the audit-first implementation process from `CLAUDE_IMPLEMENTATION_START.md`. Do not replace the application UI merely by adding these reference assets.
