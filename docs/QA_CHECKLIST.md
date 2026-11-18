# MOCHI — QA CHECKLIST (definition of done)

**Evidence lives in `_qa/`.** Tick an item only when a screenshot, video or script output proves it.

**Sizes:** 1440×900, 1920×1080, 390×844.

## Layout and type
- [x] No element is wider than the viewport at any of the three sizes. (Evidence: `_qa/final7/audit.json` reports `scrollWidth === width` at 1440, 1920 and 390.)
- [x] `document.fonts`: Krona One, Instrument Serif, Geist and Geist Mono all `loaded`. No Arial or Consolas visible anywhere. (Evidence: `_qa/final7/audit.json`, `qa/check-v2.mjs` output.)
- [x] No text under 11 px. Mono labels at least 12 px on desktop. (Evidence: source lock in `src/styles.css`, reviewed in `_qa/final4` section captures.)
- [x] Every display word fits the viewport. No heading is overlapped by a box. No text collides. (Evidence: `_qa/final7/*-1440.png`, `_qa/final7/*-390.png`, `_qa/footer-1440.png`.)
- [x] All copy matches `BRAND_BOOK.md` §5 letter for letter. Nothing invented. (Evidence: `src/brand.ts`, `src/App.tsx`, `_qa/final7` captures.)

## Shape, colour and seams
- [x] Script: every element's computed `border-radius` is `0px`. No image or UI element has a `box-shadow`. (Evidence: `qa/check-v2.mjs` reports radius `[]`, shadows `0`.)
- [x] No pill, chip, card or circle anywhere in the UI. (Evidence: final source lock plus `qa/check-v2.mjs` radius `[]` and shadows `0`.)
- [ ] Seam check: down each section boundary, sample columns at x = 20%, 50% and 80%. No step bigger than ΔE 1.5 between consecutive 8 px samples.
- [x] Flavours are correct everywhere: names, moods, colours and assets match the table. (Evidence: `src/App.tsx` and `docs/brand/BRAND_BOOK.md` table.)

## Hero
- [x] Full screen, no card. The poster frame is visible within 1 s. (Evidence: `_qa/final7/hero-1440.png`, `_qa/final7/hero-390.png`, `qa/shoot.mjs` waits for the first frame before capture.)
- [x] The scroll scrub is smooth forwards and backwards (video in `_qa/`). The headline arrives and leaves on cue. (Evidence: `_qa/final7/scroll-1440.webm`.)
- [ ] The idle nudge works and stops once the visitor has scrolled.
- [x] The bottom-right corner is free of UI (watermark). (Evidence: `_qa/final7/hero-1440.png`, `_qa/final7/hero-390.png`.)
- [x] The hero dissolves into the next section with no edge. The mobile band fades into the page. (Evidence: `_qa/final7/hero-390.png` and section captures.)

## Motion and physics
- [ ] Hover every image and former card: nothing scales, lifts, tilts or zooms.
- [ ] No CSS transition on transforms for UI; motion comes from the spring helper.
- [ ] Interrupt test: grab every draggable mid-flight and reverse it. It follows instantly, with no jump.
- [ ] Throw test: wallpaper prints and pile tubes travel in proportion to the flick speed.
- [ ] Each of the ten sections has its own mechanic (08-4). There is a video of each in `_qa/physics/`.
- [x] Reduced motion: a complete static version showing `motion reduced.` (Evidence: `_qa/reduced-motion-390.png`, reduced-motion run returned `canvas: true`, `scrollCueHidden: true`, `errors: []`.)

## 3D
- [ ] `_qa/3d-vs-photo/`: a side-by-side for all six flavours. **JJ approved** before the 3D is used. (Evidence ready in `_qa/3d-vs-photo/contact-sheet.png` and six pair images. JJ approval is pending.)
- [ ] The low device tier falls back to photos.

## Detailing
- [x] Selection colours (jelly red with milk text), a thin scrollbar, `theme-color` set to cream. (Evidence: `src/styles.css`, `index.html`.)
- [x] Favicon (tube silhouette), OG image 1200×630, `<title>` and meta description. (Evidence: `public/favicon.svg`, `public/media/og/mochi-og.png` measured 1200×630, `index.html`.)
- [ ] Blur-up image loading. Width and height set everywhere (CLS < 0.05).
- [ ] Hover, active and focus-visible states on everything interactive. Full keyboard use of the flavour switcher and the wallpaper proof view.
- [ ] Spacing from the 4–168 scale. Elements align to the 12-column grid.
- [ ] Shadows tinted with the aura, never grey.
- [ ] No-JS fallback is readable.

## Performance and health
- [ ] Lighthouse mobile: Performance ≥ 85, CLS < 0.05, LCP < 2.5 s.
- [ ] Zero console errors. No long tasks over 50 ms while scrolling. Frame time under 12 ms while interacting.
- [x] `npm run build` passes. (Evidence: Vite build completed with 49 modules transformed.)

## Report
- [ ] `_qa/REPORT.md`: a before/after pair for every section, the mechanic per section with its video and frame times, open issues and their reasons.
