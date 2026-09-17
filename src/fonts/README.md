# ProfitRig application fonts

Byte-identical copies of the approved font files in
`docs/design/assets/fonts/`, kept here so the production build never depends
on the documentation folder. Their licences live beside the originals.

| File | SHA-256 |
|---|---|
| `Satoshi-Variable.ttf` | `02ad131926aa46d282b6af73ad2bcaecb0ec6ef3b830a2f08dcabef44f1140ff` |
| `Inter.ttf` | `29160a80ff49ddcab2c97711247e08b1fab27a484a329ce8b813d820dc559031` |
| `JetBrainsMono.ttf` | `48715a42ec242c21e9f02692891e147d022299a52e48d5e413e1a942193ffeda` |

All three are variable fonts:

| Font | Axis range | Role |
|---|---|---|
| Satoshi | `wght 300–900` | Headings, navigation, buttons, card titles, short UI emphasis |
| Inter | `wght 100–900`, `opsz 14–32` | Body, descriptions, helper text, forms, tables |
| JetBrains Mono | `wght 100–800` | Important financial values only — not ordinary digits |

Self-hosting is permitted for all three: Satoshi under the ITF Free Font
Licence, Inter and JetBrains Mono under the SIL Open Font Licence.

Re-verify with:

    shasum -a 256 src/fonts/*.ttf docs/design/assets/fonts/*.ttf
