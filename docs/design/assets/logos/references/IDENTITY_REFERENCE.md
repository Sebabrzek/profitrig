# PROFITRIG custom wordmark — Option 01

## Approval and provenance

The user approved the Phase 4A primary horizontal and compact previews on 21 September 2026. Production assets use those same custom letter paths, spacing, bison geometry, relative placement, and tagline treatment. They are the approved Phase 4A execution of the Option 01 direction, not a recovered historical source file.

Construction starting reference: **Montserrat ExtraBold/Black**. The approved wordmark consists of custom vector paths, not typeset Montserrat or another font.

- PROFIT — Rig Green `#173C2B`
- RIG — Sage `#8FAE91`
- Tagline — **KNOW YOUR NUMBERS. TAKE CONTROL.**

The tagline is outlined Inter Medium, as shown in the approved preview. No runtime font dependencies exist in the SVG logos.

The charging-bison master is unchanged. Master SHA-256: 6743273ad8857d936372b8e4b2189bdea1d0dfaa665a8e7dca6770f81a8348c1. Only uniform scaling, placement, and one-color fills are used in variants.

## Typography distinctions

Official wordmark: approved custom Option 01 geometry. UI/headings: Satoshi. Body: Inter. Financial/data: JetBrains Mono. Do not recreate the wordmark using any application font.

## Production guidance

Minimum clear space is half the wordmark cap height on every side, measured from the outermost visible artwork (including bison and tagline). For standalone bison use one-quarter of the visible mark height. SVG canvas padding is not the required clear space: add external layout space. For square app tiles and favicons, use their supplied framing instead; do not add the standalone-mark margin inside the tile.

Approved minimum-width guidance: primary with tagline 1000 CSS px / 170 mm print; compact 200 CSS px / 45 mm; wordmark 160 CSS px / 35 mm; standalone bison 32 CSS px, preferably 48 px. At 1000 CSS px the tagline capitals are approximately 12 px high; at 170 mm they are approximately 2 mm high. The previous 480 CSS px / 100 mm primary recommendation is superseded. Use compact below the primary threshold. CSS dimensions refer to the entire SVG canvas, not raster pixel count. Test at actual display size and with a physical print proof; approval of this guidance does not replace medium-specific readability checks.

Compact SVG canvases are now 1426 × 198, removing unused bottom space to balance the top and bottom margins. Internal paths, placement, proportions, and spacing are unchanged. Primary canvases remain 1426 × 218. Do not force both variants into the same aspect ratio.

The user approved the larger-framed browser favicon on 21 September 2026. Production files are `mark/profitrig-favicon.svg` and `mark/profitrig-favicon-{16,32,48}.png`. The exact bison path occupies approximately 88% of tile width, versus 66% in the superseded framing. Use this treatment for browser favicons only, not masked app icons. At 16 px fine gaps still soften. Candidate-named files and the comparison sheet remain as review history; production PNGs now use the approved framing. No frontend code or installation was changed.

App icon: Off White bison on solid Rig Green, no baked-in corner radius. The mark stays within the center safe area for platform masking. 512 px and 192 px PNGs plus SVG are provided. Platform installation and PWA manifest updates are outside this task.

Never stretch, add strokes, bevels, gradients, chrome, shadows, or texture. Engraving belongs only in marketing illustrations.

The primary and compact design, production review adjustments, and larger-framed favicon are approved. The proof sheet records the approved identity treatments and guidance for Phase 4 frontend implementation.
