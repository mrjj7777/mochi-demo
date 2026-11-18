# AGENTS.md — MOCHI landing site

Read this file at the start of every session, then the files it points to. It exists so that every agent (Codex, Claude Code, any other) builds this site the same way and does not repeat old mistakes.

## What this is

- **The brand:** MOCHI is a lip jelly, Drop 01, in six flavours. It is an invented brand: a studio demo by **J&J Intelligence**, not a real product.
- **The goal:** a shipped, luxury, SKYLRK-level product site. The product is the hero, there is a lot of air, and motion feels physical. Nothing may look like a template.
- **The approver:** JJ (J&J Intelligence). All copy is British English.

## Source of truth (higher wins)

1. JJ's latest instruction.
2. `C:\Users\mrjj7\Desktop\ADS-CAMPAIGN\SOFT CHAOS\01_mochi\SITE_PROMPT\08_PHYSICS_AND_PRESENTATION.md`
3. `…\SITE_PROMPT\07_FIX_PASS_01.md`
4. This file and `docs/`: the brand book, tokens, assets, client feedback and QA checklist.
5. `…\SITE_PROMPT\00_READ_ME_FIRST.md` to `06_TEAM_QA_DELIVERY.md` (the original brief).

Where the original brief says "everything soft, nothing sharp", the current rule is narrower: **the products are soft; the UI has straight edges** (07-A2).

## Look before you build

| File | What it is |
|---|---|
| `docs/brand/MOODBOARD.png` | The look: approved imagery. |
| `docs/brand/NOT_THIS.png` | What made the first build look cheap. Never do these. |
| `docs/brand/SYSTEM_BOARD.png` | Colour, type, shape, space and motion at a glance. |
| `docs/brand/BRAND_BOOK.md` | Brand, voice, the **final copy deck**, the flavour table. |
| `docs/design/tokens.json` | Every value: colours, fonts, type scale, spacing, springs, auras. Code must use these values. |
| `docs/ASSETS.md` | Every media file, what it is, where it goes. |
| `docs/CLIENT_FEEDBACK.md` | JJ's verdicts so far, and the rule each one created. |
| `docs/QA_CHECKLIST.md` | The definition of done. |
| `docs/DECISIONS.md` | One dated line per decision you make. Append only. |

## Commands

- `npm run dev`: the dev server at http://127.0.0.1:5173.
- `npm run build`: must pass with zero type errors.
- `npm run assets`: re-runnable asset pipeline. It must never overwrite an existing file in `public/media`.
- `npm run qa` and the scripts in `qa/`: Playwright screenshots and videos into `_qa/`.

## The work loop (every block, every time)

1. Screenshot the current state at 1440×900, 1920×1080 and 390×844, into `_qa/<block>-before/`.
2. Make one focused change.
3. `npm run build` passes, and the browser shows no console errors.
4. Screenshot again, and record the interaction or scroll video, into `_qa/<block>-after/`.
5. **Look at the screenshots yourself.** Compare them with `MOODBOARD.png` and `NOT_THIS.png`. If anything looks like the NOT_THIS board, fix it before moving on.
6. Tick the matching items in `docs/QA_CHECKLIST.md`.
7. Commit as `type: what changed`, where type is feat, fix, style, perf, test or docs.
8. Log any judgement call in `docs/DECISIONS.md`.

## Hard rules

### Files
- **Media is add-only.** Never delete, rename or overwrite anything in `public/media/`; add new files beside the old ones.
- **Source folders are read-only.** Images and video outside this repo are read-only.
- **Stay inside this repo.** Never touch anything outside it, especially `C:\dev\mairdor-assets` and `C:\Users\mrjj7\Desktop\JJ-Intelligence`.
- **No paid add-ons.** Add no paid font, service or API without JJ.

### Visual
- **No curves in the UI.** `border-radius: 0` on every element. No pills, chips, rounded cards or circles in the UI. The only curves on the page are the products.
- **No box-shadow.** None on UI or images. Products get a real contact shadow, tinted with the local aura colour.
- **No floating image boxes.** An image must never sit in a box with its own background on the page. Products are cutouts or 3D on the global aura; photos are full-bleed or hard-edged crops.
- **No lines between sections.** Use one global WebGL aura, and fade photos at their top and bottom edges.
- **Fonts.**
  - Self-host exactly four: Krona One, Instrument Serif (regular and italic), Geist, Geist Mono.
  - Arial, Consolas or any system fallback must never be visible.
- **Text size.**
  - Nothing under 11 px.
  - Mono labels at least 12 px on desktop.
  - Every display word fits the viewport.
- **The hero video's bottom-right corner stays empty.** It carries a small Veo watermark; never crop, blur or cover it.

### Motion
- **Springs only.** Use the four presets in `tokens.json`. Every motion is interruptible and carries velocity.
- **Every motion has a cause.** Nothing moves unless a physical cause exists (gravity, pressure, inertia, pointer, scroll used as a force) or the motion reveals content.
- **Never these:**
  - hover scale, lift, tilt or zoom on images or cards;
  - opacity-only fades;
  - ambient bobbing;
  - the same mechanic in two sections.
- **Reduced motion.** `prefers-reduced-motion` gets a calm, complete, static version.

### Content
- **Copy.**
  - Use only the final copy deck in `docs/brand/BRAND_BOOK.md`, letter for letter.
  - Never invent text, numbers, claims or reviews.
  - Never show prices, checkout, email capture or ratings.
- **Flavours.** Names, moods and colours are fixed: CHERRY loud, PEACH easy, LYCHEE quiet, GRAPE late, MINT fresh, MANGO sunny. Each uses its own asset (`cherry` → `mochi-cherry.*`, `lychee` → `mochi-lychee.*`, and so on).
- **Credits.** Both footer lines are required: the studio-demo label and the J&J credit.

## Stop and ask JJ when

- The 3D tube vs photo comparison is ready (08-3): save it to `_qa/3d-vs-photo/` and wait.
- You need a new image, video or other asset. JJ makes them with Codex, GPT Image or Flow; do not generate stand-ins and present them as final.
- A request conflicts with a rule in this file.
- Anything would need a file deleted.

## Known issues (fix in the current pass)

1. **Flavour data in `src/App.tsx` is wrong.**
   - The site shows PISTACHIO and MILK, puts LYCHEE on the mango tube, and uses the wrong moods and auras.
   - Replace it with the table in `BRAND_BOOK.md`, with each flavour mapped to its own asset.
2. **Wallpaper dimensions.** The 07 file says 1170 × 2532, but the real files are **1290 × 2796**. Use 1290 × 2796 in all labels and buttons.
3. **Fonts.** Geist and Geist Mono must actually load, with no Arial or Consolas showing (07-A1). Instrument Serif is not installed yet.

## Map

```
src/App.tsx            sections and data
src/styles.css         styles; values must come from docs/design/tokens.json
src/components/        components
public/media/          cutouts/ photos/ video/ wallpapers/ hero-seq/   (add-only)
public/fonts/          self-hosted fonts
scripts/               assets.mjs (pipeline), qa.mjs
qa/                    Playwright scripts
_qa/                   screenshots, videos, REPORT.md (evidence)
docs/                  brand book, boards, tokens, assets, feedback, QA, decisions
```
