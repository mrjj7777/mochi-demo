import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { flavours } from '../brand'
import './WallpapersPage.css'

gsap.registerPlugin(ScrollTrigger, useGSAP)

const PRINTS = flavours.map((f, i) => ({
  idx: i,
  key: f.key,
  name: f.name,
  mood: f.mood,
  jelly: f.jelly,
  aura: f.aura,
  src: `/media/wallpapers/mochi-${f.asset}-1290x2796.png`,
  label: `1290 × 2796 — ${f.name}`,
  alt: `MOCHI ${f.name.toLowerCase()} phone wallpaper (1290 × 2796)`,
}))

export default function WallpapersPage({
  onNavigate,
  onSelectGlobalFlavour,
}: {
  onNavigate: (route: 'home' | 'flavours' | 'wallpapers' | 'bag') => void
  onSelectGlobalFlavour: (item: (typeof flavours)[number]) => void
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [activeIdx, setActiveIdx] = useState(0)
  const [fullscreenIdx, setFullscreenIdx] = useState<number | null>(null)

  useEffect(() => {
    onSelectGlobalFlavour(flavours[activeIdx] ?? flavours[0])
  }, [activeIdx, onSelectGlobalFlavour])

  useEffect(() => {
    if (fullscreenIdx === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreenIdx(null)
      if (e.key === 'ArrowRight') setFullscreenIdx(i => (i === null ? 0 : (i + 1) % PRINTS.length))
      if (e.key === 'ArrowLeft') setFullscreenIdx(i => (i === null ? 0 : (i - 1 + PRINTS.length) % PRINTS.length))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fullscreenIdx])

  // Monumental scroll-driven mask aperture reveals & vertical depth parallax across all 6 spreads
  useGSAP(
    () => {
      const root = rootRef.current
      if (!root) return
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

      const spreads = gsap.utils.toArray<HTMLElement>('.wpe-spread', root)
      spreads.forEach((spread, idx) => {
        ScrollTrigger.create({
          trigger: spread,
          start: 'top center',
          end: 'bottom center',
          onEnter: () => setActiveIdx(idx),
          onEnterBack: () => setActiveIdx(idx),
        })

        if (reduced) return

        const frame = spread.querySelector<HTMLElement>('.wpe-spread__frame')
        const img = spread.querySelector<HTMLElement>('.wpe-spread__img')
        const copy = spread.querySelector<HTMLElement>('.wpe-spread__copy')

        if (frame) {
          gsap.fromTo(
            frame,
            { clipPath: 'inset(10% 0% 10% 0%)', y: 42 },
            {
              clipPath: 'inset(0% 0% 0% 0%)',
              y: -28,
              ease: 'none',
              scrollTrigger: {
                trigger: spread,
                start: 'top bottom',
                end: 'bottom top',
                scrub: 0.75,
              },
            },
          )
        }

        if (img) {
          gsap.fromTo(
            img,
            { scale: 1.09 },
            {
              scale: 1.0,
              ease: 'none',
              scrollTrigger: {
                trigger: spread,
                start: 'top bottom',
                end: 'center center',
                scrub: 0.75,
              },
            },
          )
        }

        if (copy) {
          gsap.fromTo(
            copy,
            { y: 36 },
            {
              y: -36,
              ease: 'none',
              scrollTrigger: {
                trigger: spread,
                start: 'top bottom',
                end: 'bottom top',
                scrub: 0.65,
              },
            },
          )
        }
      })
    },
    { scope: rootRef },
  )

  const jumpToSpread = (idx: number) => {
    const el = document.getElementById(`wp-spread-${PRINTS[idx].key}`)
    el?.scrollIntoView({ behavior: 'smooth' })
  }

  const fullscreenItem = fullscreenIdx !== null ? PRINTS[fullscreenIdx] : null

  return (
    <div ref={rootRef} className="wpe-root">
      {/* Quiet right-edge exhibition index */}
      <aside className="wpe-rail" aria-label="Jump to wallpaper">
        {PRINTS.map((p, idx) => (
          <button
            key={p.key}
            type="button"
            className={`wpe-rail__btn ${idx === activeIdx ? 'is-active' : ''}`}
            onClick={() => jumpToSpread(idx)}
            aria-label={`Jump to ${p.name} wallpaper`}
          >
            {String(idx + 1).padStart(2, '0')}
          </button>
        ))}
      </aside>

      {/* Monumental Opening Breath */}
      <section className="wpe-intro section" data-aura="#F2EDE4,#E46A8E">
        <h1 className="wpe-intro__title">
          take the colour <em>home.</em>
        </h1>
        <p className="wpe-intro__meta">SIX SHADES · 1290 × 2796</p>
      </section>

      {/* Six Spacious Asymmetric Editorial Print Spreads */}
      {PRINTS.map((p, idx) => (
        <section
          key={p.key}
          id={`wp-spread-${p.key}`}
          className={`wpe-spread ${idx % 2 === 1 ? 'wpe-spread--flip' : ''} section`}
          data-aura={`${p.aura},${p.jelly}`}
        >
          <div className="wpe-spread__inner">
            <button
              type="button"
              className="wpe-spread__frame"
              onClick={() => setFullscreenIdx(idx)}
              aria-label={`Open fullscreen proof for ${p.label}`}
            >
              <img
                src={p.src}
                alt={p.alt}
                width={1290}
                height={2796}
                loading={idx < 2 ? 'eager' : 'lazy'}
                decoding="async"
                className="wpe-spread__img"
              />
            </button>

            <div className="wpe-spread__copy">
              <span className="wpe-spread__num" aria-hidden="true">
                {String(idx + 1).padStart(2, '0')}
              </span>
              <h2 className="wpe-spread__name">
                {p.name.toLowerCase()}. <em>{p.mood}</em>
              </h2>
              <p className="wpe-spread__dim">{p.label}</p>
              <div className="wpe-spread__actions">
                <a
                  className="wpe-spread__download"
                  href={p.src}
                  download={`mochi-${p.key}-1290x2796.png`}
                >
                  ↓ DOWNLOAD 1290 × 2796
                </a>
                <button
                  type="button"
                  className="wpe-spread__fullscreen"
                  onClick={() => setFullscreenIdx(idx)}
                >
                  FULLSCREEN ↗
                </button>
              </div>
            </div>
          </div>
        </section>
      ))}

      {/* Spacious Closing Breath */}
      <section className="wpe-outro section" data-aura="#F2EDE4,#2FA4A8">
        <p className="wpe-outro__eyebrow">CONTINUE</p>
        <button type="button" className="wpe-outro__link" onClick={() => onNavigate('flavours')}>
          explore six <em>moods.</em>
        </button>
        <div className="wpe-outro__sublinks">
          <button type="button" onClick={() => onNavigate('bag')}>
            OPEN BAG →
          </button>
          <button type="button" onClick={() => onNavigate('home')}>
            BACK TO MOCHI
          </button>
        </div>
      </section>

      {fullscreenItem &&
        createPortal(
          <div
            className="wp-proof"
            role="dialog"
            aria-modal="true"
            aria-label={fullscreenItem.label}
            onClick={() => setFullscreenIdx(null)}
          >
            <div className="wp-proof__bar" onClick={e => e.stopPropagation()}>
              <span className="wp-proof__label">{fullscreenItem.label}</span>
              <button type="button" className="wp-proof__close" onClick={() => setFullscreenIdx(null)}>
                CLOSE
              </button>
            </div>
            <button
              type="button"
              className="wp-proof__arrow wp-proof__arrow--prev"
              onClick={e => {
                e.stopPropagation()
                setFullscreenIdx(i => (i === null ? 0 : (i - 1 + PRINTS.length) % PRINTS.length))
              }}
              aria-label="Previous wallpaper"
            >
              ←
            </button>
            <div className="wp-proof__stage" onClick={e => e.stopPropagation()}>
              <div className="wp-proof__frame">
                <img
                  src={fullscreenItem.src}
                  alt={fullscreenItem.alt}
                  width={1290}
                  height={2796}
                  className="wp-proof__img"
                />
              </div>
              <a
                className="wp-proof__download"
                href={fullscreenItem.src}
                download={`mochi-${fullscreenItem.key}-1290x2796.png`}
              >
                ↓ DOWNLOAD 1290 × 2796
              </a>
            </div>
            <button
              type="button"
              className="wp-proof__arrow wp-proof__arrow--next"
              onClick={e => {
                e.stopPropagation()
                setFullscreenIdx(i => (i === null ? 0 : (i + 1) % PRINTS.length))
              }}
              aria-label="Next wallpaper"
            >
              →
            </button>
          </div>,
          document.body,
        )}
    </div>
  )
}
