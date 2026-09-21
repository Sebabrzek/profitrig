# Production identity assets

These SVGs are exact copies of the approved compact masters in
`docs/design/assets/logos/lockup/`. Keep those design files as the source.
The shared Wordmark component uses a minimum 200 CSS px canvas width and
adds half-cap-height clear space. Header actions wrap when needed.
The dark sidebar uses the Off White/Sage reversed lockup.

The primary tagline lockup requires 1000 CSS px and is deliberately not
used in navigation or login. Body/UI fonts remain Satoshi, Inter and
JetBrains Mono; no font constructs the official logo.

`src/app/icon.svg` and the three-frame `src/app/favicon.ico` use the approved
larger browser favicon. `public/icons/` and `src/app/apple-icon.png` use the
separate, padded app-icon treatment. Never substitute the favicon framing
for masked app icons. The manifest theme is Rig Green; launch background
is Off White.
