# MOCHI — ASSETS

## Rules for all media

- **`public/media/` is add-only:** never delete, rename or overwrite a file. Add new files beside the old ones, and log them in `DECISIONS.md`.
- **Source images outside the repo are read-only:**
  - `C:\Users\mrjj7\Desktop\MOCHI LIP GLOSS\`
  - `…\ADS-CAMPAIGN\SOFT CHAOS\01_mochi\`
- **New images or videos are made by JJ** (Codex with GPT Image, or Google Flow). Ask for them; never ship stand-ins as final.

## Inventory

| File | What it is | Where it goes |
|---|---|---|
| `video/hero-six.mp4` | **Approved hero video.** 1920×1080, 24 fps, 7.17 s, 172 frames. Six tubes in a row; a big soft squish wave runs left to right. Has an audio track (strip it). **Veo watermark bottom-right:** never crop or cover it. Does not loop cleanly. | Hero, scroll-driven (07-H). Convert to `hero-seq/` frames. |
| `photos/mochi-all-row.webp` | The six tubes in a row (1600×900). The same scene as the video's first frame. | OG image, no-JS hero fallback |
| `photos/mochi-hero-wide.webp` | Cherry tube and cap on a teal aura (1600×900). | Retired from the hero. Spare. |
| `cutouts/mochi-{flavour}.webp` (×6) | Packshot per flavour (1122×1402). **RGB, no alpha:** not true cutouts. | Source for clean alpha cutouts (make new `*-alpha.webp` files) and for the 3D colour match |
| `cutouts/mochi-{flavour}-aura.webp` (×6) | Tube floating in its own aura (1122×1402). | Reference for 3D look-matching; flavour fallbacks |
| `photos/mochi-peach-model.webp` | Lips macro with the peach tube. | Texture section (loupe) |
| `photos/mochi-model-1.webp` … `-5.webp` | Lookbook portraits (cherry, mint, grape, lychee, mango). | Lookbook film strip |
| `photos/mochi-diptych-cherry.webp`, `-lychee.webp` | Two stacked photos. | Lookbook, at their true ratio |
| `photos/mochi-all-pile.webp` | Pile of tubes (1600×900). | All-six fallback |
| `photos/mochi-blob-stand.webp` | The milk-white blob stand with six tubes. | Stand fallback, and the 3D stand reference |
| `wallpapers/mochi-{flavour}-1290x2796.png` (×6) | Phone wallpapers, **1290 × 2796**. | Wallpaper print stack and downloads |
| `../fonts/krona-one-400-normal.ttf` | Krona One. | Display face |
| `../fonts/geist-latin-wght-normal.woff2` | Geist variable. | Body face, self-hosted in `public/fonts`. |
| `../fonts/geist-mono-latin-wght-normal.woff2` | Geist Mono variable. | Data face, self-hosted in `public/fonts`. |
| `../fonts/instrument-serif-latin-400-normal.woff2` | Instrument Serif regular. | Editorial accent, self-hosted in `public/fonts`. |
| `../fonts/instrument-serif-latin-400-italic.woff2` | Instrument Serif italic. | Editorial accent, self-hosted in `public/fonts`. |
| `../fonts/michroma-400-normal.ttf` | Michroma. | **Not used.** Legacy source only. |
| `docs/brand/refs/hero-wave-*.webp` | Frames from the hero video (0 s, 2.5 s, 4 s). | Reference only, for the moodboard. Not shipped. |

## Flavour → asset map (never mix these up)

| Flavour | Asset key | Photos |
|---|---|---|
| CHERRY | `cherry` | `mochi-cherry*`, `model-1`, `diptych-cherry` |
| PEACH | `peach` | `mochi-peach*`, `peach-model` |
| LYCHEE | `lychee` | `mochi-lychee*`, `model-4`, `diptych-lychee` |
| GRAPE | `grape` | `mochi-grape*`, `model-3` |
| MINT | `mint` | `mochi-mint*`, `model-2` |
| MANGO | `mango` | `mochi-mango*`, `model-5` |

If a model photo's flavour is unclear, check the tube colour in the photo and use that flavour.
