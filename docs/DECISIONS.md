# Decisions

- 2026-11-18: Built with a CSS-first product fallback so the page is usable while the parallel image generator fills `01_mochi\site`. The asset script is re-runnable and records missing inputs.
- 2026-11-18: Kept source images read-only and copied only optimised derivatives into `public\media`.
- 2026-11-18: Used a single shared flavour context for the page aura, jelly colours, add-to-bag state and wallpaper cards.
- 2026-11-18: The supplied `MOCHI LIP GLOSS` PNG set is now the visual source of truth. Hero, squeeze, flavours, texture, lookbook, stand, all-six and wallpaper cards use optimised derivatives from that folder.
- 2026-11-18: Reconciled the updated brand book and token table before the physics pass. Flavours, moods, aura colours, asset keys, wallpaper labels and self-hosted type now follow the current source of truth.
- 2026-11-18: Derived the scroll Wave frames beside the supplied hero video at quality targets that keep desktop under 10 MB and mobile under 3 MB. The source video remains untouched.
- 2026-11-18: Loaded the four approved type families from local font files and derived flavour and wallpaper data from `docs/design/tokens.json`; verified all six wallpaper downloads at 1290 × 2796 without writing to `public\media`.
