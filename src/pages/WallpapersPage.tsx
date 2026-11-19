import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { flavours } from '../brand'
import { PointerHistory, clamp, createSpring, projectMomentum, rubberBand } from '../physics'
import './WallpapersPage.css'

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
  const [activeIdx, setActiveIdx] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)
  const deckRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  const xSpring = useRef(createSpring('heavy', 0))
  const rotSpring = useRef(createSpring('heavy', 0))
  const history = useRef(new PointerHistory(5))
  const drag = useRef({ active: false, startX: 0 })
  const rafRef = useRef(0)

  const active = PRINTS[activeIdx]

  useEffect(() => {
    onSelectGlobalFlavour(flavours[activeIdx])
  }, [activeIdx, onSelectGlobalFlavour])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && fullscreen) setFullscreen(false)
      if (e.key === 'ArrowRight') setActiveIdx(i => (i + 1) % PRINTS.length)
      if (e.key === 'ArrowLeft') setActiveIdx(i => (i - 1 + PRINTS.length) % PRINTS.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fullscreen])

  // Heavy-spring interactive print-proof drag & flick switcher
  useEffect(() => {
    let disposed = false
    let lastNow = performance.now()

    const tick = (now: number) => {
      rafRef.current = 0
      if (disposed) return
      const dt = Math.min(0.05, Math.max(0.001, (now - lastNow) / 1000))
      lastNow = now

      const x = xSpring.current.step(dt)
      const r = rotSpring.current.step(dt)
      if (cardRef.current) {
        cardRef.current.style.transform = `translate3d(${x.toFixed(2)}px, 0, 0) rotate(${r.toFixed(2)}deg)`
      }

      if (drag.current.active || !xSpring.current.atRest(0.05) || !rotSpring.current.atRest(0.02)) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }

    const wake = () => {
      if (!rafRef.current && !disposed) {
        lastNow = performance.now()
        rafRef.current = requestAnimationFrame(tick)
      }
    }

    const deck = deckRef.current
    if (!deck) return

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return
      drag.current = { active: true, startX: e.clientX }
      history.current.reset()
      history.current.add(e.clientX, e.clientY)
      deck.setPointerCapture(e.pointerId)
      wake()
    }

    const onMove = (e: PointerEvent) => {
      if (!drag.current.active) return
      const dx = e.clientX - drag.current.startX
      history.current.add(e.clientX, e.clientY)
      const res = rubberBand(dx, 140)
      xSpring.current.setTarget(res)
      rotSpring.current.setTarget(clamp(res * 0.045, -7, 7))
      wake()
    }

    const onUp = (e: PointerEvent) => {
      if (!drag.current.active) return
      drag.current.active = false
      if (deck.hasPointerCapture(e.pointerId)) deck.releasePointerCapture(e.pointerId)
      const vx = history.current.velocity().x
      const projected = projectMomentum(xSpring.current.value, vx)
      history.current.reset()

      if (projected < -95) {
        setActiveIdx(i => (i + 1) % PRINTS.length)
        xSpring.current.snap(80)
        rotSpring.current.snap(3)
      } else if (projected > 95) {
        setActiveIdx(i => (i - 1 + PRINTS.length) % PRINTS.length)
        xSpring.current.snap(-80)
        rotSpring.current.snap(-3)
      }
      xSpring.current.setTarget(0)
      rotSpring.current.setTarget(0)
      wake()
    }

    deck.addEventListener('pointerdown', onDown)
    deck.addEventListener('pointermove', onMove)
    deck.addEventListener('pointerup', onUp)
    deck.addEventListener('pointercancel', onUp)
    return () => {
      disposed = true
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      deck.removeEventListener('pointerdown', onDown)
      deck.removeEventListener('pointermove', onMove)
      deck.removeEventListener('pointerup', onUp)
      deck.removeEventListener('pointercancel', onUp)
    }
  }, [])

  return (
    <section className="wpp-page" data-aura={`${active.aura},${active.jelly}`}>
      <div className="wpp-top">
        <button type="button" className="wpp-back" onClick={() => onNavigate('home')}>
          ← BACK TO MOCHI
        </button>
        <span className="wpp-eyebrow">PRINT-PROOF DARKROOM — 1290 × 2796 PX</span>
      </div>

      <div className="wpp-grid">
        {/* Left: Interactive Phone Print-Proof Stage with Corner Crop Marks & Flick Physics */}
        <div className="wpp-stage-col">
          <div ref={deckRef} className="wpp-deck" aria-label="Drag or flick left/right to switch wallpaper prints">
            <div ref={cardRef} className="wpp-proof-sheet">
              <span className="wpp-tick wpp-tick--top" aria-hidden="true">
                1290 PX
              </span>
              <span className="wpp-tick wpp-tick--side" aria-hidden="true">
                2796 PX
              </span>
              <div className="wpp-crop-box">
                <img
                  key={active.key}
                  src={active.src}
                  alt={active.alt}
                  width={1290}
                  height={2796}
                  decoding="async"
                  draggable={false}
                  className="wpp-proof-img"
                />
              </div>
            </div>
          </div>

          <div className="wpp-deck-controls">
            <button
              type="button"
              className="wpp-step"
              onClick={() => setActiveIdx(i => (i - 1 + PRINTS.length) % PRINTS.length)}
            >
              ← PREV
            </button>
            <span className="wpp-counter">
              {String(activeIdx + 1).padStart(2, '0')} / 06 — FLICK OR DRAG PRINT
            </span>
            <button
              type="button"
              className="wpp-step"
              onClick={() => setActiveIdx(i => (i + 1) % PRINTS.length)}
            >
              NEXT →
            </button>
          </div>
        </div>

        {/* Right: Contact-Sheet Selector & Direct Downloads */}
        <div className="wpp-info-col">
          <h1 className="wpp-heading">
            take the colour <em>home.</em>
          </h1>
          <p className="wpp-sub">
            six full-resolution phone wallpapers, colour-matched to every drop 01 shade. zero compression, true 1290 × 2796 ratio.
          </p>

          <div className="wpp-thumbs" role="tablist" aria-label="Wallpaper shades">
            {PRINTS.map((p, idx) => (
              <button
                key={p.key}
                type="button"
                role="tab"
                aria-selected={idx === activeIdx}
                className={`wpp-thumb ${idx === activeIdx ? 'is-active' : ''}`}
                onClick={() => setActiveIdx(idx)}
              >
                <img src={p.src} alt={p.alt} width={1290} height={2796} loading="lazy" decoding="async" />
                <span>{p.name}</span>
              </button>
            ))}
          </div>

          <div className="wpp-download-row">
            <span className="wpp-active-label">{active.label}</span>
            <div className="wpp-cta-group">
              <a
                className="wpp-download-btn"
                href={active.src}
                download={`mochi-${active.key}-1290x2796.png`}
              >
                ↓ DOWNLOAD 1290 × 2796
              </a>
              <button type="button" className="wpp-fullscreen-btn" onClick={() => setFullscreen(true)}>
                FULLSCREEN PROOF ↗
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="wpp-bottom">
        <button type="button" className="wpp-crosslink" onClick={() => onNavigate('flavours')}>
          EXPLORE FLAVOUR ATELIER →
        </button>
        <button type="button" className="wpp-crosslink" onClick={() => onNavigate('bag')}>
          OPEN YOUR BAG →
        </button>
      </div>

      {fullscreen &&
        createPortal(
          <div className="wp-proof" role="dialog" aria-modal="true" aria-label={active.label} onClick={() => setFullscreen(false)}>
            <div className="wp-proof__bar" onClick={e => e.stopPropagation()}>
              <span className="wp-proof__label">{active.label}</span>
              <button type="button" className="wp-proof__close" onClick={() => setFullscreen(false)}>
                CLOSE
              </button>
            </div>
            <button
              type="button"
              className="wp-proof__arrow wp-proof__arrow--prev"
              onClick={e => {
                e.stopPropagation()
                setActiveIdx(i => (i - 1 + PRINTS.length) % PRINTS.length)
              }}
              aria-label="Previous wallpaper"
            >
              ←
            </button>
            <div className="wp-proof__stage" onClick={e => e.stopPropagation()}>
              <div className="wp-proof__frame">
                <img src={active.src} alt={active.alt} width={1290} height={2796} className="wp-proof__img" />
              </div>
              <a className="wp-proof__download" href={active.src} download={`mochi-${active.key}-1290x2796.png`}>
                ↓ DOWNLOAD 1290 × 2796
              </a>
            </div>
            <button
              type="button"
              className="wp-proof__arrow wp-proof__arrow--next"
              onClick={e => {
                e.stopPropagation()
                setActiveIdx(i => (i + 1) % PRINTS.length)
              }}
              aria-label="Next wallpaper"
            >
              →
            </button>
          </div>,
          document.body,
        )}
    </section>
  )
}
