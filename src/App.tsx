import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import Lenis from 'lenis'
import { luxuryPiano } from './audio/luxuryPiano'
import { flavours, type Flavour } from './brand'
import PhysicsBelief from './components/Belief'
import CampaignGallery from './components/CampaignGallery'
import GlobalAuraCanvas from './components/GlobalAura'
import PhysicsHero from './components/Hero'
import InteractiveTube from './components/InteractiveTube'
import SoftTicker from './components/SoftTicker'
import WallpapersSection from './components/WallpapersSection'
import BagPage from './pages/BagPage'
import FlavoursPage from './pages/FlavoursPage'
import WallpapersPage from './pages/WallpapersPage'
import { PointerHistory, clamp, createSpring, projectMomentum, rubberBand } from './physics'

gsap.registerPlugin(ScrollTrigger, useGSAP)

export type RouteId = 'home' | 'flavours' | 'wallpapers' | 'bag'

const ROUTE_TITLES: Record<RouteId, string> = {
  home: 'mochi.',
  flavours: 'six moods.',
  wallpapers: 'take the colour home.',
  bag: 'your bag.',
}

function readHashRoute(): RouteId {
  if (typeof window === 'undefined') return 'home'
  const h = window.location.hash.replace(/^#\/?/, '').toLowerCase()
  if (h === 'flavours' || h === 'wallpapers' || h === 'bag') return h
  return 'home'
}

const FlavourContext = createContext({ flavour: flavours[0], setFlavour: (_: Flavour) => {} })
const useFlavour = () => useContext(FlavourContext)

function Preloader({ done, onDone }: { done: boolean; onDone: () => void }) {
  const [count, setCount] = useState(0)
  const [assetsReady, setAssetsReady] = useState(false)
  const [unmounted, setUnmounted] = useState(false)

  useEffect(() => {
    const isMob = window.matchMedia('(max-width: 767px)').matches
    const sources = [
      isMob ? '/media/hero-seq-1920/poster-mob.webp' : '/media/hero-seq-1920/poster.webp',
      '/media/cutouts/mochi-cherry.webp',
      '/media/photos/mochi-peach-model.webp',
      '/media/campaign/mochi-campaign-01-720.webp',
    ]
    let complete = 0
    const finish = () => {
      complete += 1
      if (complete >= sources.length) setAssetsReady(true)
    }
    sources.forEach(source => {
      const image = new Image()
      image.onload = finish
      image.onerror = finish
      image.src = source
    })
    const cap = window.setTimeout(() => setAssetsReady(true), 800)
    return () => {
      complete = sources.length
      window.clearTimeout(cap)
    }
  }, [])

  useEffect(() => {
    let value = 0
    const timer = window.setInterval(() => {
      value = Math.min(100, value + 10)
      setCount(value)
      if (value >= 100 && assetsReady) {
        window.clearInterval(timer)
        window.setTimeout(onDone, 140)
      }
    }, 16)
    return () => window.clearInterval(timer)
  }, [assetsReady, onDone])

  useEffect(() => {
    if (!done) return
    const timer = window.setTimeout(() => setUnmounted(true), 320)
    return () => window.clearTimeout(timer)
  }, [done])

  if (unmounted) return null

  return (
    <div className={`preloader ${done ? 'preloader--done' : ''}`} aria-hidden={done}>
      <div className="preloader__word">MOCHI</div>
      <span className="micro preloader__count">{String(count).padStart(3, '0')}</span>
    </div>
  )
}

function Header({
  bag,
  light,
  route,
  soundOn,
  onToggleSound,
  onNavigate,
}: {
  bag: number
  light: boolean
  route: RouteId
  soundOn: boolean
  onToggleSound: () => void
  onNavigate: (next: RouteId) => void
}) {
  return (
    <header className={`site-nav ${light ? 'site-nav--light' : ''}`}>
      <button
        type="button"
        className={`nav-brand ${route === 'home' ? 'is-route-active' : ''}`}
        onClick={() => onNavigate('home')}
        aria-label="MOCHI Home"
      >
        MOCHI
      </button>
      <nav className="nav-links" aria-label="MOCHI">
        <button
          type="button"
          className={route === 'flavours' ? 'is-route-active' : ''}
          aria-current={route === 'flavours' ? 'page' : undefined}
          onClick={() => onNavigate('flavours')}
        >
          {route === 'flavours' ? '[ FLAVOURS ]' : 'FLAVOURS'}
        </button>
        <button
          type="button"
          className={route === 'wallpapers' ? 'is-route-active' : ''}
          aria-current={route === 'wallpapers' ? 'page' : undefined}
          onClick={() => onNavigate('wallpapers')}
        >
          {route === 'wallpapers' ? '[ WALLPAPERS ]' : 'WALLPAPERS'}
        </button>
        <button
          type="button"
          className={`bag ${route === 'bag' ? 'is-route-active' : ''}`}
          aria-current={route === 'bag' ? 'page' : undefined}
          aria-label={`Open bag (${bag} items)`}
          onClick={() => onNavigate('bag')}
        >
          {route === 'bag' ? `[ BAG (${bag}) ]` : `BAG (${bag})`}
        </button>
        <button
          type="button"
          className={`sound-toggle ${soundOn ? 'is-on' : ''}`}
          onClick={onToggleSound}
          aria-pressed={soundOn}
          aria-label={soundOn ? 'Mute luxury background piano' : 'Play luxury background piano'}
        >
          <span className="sound-bars" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>{soundOn ? 'SOUND' : 'MUTE'}</span>
        </button>
      </nav>
    </header>
  )
}

function Flavours({
  onAddFlavour,
  onOpenFlavoursPage,
  onScrollToY,
}: {
  onAddFlavour: (item: Flavour) => void
  onOpenFlavoursPage: () => void
  onScrollToY: (y: number) => void
}) {
  const { flavour, setFlavour } = useFlavour()
  const [index, setIndex] = useState(0)
  const [addedKey, setAddedKey] = useState<string | null>(null)
  const sectionRef = useRef<HTMLElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<ScrollTrigger | null>(null)

  useEffect(() => {
    setFlavour(flavours[index])
  }, [index, setFlavour])

  useGSAP(
    () => {
      const section = sectionRef.current
      const track = trackRef.current
      if (!section || !track) return
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const isMobile = window.matchMedia('(max-width: 767px)').matches
      if (reduced || isMobile) return

      const ctx = gsap.context(() => {
        const panels = gsap.utils.toArray<HTMLElement>('.flavour-panel', track)
        const totalMove = () => -(flavours.length - 1) * window.innerWidth

        // Restored smooth 3D depth parallax + crisp snap so every flavour lands dead-center
        const horizontal = gsap.to(track, {
          x: totalMove,
          ease: 'none',
          scrollTrigger: {
            trigger: section,
            start: 'top top',
            end: () => `+=${Math.round(window.innerHeight * 3.8)}`,
            scrub: 0.85,
            pin: true,
            pinSpacing: true,
            anticipatePin: 1,
            snap: {
              snapTo: 1 / (flavours.length - 1),
              duration: { min: 0.22, max: 0.5 },
              delay: 0.06,
              ease: 'power2.out',
            },
            invalidateOnRefresh: true,
            onUpdate: self => {
              const next = Math.min(flavours.length - 1, Math.round(self.progress * (flavours.length - 1)))
              setIndex(prev => (prev === next ? prev : next))
            },
          },
        })
        triggerRef.current = horizontal.scrollTrigger ?? null

        panels.forEach(panel => {
          const word = panel.querySelector<HTMLElement>('.flavour-panel__name')
          const stage = panel.querySelector<HTMLElement>('.flavour-tube-wrap')
          if (word) {
            gsap.fromTo(
              word,
              { xPercent: -9 },
              {
                xPercent: 9,
                ease: 'none',
                scrollTrigger: {
                  trigger: panel,
                  containerAnimation: horizontal,
                  start: 'left right',
                  end: 'right left',
                  scrub: true,
                },
              },
            )
          }
          if (stage) {
            gsap.fromTo(
              stage,
              { xPercent: 5, rotate: -2.2, scale: 0.94 },
              {
                xPercent: -5,
                rotate: 2.2,
                scale: 1.03,
                ease: 'none',
                scrollTrigger: {
                  trigger: panel,
                  containerAnimation: horizontal,
                  start: 'left right',
                  end: 'right left',
                  scrub: true,
                },
              },
            )
          }
        })
      }, sectionRef)

      return () => {
        triggerRef.current = null
        ctx.revert()
      }
    },
    { scope: sectionRef },
  )

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    const mq = window.matchMedia('(max-width: 767px)')
    const onScroll = () => {
      if (!mq.matches) return
      const next = clamp(Math.round(section.scrollLeft / Math.max(1, window.innerWidth)), 0, flavours.length - 1)
      setIndex(prev => (prev === next ? prev : next))
    }
    section.addEventListener('scroll', onScroll, { passive: true })
    return () => section.removeEventListener('scroll', onScroll)
  }, [])

  const selectFlavour = (dotIndex: number, item: Flavour) => {
    setIndex(dotIndex)
    setFlavour(item)
    const st = triggerRef.current
    if (st) {
      const targetY = st.start + (dotIndex / Math.max(1, flavours.length - 1)) * (st.end - st.start)
      onScrollToY(targetY)
    } else if (sectionRef.current && window.matchMedia('(max-width: 767px)').matches) {
      sectionRef.current.scrollTo({ left: dotIndex * window.innerWidth, behavior: 'smooth' })
    }
  }

  return (
    <section
      id="flavours"
      className="flavours section"
      ref={sectionRef}
      data-aura="#F2EDE4,#F2EDE4"
      style={{ '--active-aura': flavour.aura } as React.CSSProperties}
    >
      <div className="flavours__track" ref={trackRef}>
        {flavours.map(item => (
          <article
            className="flavour-panel"
            key={item.key}
            style={{ '--jelly': item.jelly, '--aura': item.aura } as React.CSSProperties}
          >
            <span className="flavour-panel__name" aria-hidden="true">
              {item.name}
            </span>
            <div className="flavour-tube-wrap">
              <InteractiveTube item={item} />
            </div>
            <div className="flavour-panel__footer">
              <p className="flavour-panel__mood">
                {item.name.toLowerCase()} — <em>{item.mood}</em>
              </p>
              <div className="flavour-panel__ctas">
                <button
                  type="button"
                  className="add-pill"
                  onClick={() => {
                    onAddFlavour(item)
                    setFlavour(item)
                    setAddedKey(item.key)
                    window.setTimeout(() => setAddedKey(prev => (prev === item.key ? null : prev)), 900)
                  }}
                >
                  {addedKey === item.key ? 'ADDED ✓' : '+ ADD TO BAG'}
                </button>
                <button type="button" className="add-pill add-pill--ghost" onClick={onOpenFlavoursPage}>
                  STUDIO ↗
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="flavour-dots" role="tablist" aria-label="FLAVOURS">
        {flavours.map((item, dotIndex) => (
          <button
            type="button"
            role="tab"
            aria-selected={dotIndex === index}
            key={item.key}
            className={dotIndex === index ? 'active' : ''}
            onClick={() => selectFlavour(dotIndex, item)}
            aria-label={`${item.name} · ${item.mood}`}
          >
            {item.name}
          </button>
        ))}
      </div>
    </section>
  )
}

function Texture() {
  const sectionRef = useRef<HTMLElement>(null)
  const photoRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const lensRef = useRef<HTMLDivElement>(null)
  const lineRef = useRef<HTMLParagraphElement>(null)
  const target = useRef({ x: 0, y: 0, ready: false })
  const current = useRef({ x: 0, y: 0 })
  const [active, setActive] = useState(false)

  // Dramatic scroll-driven window expansion: starts as a compact framed studio square and expands to 100vw full-bleed
  useGSAP(
    () => {
      const section = sectionRef.current
      const photo = photoRef.current
      const img = imgRef.current
      const line = lineRef.current
      if (!section || !photo || !img) return
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (reduced) return

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: 'top 92%',
          end: 'center 42%',
          scrub: 0.65,
        },
      })

      tl.fromTo(
        photo,
        { clipPath: 'inset(28% 32% 28% 32%)', y: 48 },
        { clipPath: 'inset(0% 0% 0% 0%)', y: 0, ease: 'power1.out' },
        0,
      ).fromTo(img, { scale: 1.38 }, { scale: 1.0, ease: 'power1.out' }, 0)

      if (line) {
        tl.fromTo(line, { y: 34, opacity: 0 }, { y: 0, opacity: 1, ease: 'none' }, 0.58)
      }

      return () => {
        tl.scrollTrigger?.kill()
        tl.kill()
      }
    },
    { scope: sectionRef },
  )

  // Restored compact ROUND 4K optical magnifying glass (136px, pixel-exact 2.25x cover-math zoom)
  useEffect(() => {
    let frame = 0
    const ZOOM = 2.25
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const tick = () => {
      const box = photoRef.current
      const img = imgRef.current
      const lens = lensRef.current
      if (box && img && lens && target.current.ready) {
        const alpha = reduced ? 1 : 0.22
        current.current.x += (target.current.x - current.current.x) * alpha
        current.current.y += (target.current.y - current.current.y) * alpha

        const boxW = box.clientWidth
        const boxH = box.clientHeight
        const natW = img.naturalWidth || 1200
        const natH = img.naturalHeight || 1500
        const lensSize = lens.offsetWidth || 136

        const coverScale = Math.max(boxW / natW, boxH / natH)
        const coverW = natW * coverScale
        const coverH = natH * coverScale
        const offsetX = (boxW - coverW) * 0.5
        const offsetY = (boxH - coverH) * 0.5

        const imgX = current.current.x - offsetX
        const imgY = current.current.y - offsetY

        const bgW = coverW * ZOOM
        const bgH = coverH * ZOOM
        const bgPosX = lensSize * 0.5 - imgX * ZOOM
        const bgPosY = lensSize * 0.5 - imgY * ZOOM

        lens.style.transform = `translate3d(${(current.current.x - lensSize * 0.5).toFixed(2)}px, ${(current.current.y - lensSize * 0.5).toFixed(2)}px, 0)`
        lens.style.backgroundSize = `${bgW.toFixed(2)}px ${bgH.toFixed(2)}px`
        lens.style.backgroundPosition = `${bgPosX.toFixed(2)}px ${bgPosY.toFixed(2)}px`
      }
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  const updatePointer = (event: React.PointerEvent<HTMLElement>, snap = false) => {
    const box = photoRef.current
    if (!box) return
    const rect = box.getBoundingClientRect()
    const x = clamp(event.clientX - rect.left, 0, rect.width)
    const y = clamp(event.clientY - rect.top, 0, rect.height)
    target.current = { x, y, ready: true }
    if (snap) {
      current.current = { x, y }
    }
  }

  return (
    <section
      ref={sectionRef}
      id="texture"
      className="texture section"
      data-aura="#8FC3E6,#F4A27E"
      data-nav-theme="light"
      onPointerMove={e => updatePointer(e, false)}
      onPointerEnter={e => {
        updatePointer(e, true)
        setActive(true)
      }}
      onPointerLeave={() => setActive(false)}
    >
      <div ref={photoRef} className="texture__photo">
        <img
          ref={imgRef}
          src="/media/photos/mochi-peach-model.webp"
          alt="MOCHI peach lip jelly in use"
          loading="eager"
          decoding="async"
          onError={event => {
            event.currentTarget.style.display = 'none'
          }}
        />
        <div className="texture__fallback" />
        <div ref={lensRef} className={`texture__lens ${active ? 'texture__lens--active' : ''}`} aria-hidden="true" />
      </div>
      <p ref={lineRef} className="texture__line">
        real lips. <em>real gloss.</em>
      </p>
    </section>
  )
}

function Stand() {
  const [turn, setTurn] = useState(0)
  const spring = useRef(createSpring('heavy'))
  const history = useRef(new PointerHistory())
  const drag = useRef({ active: false, lastX: 0 })
  const frame = useRef(0)

  useEffect(() => {
    let previous = performance.now()
    const tick = (time: number) => {
      const delta = Math.min(0.05, Math.max(0, (time - previous) / 1000))
      previous = time
      setTurn(spring.current.step(delta))
      if (drag.current.active || !spring.current.atRest()) frame.current = requestAnimationFrame(tick)
      else frame.current = 0
    }
    const wake = () => {
      if (!frame.current) {
        previous = performance.now()
        frame.current = requestAnimationFrame(tick)
      }
    }
    const scene = document.querySelector<HTMLElement>('#stand .stand__bleed')
    scene?.addEventListener('pointermove', wake)
    return () => {
      scene?.removeEventListener('pointermove', wake)
      if (frame.current) cancelAnimationFrame(frame.current)
    }
  }, [])

  const boundTurn = (value: number) =>
    value < -24 ? -24 - rubberBand(-24 - value, 24) : value > 24 ? 24 + rubberBand(value - 24, 24) : value

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    drag.current = { active: true, lastX: event.clientX }
    spring.current.setTarget(spring.current.value)
    history.current.reset()
    history.current.add(event.clientX, event.clientY)
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const moveDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current.active) return
    const delta = event.clientX - drag.current.lastX
    drag.current.lastX = event.clientX
    history.current.add(event.clientX, event.clientY)
    spring.current.setTarget(boundTurn(spring.current.target + delta * 0.25))
    spring.current.setVelocity(history.current.velocity().x * 0.25)
  }
  const finishDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current.active) return
    drag.current.active = false
    const velocity = history.current.velocity().x * 0.25
    history.current.reset()
    spring.current.setTarget(clamp(projectMomentum(spring.current.value, velocity), -24, 24))
    spring.current.setVelocity(velocity)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  return (
    <section id="stand" className="stand section" data-aura="#8FC3E6,#F2EDE4">
      <div
        className="stand__bleed"
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
      >
        <img
          className="stand__image"
          src="/media/photos/mochi-blob-stand.webp"
          alt="MOCHI stand with all six lip jelly shades"
          loading="lazy"
          decoding="async"
          draggable={false}
          style={{ transform: `perspective(1400px) rotateY(${turn.toFixed(2)}deg)` }}
        />
      </div>
      <div className="stand__copy">
        <p className="display">the stand.</p>
        <p>a soft home for all six.</p>
      </div>
    </section>
  )
}

function Footer() {
  const wordRef = useRef<HTMLDivElement>(null)
  const targetRef = useRef({ x: 50, y: 50, active: false })
  const currRef = useRef({ x: 50, y: 50, radius: 0 })

  useEffect(() => {
    const el = wordRef.current
    if (!el) return
    let raf = 0
    let disposed = false

    const tick = () => {
      if (disposed) return
      const t = targetRef.current
      const c = currRef.current
      c.x += (t.x - c.x) * 0.16
      c.y += (t.y - c.y) * 0.16
      const targetR = t.active ? 1 : 0
      c.radius += (targetR - c.radius) * 0.12

      el.style.setProperty('--fx', `${c.x.toFixed(2)}%`)
      el.style.setProperty('--fy', `${c.y.toFixed(2)}%`)
      el.style.setProperty('--fstrength', c.radius.toFixed(4))

      if (t.active || c.radius > 0.005) {
        raf = requestAnimationFrame(tick)
      } else {
        raf = 0
      }
    }

    const wake = () => {
      if (!raf && !disposed) raf = requestAnimationFrame(tick)
    }

    const onMove = (event: PointerEvent) => {
      const rect = el.getBoundingClientRect()
      if (rect.width < 1 || rect.height < 1) return
      targetRef.current = {
        x: ((event.clientX - rect.left) / rect.width) * 100,
        y: ((event.clientY - rect.top) / rect.height) * 100,
        active: true,
      }
      wake()
    }

    const onLeave = () => {
      targetRef.current.active = false
      wake()
    }

    el.addEventListener('pointermove', onMove, { passive: true })
    el.addEventListener('pointerenter', onMove)
    el.addEventListener('pointerleave', onLeave)
    return () => {
      disposed = true
      if (raf) cancelAnimationFrame(raf)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerenter', onMove)
      el.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  return (
    <footer className="footer section" data-aura="#2346B8,#B3122E">
      <div className="footer__center">
        <div ref={wordRef} className="footer__word-wrap" aria-label="MOCHI">
          <div className="footer__word footer__word--base" aria-hidden="true">
            <span>M</span>
            <span>O</span>
            <span>C</span>
            <span>H</span>
            <span>I</span>
          </div>
          <div className="footer__word footer__word--colour" aria-hidden="true">
            <span>M</span>
            <span>O</span>
            <span>C</span>
            <span>H</span>
            <span>I</span>
          </div>
        </div>
        <p className="footer__signoff">squeeze responsibly.</p>
      </div>
      <div className="footer__credits">
        <p className="footer__concept">Concept brand by J&amp;J Intelligence.</p>
        <p className="footer__credit">Studio demo · MOCHI is an invented brand by J&amp;J Intelligence. Not a real product.</p>
      </div>
    </footer>
  )
}

function PageTransitionCurtain({ phase, label }: { phase: 'idle' | 'in' | 'out'; label: string }) {
  if (phase === 'idle') return null
  return createPortal(
    <div className={`page-curtain page-curtain--${phase}`} aria-hidden="true">
      <span className="page-curtain__label">{label}</span>
    </div>,
    document.body,
  )
}

function App() {
  const [loaded, setLoaded] = useState(false)
  const [route, setRoute] = useState<RouteId>(() => readHashRoute())
  const [curtainPhase, setCurtainPhase] = useState<'idle' | 'in' | 'out'>('idle')
  const [curtainLabel, setCurtainLabel] = useState('mochi.')
  const [bagItems, setBagItems] = useState<Record<string, number>>({})
  const [soft10, setSoft10] = useState(false)
  const [reduced, setReduced] = useState(false)
  const [navLight, setNavLight] = useState(false)
  const [soundOn, setSoundOn] = useState(false)
  const userMutedRef = useRef(false)
  const [flavour, setFlavour] = useState(flavours[0])
  const lenisRef = useRef<Lenis | null>(null)
  const transitionTimers = useRef<number[]>([])
  const context = useMemo(() => ({ flavour, setFlavour }), [flavour])

  const bagCount = useMemo(() => Object.values(bagItems).reduce((sum, n) => sum + n, 0), [bagItems])

  const addFlavourToBag = useCallback((item: Flavour) => {
    setBagItems(prev => ({ ...prev, [item.key]: (prev[item.key] || 0) + 1 }))
  }, [])

  const updateBagQty = useCallback((key: string, delta: number) => {
    setBagItems(prev => {
      const next = (prev[key] || 0) + delta
      if (next <= 0) {
        const clone = { ...prev }
        delete clone[key]
        return clone
      }
      return { ...prev, [key]: next }
    })
  }, [])

  const clearBag = useCallback(() => setBagItems({}), [])

  // Subscribe to luxury Yamaha C5 piano state + graceful auto-start on first user interaction
  useEffect(() => {
    const unsub = luxuryPiano.subscribe(setSoundOn)
    const unlock = () => {
      if (userMutedRef.current || luxuryPiano.isPlaying()) return
      luxuryPiano.start().catch(() => {})
    }
    window.addEventListener('pointerdown', unlock, { once: true, passive: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      unsub()
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  const toggleSound = useCallback(() => {
    if (luxuryPiano.isPlaying()) {
      userMutedRef.current = true
      luxuryPiano.stop()
    } else {
      userMutedRef.current = false
      luxuryPiano.start().catch(() => {})
    }
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(media.matches)
    const handle = () => setReduced(media.matches)
    media.addEventListener('change', handle)
    return () => media.removeEventListener('change', handle)
  }, [])

  useEffect(() => {
    document.documentElement.style.setProperty('--jelly', flavour.jelly)
    document.documentElement.style.setProperty('--aura', flavour.aura)
  }, [flavour])

  // Sync browser back/forward hash changes cleanly with Lenis + ScrollTrigger
  useEffect(() => {
    const onHash = () => {
      const next = readHashRoute()
      ScrollTrigger.getAll().forEach(st => st.kill())
      lenisRef.current?.scrollTo(0, { immediate: true })
      window.scrollTo(0, 0)
      setRoute(next)
      setNavLight(false)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // Creative minimalist vertical shutter curtain page navigation
  const navigate = useCallback(
    (next: RouteId, opts?: { applySoft10?: boolean }) => {
      if (opts?.applySoft10) setSoft10(true)
      if (next === route) {
        if (lenisRef.current && !reduced) lenisRef.current.scrollTo(0, { duration: 0.9 })
        else window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })
        return
      }

      transitionTimers.current.forEach(t => window.clearTimeout(t))
      transitionTimers.current = []

      const targetHash = next === 'home' ? '#/' : `#/${next}`
      if (reduced) {
        ScrollTrigger.getAll().forEach(st => st.kill())
        setRoute(next)
        window.history.pushState(null, '', targetHash)
        window.scrollTo(0, 0)
        return
      }

      setCurtainLabel(ROUTE_TITLES[next])
      setCurtainPhase('in')

      const t1 = window.setTimeout(() => {
        ScrollTrigger.getAll().forEach(st => st.kill())
        lenisRef.current?.scrollTo(0, { immediate: true })
        window.scrollTo(0, 0)
        setRoute(next)
        window.history.pushState(null, '', targetHash)
        setNavLight(false)
        setCurtainPhase('out')
      }, 270)

      const t2 = window.setTimeout(() => {
        setCurtainPhase('idle')
        lenisRef.current?.resize()
        ScrollTrigger.refresh()
      }, 630)

      transitionTimers.current = [t1, t2]
    },
    [route, reduced],
  )

  useEffect(() => {
    return () => {
      transitionTimers.current.forEach(t => window.clearTimeout(t))
    }
  }, [])

  // Switch nav to crisp white over #texture on Home
  useEffect(() => {
    if (route !== 'home') {
      setNavLight(false)
      return
    }
    const checkNavTheme = () => {
      const darkSections = Array.from(document.querySelectorAll<HTMLElement>('[data-nav-theme="light"]'))
      const navY = 36
      const overDark = darkSections.some(el => {
        const rect = el.getBoundingClientRect()
        return rect.top <= navY && rect.bottom >= navY
      })
      setNavLight(prev => (prev === overDark ? prev : overDark))
    }

    checkNavTheme()
    window.addEventListener('scroll', checkNavTheme, { passive: true })
    window.addEventListener('resize', checkNavTheme, { passive: true })
    return () => {
      window.removeEventListener('scroll', checkNavTheme)
      window.removeEventListener('resize', checkNavTheme)
    }
  }, [route])

  // Smooth Lenis scroll across Home AND dedicated Flavours / Wallpapers / Bag pages
  useEffect(() => {
    if (reduced) return
    const lenis = new Lenis({
      duration: 1.12,
      smoothWheel: true,
      syncTouch: false,
      wheelMultiplier: 0.92,
      autoResize: true,
    })
    lenisRef.current = lenis
    const update = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(update)
    gsap.ticker.lagSmoothing(0)
    lenis.on('scroll', ScrollTrigger.update)

    const onResize = () => {
      lenis.resize()
      ScrollTrigger.refresh()
    }
    window.addEventListener('resize', onResize, { passive: true })

    // Ensure ScrollTrigger syncs cleanly after DOM settles for the newly mounted route
    const refreshTimer = window.setTimeout(() => {
      lenis.resize()
      ScrollTrigger.refresh()
    }, 240)

    return () => {
      window.clearTimeout(refreshTimer)
      window.removeEventListener('resize', onResize)
      gsap.ticker.remove(update)
      lenis.destroy()
      lenisRef.current = null
    }
  }, [reduced, route])

  const scrollToY = useCallback(
    (y: number) => {
      if (lenisRef.current && !reduced) {
        lenisRef.current.scrollTo(y, { duration: 1.0 })
      } else {
        window.scrollTo({ top: y, behavior: reduced ? 'auto' : 'smooth' })
      }
    },
    [reduced],
  )

  useEffect(() => {
    if (loaded) {
      document.body.classList.add('is-ready')
      window.setTimeout(() => ScrollTrigger.refresh(), 160)
    }
  }, [loaded, route])

  const jumpOnHome = (id: string) => {
    const el = document.getElementById(id)
    const target = (el?.closest('.pin-spacer') as HTMLElement | null) || el
    if (!target) return
    if (lenisRef.current && !reduced) {
      lenisRef.current.scrollTo(target, { offset: 0, duration: 1.1 })
    } else {
      target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' })
    }
  }

  return (
    <FlavourContext.Provider value={context}>
      <Preloader done={loaded} onDone={() => setLoaded(true)} />
      <PageTransitionCurtain phase={curtainPhase} label={curtainLabel} />
      <div className={`app ${reduced ? 'reduced-motion' : ''}`}>
        <GlobalAuraCanvas activeAura={flavour.aura} activeGlow={flavour.jelly} />
        <Header
          bag={bagCount}
          light={navLight}
          route={route}
          soundOn={soundOn}
          onToggleSound={toggleSound}
          onNavigate={navigate}
        />

        {route === 'home' && (
          <>
            <main>
              <PhysicsHero onJump={jumpOnHome} />
              <div className="shutter-over-hero">
                <PhysicsBelief />
              </div>
              <Flavours
                onAddFlavour={addFlavourToBag}
                onOpenFlavoursPage={() => navigate('flavours')}
                onScrollToY={scrollToY}
              />
              <SoftTicker onOpenBag={() => navigate('bag', { applySoft10: true })} />
              <Texture />
              <CampaignGallery reduced={reduced} />
              <Stand />
              <WallpapersSection />
            </main>
            <Footer />
          </>
        )}

        {route === 'flavours' && (
          <main className="subpage-enter">
            <FlavoursPage
              bagItems={bagItems}
              onAddFlavour={addFlavourToBag}
              onNavigate={navigate}
              onSelectGlobalFlavour={setFlavour}
            />
          </main>
        )}

        {route === 'wallpapers' && (
          <main className="subpage-enter">
            <WallpapersPage onNavigate={navigate} onSelectGlobalFlavour={setFlavour} />
          </main>
        )}

        {route === 'bag' && (
          <main className="subpage-enter">
            <BagPage
              bagItems={bagItems}
              soft10={soft10}
              onToggleSoft10={() => setSoft10(v => !v)}
              onUpdateQty={updateBagQty}
              onAddFlavour={addFlavourToBag}
              onClearBag={clearBag}
              onNavigate={navigate}
            />
          </main>
        )}
      </div>
    </FlavourContext.Provider>
  )
}

export default App
