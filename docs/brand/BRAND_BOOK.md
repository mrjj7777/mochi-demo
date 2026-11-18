# MOCHI — BRAND BOOK

Visuals: `MOODBOARD.png` (the look), `NOT_THIS.png` (banned look), `SYSTEM_BOARD.png` (the system). Exact values: `../design/tokens.json`.

---

## 1. What MOCHI is

- **The product:** a lip jelly. Glossy, a light tint, never sticky.
- **The object:**
  - a soft, squishy, translucent silicone tube, 9 cm tall, 2.5 cm wide, holding 9 ml;
  - its body has gentle waves and the word MOCHI softly embossed;
  - it dents when squeezed;
  - the cap is a round, milky-white dome, like a small mochi.
- **The range:** six flavours, the same tube, different jelly colours.
- **The status:** an invented brand, a studio demo by J&J Intelligence. Not a real product.

## 2. The belief

Small soft things deserve obsessive care. MOCHI is a tiny object you carry everywhere, so it should feel good in the hand before it ever touches your lips.

The site does not sell. It lets people *feel* the product: squeeze it, see the light go through it, watch it change colour with their mood. Calm confidence; no shouting.

## 3. Flavours (fixed — never rename, re-colour or remap)

| # | Flavour | Mood | Jelly | Aura | Asset key |
|---|---|---|---|---|---|
| 01 | CHERRY | loud | #B3122E | #2FA4A8 | `cherry` |
| 02 | PEACH | easy | #F4A27E | #8FC3E6 | `peach` |
| 03 | LYCHEE | quiet | #F6D3D6 | #E46A8E | `lychee` |
| 04 | GRAPE | late | #8E5BC4 | #F08A3C | `grape` |
| 05 | MINT | fresh | #8FD9B6 | #14524A | `mint` |
| 06 | MANGO | sunny | #F2B632 | #2346B8 | `mango` |

The order is always the one above (the same as in the hero video: red, peach, pink, violet, green, yellow).

## 4. Voice

- British English.
- Lowercase lines; uppercase only in mono labels.
- At most six words per line. Most screens carry one line or none.
- Warm, a little cheeky, never cute-cringe.
- No exclamation marks, no emoji.

## 5. FINAL COPY DECK — use these strings exactly, nothing else

This deck merges the original deck (Part 01) with the 07/08 changes. Italics mark the Instrument Serif Italic words.

| Place | Copy |
|---|---|
| Wordmark | `MOCHI` |
| Nav | `[ FLAVOURS ]` · `[ WALLPAPERS ]` · `BAG (0)` (the count updates). Brackets show on hover/active only; at rest: `FLAVOURS` `WALLPAPERS` |
| Hero mono line | `LIP JELLY — DROP 01 — SIX MOODS` |
| Hero headline (appears on scroll) | `soft is` *`a choice.`* |
| Belief, one per screen | `soft.` · `squeezable.` · `yours.` |
| Belief small line | `a lip jelly you'll keep squeezing.` |
| Squeeze title | `one squeeze.` |
| Squeeze callouts | `9 ML` · `SILICONE TUBE` · `JELLY, NOT STICKY` · `MILKY CAP` |
| Flavours label / index | `06 FLAVOURS — 9 ML` · `01/06` … `06/06` |
| Flavour line | `cherry — `*`loud`* (same pattern for all six, with moods from the table) |
| Add to bag | `+ ADD TO BAG` |
| Texture | `real lips.` *`real gloss.`* · loupe readout `2.0× — GLOSS` |
| Lookbook | `worn by` *`everyone.`* · captions `(01) CHERRY — LOUD` … `(06) MANGO — SUNNY`, matching the flavour shown in each photo |
| Stand | `the stand.` · `a soft home for all six.` |
| All six | `all six.` · `can't pick?` *`don't.`* |
| Wallpapers | `take the colour home.` · labels `1290 × 2796 — CHERRY` · button `↓ DOWNLOAD 1290 × 2796` |
| Footer sign-off | *`squeeze responsibly.`* |
| Footer label (required) | `Studio demo · MOCHI is an invented brand by J&J Intelligence. Not a real product.` |
| Footer credit (required) | `Made by J&J Intelligence` |
| Reduced motion only | `motion reduced.` |

**Retired:** `made to be touched.` and `MOCHI · LIP JELLY · DROP 01`. Do not use them.

**Never:**
- prices, checkout, email capture, reviews, ratings;
- countdowns, scarcity, "best-selling";
- medical or skin claims;
- food or drink imagery;
- real brand names.

## 6. Colour system

- **Base colours:**
  - **Cream #F2EDE4:** the page and the paper.
  - **Milk #FAF7F2:** highlights, caps, text on dark.
  - **Ink #141414:** all type and hairlines.
- **Flavour colours** (jelly plus aura) colour the page through the global aura. One flavour leads each section.
- **No other colours** are invented: no purple-blue tech gradients, no neon, no pure black or white.

## 7. Type system

| Role | Face | Rules |
|---|---|---|
| Display | Krona One | Lowercase, −0.03em, fitted to the viewport |
| Emotion | Instrument Serif Italic | One or two words per section, never a paragraph |
| Body | Geist 400 / 500 | 18–22 px, leading 1.45 |
| Data | Geist Mono 400 / 500 | Uppercase, +0.1em, 12 px minimum |

- **Signature move:** the mixed headline, a wide Krona phrase followed by an italic serif phrase (`soft is` *`a choice.`*).
- **One typographic move per section,** never repeated. The list is in 07-T.

## 8. Shape and layout

- **Radius 0** on all UI.
- **No boxes around text.** No cards.
- **The only curves are the products** (and the blob stand, which is a product).
- **Grid:** 12 columns. Margins 64 px on desktop, 20 px on mobile. Gutter 24 px.
- **Spacing scale:** 4 · 8 · 16 · 24 · 40 · 64 · 104 · 168.
- **Air:** at least 40% of every screen is empty. One focal point per screen.

## 9. Imagery (see MOODBOARD.png)

- **The look:** grainy medium-format film, warm cream paper, an airbrushed colour aura ring behind the subject, translucent jelly that glows from inside, soft daylight from the upper left.
- **People:** real, candid Indian faces and street-cast people, never model-pretty.
- **Products** are always cutouts or 3D on the page aura, never a photo-in-a-box.
- **The 3D tube** (08-3) must match the photos (colour, translucency, emboss, highlight shape) or it is not used.

## 10. Motion personality

- **Soft but heavy:** jelly that has weight.
- **Springs only:** UI barely bounces; products wobble two or three times; big objects are heavy and slow.
- **Every motion has a physical cause.**
- **Stillness between interactions is part of the design.**
- **Presets:** `tokens.json` → `motion.springs`.

## 11. MOCHI is not

- A template, a SaaS landing page or a dribbble shot.
- Cute-cringe.
- Loud sales copy.
- Glossy CGI.
- Rounded cards and pills.
