# ProfitRig logo and component assets

## Phase 4A production identity — 21 September 2026

Primary horizontal and compact lockups were approved by the user. Use the new SVG/PNG families in `assets/logos/wordmark/` and `assets/logos/lockup/`, together with the unchanged master in `assets/logos/mark/`.

The Phase 4A custom outlined wordmark is now authoritative. Earlier rejected Montserrat-based files remain archived and must not be used. See `assets/logos/README.md`, `assets/logos/references/IDENTITY_REFERENCE.md`, and the new identity proof sheet for approved geometry, derived variants, and production guidance.

No product typography changes: Satoshi for headings/UI; Inter for body/forms; JetBrains Mono for financial/data values.

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

Read the complete design system and identity reference. Use supplied production SVGs rather than typing the wordmark or redrawing the bison. Keep the audit-first process. Primary and compact lockups are approved; review the derived proof-sheet treatments and guidance before Phase 4 frontend implementation. This asset task does not authorize application changes.
