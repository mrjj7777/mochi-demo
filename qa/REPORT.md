# MOCHI landing site QA report

Date: 18 November 2026  
Project: `C:\Users\mrjj7\Desktop\Portfolio-Demo-Sites\mochi-landing`

## Asset pipeline

- `npm run assets` completed using the 24 supplied PNG files in `C:\Users\mrjj7\Desktop\MOCHI LIP GLOSS`.
- Optimised WebP derivatives were written to `public/media/photos`, `public/media/cutouts`, and `public/media/wallpapers`.
- Real media is connected to the hero, squeeze interaction, all six flavours, texture section, lookbook, stand, all-six composition, and wallpaper gallery.
- The delivered source folder was treated as read-only. No supplied source image was renamed, edited, or deleted.

## Build and browser QA

- `npm run build` passed TypeScript and Vite production compilation.
- `npm run qa` passed at 390, 768, 1280, 1440, and 1920 pixel viewport widths.
- Nine section captures, one reduced-motion capture, and one 45-second scroll recording were generated.
- Browser console result was 0 errors and 0 warnings in `qa/console.json`.
- Final visual proof includes `qa/page-390.png`, `qa/sections/hero-1440.png`, `qa/sections/texture-1440.png`, `qa/sections/stand-1440.png`, `qa/sections/all-six-1440.png`, and `qa/sections/wallpapers-1440.png`.
- The mobile flavour rail stacks into readable cards instead of retaining desktop pin spacing.
- The mobile lookbook uses a visible two-column composition with a wide lead image, so the section stays expressive on a narrow screen.
- The preloader waits for the critical image set and all six lookbook photos before revealing the page, which removes blank first-paint media blocks.
- Decorative microcopy that weakened the hierarchy was removed from the hero, lookbook, and footer.

## Lighthouse

Production preview was measured with the Lighthouse desktop preset against `http://127.0.0.1:4173/`.

| Category | Score |
| --- | ---: |
| Performance | 98 |
| Accessibility | 100 |
| Best practices | 100 |
| SEO | 92 |

The raw run is saved at `qa/lighthouse-production.json`.

## Motion and scope

- Smooth scrolling uses Lenis with GSAP timelines and responsive reduced-motion handling.
- The optional R3F, physics, and video dependencies from the wider brief are not bundled. The finished interaction layer uses the existing CSS, GSAP, and Lenis stack so the landing page remains fast and self-contained.

## Re-run

```powershell
cd /d "C:\Users\mrjj7\Desktop\Portfolio-Demo-Sites\mochi-landing"
npm install
npm run assets
npm run build
npm run qa
```

