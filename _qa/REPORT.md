# MOCHI QA Report — Fix Pass 09 & Creative Editorial Multi-Page Upgrade

Date: 2026-11-19
Repo: `C:\Users\mrjj7\Desktop\Portfolio-Demo-Sites\mochi-landing-v2` (live at `http://127.0.0.1:5174/`)

## Scope & Source Truth

Executed `09_GALLERY_AND_REVIEW_FIX.md` items `1 → 10` in order, then applied JJ's live visual direction overrides (which take top priority per `AGENTS.md`):
- **Gallery (`#lookbook` — "worn by *everyone.*")**: All **29** MOCHI campaign images from `public/media/campaign/campaign.json` in exact JSON order, original untouched sRGB colours (zero filters, zero grading, zero blend modes), presented on desktop as the exact **REEL FLUX** 3D concave panoramic cinema-lens scroll + drag-flick strip with tight cream gutters, live bottom-left caption (`(01) PINK NOISE` … `(29) ONE POUT, SIX TIMES`), counter (`01 / 29`), hairline progress rail, and full-screen Portal lightbox (`contain` on cream, `←`/`→`, swipe, `ESC`, prev/next full-image preload). Mobile (`< 768px`) uses a native horizontal `scroll-snap` 4:5 strip (`84vw`).
- **Wallpapers (`#wallpapers` — "take the colour *home.*")**: Displays all **6** real `1290 × 2796` wallpapers (`public/media/wallpapers/mochi-*-1290x2796.png`) at exact phone ratio with `1290 × 2796 — CHERRY` … `MANGO` labels, plain-text `↓ DOWNLOAD 1290 × 2796` links (no pills), and full-screen Portal proof lightbox.
- **Hero (`#hero`)**:
  - Re-exported desktop frames at crisp **1920 × 1080** (`public/media/hero-seq-1920/desk/`, 172 frames) and full-screen **9:16** mobile frames (`public/media/hero-seq-1920/mob/`, 86 frames, `720×1280` centred on the tubes) from `public/media/video/hero-six.mp4` (source video untouched).
  - Preloader unmounts cleanly (`display: none` + unmounted after fade) with its counter on the bottom-left — zero stray pink square or bottom-right `100` counter in the Veo watermark zone.
  - Full-colour unwashed first frame; mobile headline sits cleanly below the nav.
  - **Bottom-Up Shutter Curtain**: `#belief` slides directly up from the bottom over the receding pinned Hero video on scroll for a distinct architectural transition.
- **Belief (`#belief`)**: Preserves JJ's approved viscous elastomer squeeze & release scroll physics (`soft.` / `squeezable.` / `yours.`) without extra sub-line clutter.
- **Flavours (`#flavours`)**: Preserves JJ's approved 3D depth parallax + snap across all 6 transparent cutouts, shortened pin (`380vh`), interactive press/drag jelly squish (`120/9`) + real photographic milky cap pop-off, and minimum `12px` labels.
- **First-Squeeze Editorial Ticker (`SoftTicker`)**: Slim straight-edged horizontal hairline marquee between Flavours and Texture with witty minimal MOCHI copy (`SOFT PAYS OFF — TEN PERCENT LIGHTER ON YOUR FIRST SQUEEZE`, `YOUR LIPS ALREADY VOTED YES — CODE SOFT10 AT BAG`, etc.) linking straight into the Bag page with `SOFT10` applied.
- **Texture (`#texture`)**: Scroll-driven architectural shutter aperture reveal + macro depth pull, JJ's compact **round 4K optical magnifying glass** (`136px`, pixel-exact `2.25×` cover-math zoom with curved specular reflection arc), `"real lips. *real gloss.*"` at `clamp(20px, 2vw, 28px)`, and automatic readable white nav (`.site-nav--light`) with soft dark shadow while over the photo (no blend modes).
- **Stand (`#stand`)**: Removed the boxed square completely — presented with a seamless feathered radial dissolve into the page cream/blue aura and heavy-spring drag tilt.
- **Footer**: Fitted full-width `MOCHI` wordmark with cursor-tracked multi-flavour colour flood, `"squeeze responsibly."` in **Instrument Serif italic**, `"Concept brand by J&J Intelligence."`, and minimum `12px` typography across every element.
- **Nav & Dedicated Multi-Page Views**: Top nav uses `MOCHI` | `FLAVOURS` | `WALLPAPERS` | `BAG (n)`. Clicking `FLAVOURS`, `WALLPAPERS`, or `BAG (n)` triggers a vertical architectural cream shutter page-transition curtain (`#/flavours`, `#/wallpapers`, `#/bag`) into three distinct, non-repeated studio pages:
  - **Flavours Atelier (`#/flavours`)**: Split 6-shade editorial index + giant interactive squish/cap-pop specimen stage + `+ ADD TO BAG`.
  - **Wallpapers Darkroom (`#/wallpapers`)**: Interactive heavy-spring drag/flick `1290 × 2796` phone proof deck framed by hairline corner crop marks + 6-shade darkroom switcher + direct downloads + fullscreen proof.
  - **Your Bag (`#/bag`)**: Visual pocket tray displaying the actual MOCHI tubes in your bag + per-flavour `−`/`+` controls + interactive `SOFT10` 10% first-squeeze perk toggle + studio-demo note.

## Before & After Evidence (`_qa/09/`)

| Section / Page | Before (1440 / 375) | After (1440 / 375) |
| --- | --- | --- |
| Hero (Rest & Mid) | `_qa/09/before/01-hero-rest-desk-1440.png`, `_qa/09/before/01-hero-rest-mob-375.png`, `_qa/09/before/01b-hero-mid-mob-375.png` | `_qa/09/after/01-hero-rest-desk-1440.png`, `_qa/09/after/01-hero-rest-mob-375.png`, `_qa/09/after/01b-hero-mid-mob-375.png` |
| Hero → Belief Shutter | — | `_qa/09/after/01c-hero-shutter-desk-1440.png` |
| Belief | `_qa/09/before/02-belief-desk-1440.png`, `_qa/09/before/02-belief-mob-375.png` | `_qa/09/after/02-belief-desk-1440.png`, `_qa/09/after/02-belief-mob-375.png` |
| Flavours | `_qa/09/before/03-flavours-desk-1440.png`, `_qa/09/before/03-flavours-mob-375.png` | `_qa/09/after/03-flavours-desk-1440.png`, `_qa/09/after/03-flavours-mob-375.png` |
| Texture | `_qa/09/before/04-texture-desk-1440.png`, `_qa/09/before/04-texture-mob-375.png` | `_qa/09/after/04-texture-desk-1440.png`, `_qa/09/after/04-texture-mob-375.png` |
| Campaign Gallery (29 posters) & Lightbox | `_qa/09/before/07-wallpapers-desk-1440.png` | `_qa/09/after/05-lookbook-desk-1440.png`, `_qa/09/after/05-lookbook-mob-375.png`, `_qa/09/after/05b-lightbox-desk-1440.png` |
| Stand | `_qa/09/before/06-stand-desk-1440.png`, `_qa/09/before/06-stand-mob-375.png` | `_qa/09/after/06-stand-desk-1440.png`, `_qa/09/after/06-stand-mob-375.png` |
| Wallpapers (6 × 1290×2796) | `_qa/09/before/07-wallpapers-desk-1440.png`, `_qa/09/before/07-wallpapers-mob-375.png` | `_qa/09/after/07-wallpapers-desk-1440.png`, `_qa/09/after/07-wallpapers-mob-375.png` |
| Footer | `_qa/09/before/08-footer-desk-1440.png`, `_qa/09/before/08-footer-mob-375.png` | `_qa/09/after/08-footer-desk-1440.png`, `_qa/09/after/08-footer-mob-375.png` |
| Dedicated Flavours Page (`#/flavours`) | — | `_qa/09/after/09-page-flavours-desk-1440.png` |
| Dedicated Wallpapers Page (`#/wallpapers`) | — | `_qa/09/after/10-page-wallpapers-desk-1440.png` |
| Dedicated Bag Page (`#/bag`) | — | `_qa/09/after/11-page-bag-desk-1440.png` |

## Automated Proof (`_qa/09/after/audit.json`)

- **Build**: `npm run build` (`tsc -b && vite build`) exited `0` in `4.77s`.
- **Console / Network**: `0` console errors, `0` page errors, `0` failed requests (`4xx`/`5xx`) at both `1440×900` and `375×812`.
- **Overflow**: `0px` horizontal overflow at both `1440×900` and `375×812`.
- **Typography**: All four brand fonts (`Krona One`, `Instrument Serif`, `Geist Variable`, `Geist Mono Variable`) loaded; minimum computed font size is `12px` across desktop and mobile.
- **Campaign Gallery**: All `29` images present in exact `campaign.json` order (`(01) PINK NOISE` → `(29) ONE POUT, SIX TIMES`), `0` filtered images, `0` rounded images, Portal lightbox opens cleanly above nav and closes on `ESC`.
- **Wallpapers**: All `6` real `1290 × 2796` PNGs rendered with exact labels and plain-text `↓ DOWNLOAD 1290 × 2796` links.
- **Multi-Page Navigation**: Verified transitions into `#/flavours` (`six moods.`), `#/wallpapers` (`take the colour home.`), `#/bag` (`your bag.`), and back to Home (`#/`).

## Still Open / Blocked Items for JJ

- **Stand Asset (`mochi-blob-stand.webp`)**: Currently the only stand render available in the repo/desktop (`MOCHI_BLOB_STAND.png`) has a studio blue backdrop and less pronounced tube waves compared to the hero wave render. We removed the boxed square using a soft feathered radial dissolve so it integrates smoothly into the cream/blue aura without faking the product shape, **but a dedicated new stand render featuring the exact hero wavy MOCHI tubes on a clean cream or transparent background is recommended** when you generate the next asset pass.


## Production Release Sign-Off (`vite preview` Dist Verification)

- **Clean Production Build**: `npm run build` (`tsc -b && vite build`) passes in `5.23s` with **0 TypeScript errors, 0 warnings**, and split cacheable chunks (`vendor-react` `1.44 kB` gz, `vendor-motion` `36.37 kB` gz, `vendor-three` `129.35 kB` gz, app `109.34 kB` gz, CSS `18.86 kB` gz).
- **LCP & Preload Hygiene**: `index.html` preloads only active `1920×1080` desktop (`poster.webp`) / `9:16` mobile (`poster-mob.webp`) hero posters and the 4 self-hosted brand fonts (`Krona One`, `Geist Variable`, `Geist Mono Variable`, `Instrument Serif`). Unused preloads and dead code (`MochiTube3D.tsx`, `@fontsource/syne`) removed.
- **Lenis + ScrollTrigger Multi-Page Hardening**: Synchronized `lenis.scrollTo(0, { immediate: true })` + `lenis.resize()` + `ScrollTrigger.refresh()` across route switches, hash navigation, and Flavours shade-tab jumps.
- **Audio Hygiene**: Luxury Yamaha C5 Salamander Grand Piano engine (`src/audio/luxuryPiano.ts`) suspends cleanly on tab hide (`visibilitychange`) and resumes on return.
- **Simulated Checkout**: Preserved studio-demo Bag checkout (`SOFT10`, packaging toggle, `RESERVE DROP 01 →` confirmation `#MCH-xxxx`) with zero real payment integration.
- **Full `vite preview` Audit (Desktop `1440×900` & Mobile `375×812`)**:
  - `0` console errors, `0` page errors, `0` 4xx/5xx requests, `0` broken images across all 4 routes (`Home`, `#/flavours`, `#/wallpapers`, `#/bag`), `0px` horizontal overflow.
  - Mobile `375px` nav verified with `58px` clearance between `MOCHI` and nav controls, and clean round-trip `#/bag` → `#/` (`scrollY: 0`, `hasHero: true`).
  - Ready to deploy `dist/` directly to Netlify, Vercel, Cloudflare Pages, or any static host.
