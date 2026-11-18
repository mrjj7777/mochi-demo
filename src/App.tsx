import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import Lenis from 'lenis'
import { flavours, wallpaperFileSize, type Flavour } from './brand'
import PhysicsBelief from './components/Belief'
import GlobalAuraCanvas from './components/GlobalAura'
import PhysicsHero from './components/Hero'
import { PointerHistory, clamp, createSpring, projectMomentum, rubberBand } from './physics'

gsap.registerPlugin(ScrollTrigger, useGSAP)

const FlavourContext = createContext({ flavour: flavours[0], setFlavour: (_: Flavour) => {} })
const useFlavour = () => useContext(FlavourContext)

function Preloader({ done, onDone }: { done: boolean; onDone: () => void }) {
  const [count, setCount] = useState(0)
  const [assetsReady, setAssetsReady] = useState(false)

  useEffect(() => {
    const sources = [
      '/media/hero-seq-v4/poster.webp',
      '/media/cutouts/mochi-cherry.webp',
      '/media/photos/mochi-peach-model.webp',
      '/media/photos/mochi-model-1.webp',
      '/media/photos/mochi-model-2.webp',
      '/media/photos/mochi-model-3.webp',
      '/media/photos/mochi-model-4.webp',
      '/media/photos/mochi-model-5.webp',
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
    const cap = window.setTimeout(() => setAssetsReady(true), 900)
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
        window.setTimeout(onDone, 180)
      }
    }, 16)
    return () => window.clearInterval(timer)
  }, [assetsReady, onDone])

  return (
    <div className={`preloader ${done ? 'preloader--done' : ''}`} aria-hidden={done}>
      <div className="preloader__dome" />
      <div className="preloader__word">MOCHI</div>
      <span className="micro preloader__count">{String(count).padStart(3, '0')}</span>
    </div>
  )
}

function Header({ bag, onJump }: { bag: number; onJump: (id: string) => void }) {
  const { setFlavour } = useFlavour()
  return (
    <header className="site-nav">
      <button className="nav-brand" onClick={() => onJump('hero')} aria-label="MOCHI">
        MOCHI
      </button>
      <nav className="nav-links" aria-label="MOCHI">
        <button
          onClick={() => {
            setFlavour(flavours[0])
            onJump('flavours')
          }}
        >
          FLAVOURS
        </button>
        <button onClick={() => onJump('wallpapers')}>WALLPAPERS</button>
        <span className="bag" aria-label={`bag ${bag}`}>
          BAG ({bag})
        </span>
      </nav>
    </header>
  )
}

function Flavours({ bag, setBag }: { bag: number; setBag: (value: number) => void }) {
  const { flavour, setFlavour } = useFlavour()
  const [index, setIndex] = useState(0)
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
      const isMobile = window.matchMedia('(max-width: 700px)').matches
      if (reduced || isMobile) return

      const ctx = gsap.context(() => {
        const panels = gsap.utils.toArray<HTMLElement>('.flavour-panel', track)
        const totalMove = () => -(flavours.length - 1) * window.innerWidth

        const horizontal = gsap.to(track, {
          x: totalMove,
          ease: 'none',
          scrollTrigger: {
            trigger: section,
            start: 'top top',
            end: () => `+=${flavours.length * 95}%`,
            scrub: 0.9,
            pin: true,
            snap: {
              snapTo: 1 / (flavours.length - 1),
              duration: { min: 0.2, max: 0.55 },
              delay: 0.08,
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

        // Subtle editorial depth parallax: giant wordmark glides BEHIND while crisp product stays IN FRONT
        panels.forEach(panel => {
          const word = panel.querySelector<HTMLElement>('.flavour-panel__name')
          const photo = panel.querySelector<HTMLElement>('.flavour-panel__image')
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
          if (photo) {
            gsap.fromTo(
              photo,
              { xPercent: 4, rotate: -1.8 },
              {
                xPercent: -4,
                rotate: 1.8,
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

  const selectFlavour = (dotIndex: number, item: Flavour) => {
    setIndex(dotIndex)
    setFlavour(item)
    const st = triggerRef.current
    if (st) {
      const targetY = st.start + (dotIndex / Math.max(1, flavours.length - 1)) * (st.end - st.start)
      window.scrollTo({ top: targetY, behavior: 'smooth' })
    } else if (sectionRef.current && window.matchMedia('(max-width: 700px)').matches) {
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
            <img
              className="flavour-panel__image"
              src={`/media/cutouts/mochi-${item.asset}.webp`}
              alt={`${item.name} lip jelly`}
              loading="eager"
              decoding="async"
            />
            <div className="flavour-panel__footer">
              <p className="flavour-panel__mood">
                {item.name.toLowerCase()} — <em>{item.mood}</em>
              </p>
              <button
                type="button"
                className="add-pill"
                onClick={() => {
                  setBag(bag + 1)
                  setFlavour(item)
                }}
              >
                + ADD TO BAG
              </button>
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

const photoNames = [
  'mochi-model-1.webp',
  'mochi-peach-model.webp',
  'mochi-model-4.webp',
  'mochi-model-3.webp',
  'mochi-model-2.webp',
  'mochi-model-5.webp',
]

function Texture() {
  const photoRef = useRef<HTMLDivElement>(null)
  const lensRef = useRef<HTMLDivElement>(null)
  const target = useRef({ x: 50, y: 50 })
  const current = useRef({ x: 50, y: 50 })
  const [active, setActive] = useState(false)

  useEffect(() => {
    let frame = 0
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const tick = () => {
      current.current.x += (target.current.x - current.current.x) * (reduced ? 1 : 0.12)
      current.current.y += (target.current.y - current.current.y) * (reduced ? 1 : 0.12)
      if (lensRef.current) {
        lensRef.current.style.setProperty('--lens-x', `${current.current.x}%`)
        lensRef.current.style.setProperty('--lens-y', `${current.current.y}%`)
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  const moveLens = (event: React.PointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    target.current = {
      x: ((event.clientX - rect.left) / rect.width) * 100,
      y: ((event.clientY - rect.top) / rect.height) * 100,
    }
  }

  return (
    <section
      id="texture"
      className="texture section"
      data-aura="#8FC3E6,#F4A27E"
      onPointerMove={moveLens}
      onPointerEnter={() => setActive(true)}
      onPointerLeave={() => setActive(false)}
    >
      <div ref={photoRef} className="texture__photo">
        <img
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
      <p className="texture__line">
        real lips. <em>real gloss.</em>
      </p>
    </section>
  )
}

const STACK_TILTS = [-2.4, 1.9, -1.4, 2.2, -1.8, 0]

function Lookbook({ onOpen, reduced }: { onOpen: (src: string, flavour: Flavour) => void; reduced: boolean }) {
  const sectionRef = useRef<HTMLElement>(null)
  const pinRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [flashKey, setFlashKey] = useState(0)
  const [progress, setProgress] = useState(0)
  const lastIndexRef = useRef(0)

  useGSAP(
    () => {
      const section = sectionRef.current
      const pin = pinRef.current
      if (!section || !pin || reduced) return

      const isMobile = window.matchMedia('(max-width: 700px)').matches
      const trigger = ScrollTrigger.create({
        trigger: section,
        start: 'top top',
        end: () => `+=${Math.round(window.innerHeight * (isMobile ? 2.5 : 3.4))}`,
        pin: true,
        pinSpacing: true,
        anticipatePin: 1,
        scrub: true,
        invalidateOnRefresh: true,
        onUpdate: self => {
          const p = self.progress
          setProgress(p)
          const idx = Math.min(photoNames.length - 1, Math.floor(p * photoNames.length * 0.999))
          if (idx !== lastIndexRef.current) {
            lastIndexRef.current = idx
            setActiveIndex(idx)
            setFlashKey(k => k + 1)
          }
        },
      })
      return () => trigger.kill()
    },
    { scope: sectionRef, dependencies: [reduced] },
  )

  if (reduced) {
    return (
      <section id="lookbook" ref={sectionRef} className="lookbook lookbook--reduced section" data-aura="#F2EDE4,#F6D3D6">
        <div className="lookbook__head">
          <p className="display">
            worn by <em>everyone.</em>
          </p>
        </div>
        <div className="lookbook__static-grid">
          {photoNames.map((src, idx) => {
            const item = flavours[idx % flavours.length]
            return (
              <button
                type="button"
                key={src}
                className="lookbook__static-card"
                onClick={() => onOpen(`/media/photos/${src}`, item)}
                aria-label={`Open ${item.name} lookbook photograph`}
              >
                <img src={`/media/photos/${src}`} alt={`${item.name} lookbook`} loading="eager" decoding="async" />
              </button>
            )
          })}
        </div>
      </section>
    )
  }

  return (
    <section id="lookbook" ref={sectionRef} className="lookbook lookbook--pinned section" data-aura="#F2EDE4,#F6D3D6">
      <div ref={pinRef} className="lookbook__pin">
        <div className="lookbook__layout">
          <div className="lookbook__head">
            <p className="display">
              worn by <em>everyone.</em>
            </p>
          </div>

          <div className="lookbook__stage">
            {photoNames.map((src, idx) => {
              const item = flavours[idx % flavours.length]
              const isCurrent = idx === activeIndex
              const isPast = idx < activeIndex
              const depth = activeIndex - idx
              const tilt = isCurrent ? 0 : STACK_TILTS[idx % STACK_TILTS.length]
              const offsetX = isPast ? -depth * 14 : 0
              const offsetY = isPast ? depth * 10 : 28
              const scale = isCurrent ? 1 : isPast ? Math.max(0.88, 1 - depth * 0.032) : 0.96

              return (
                <button
                  type="button"
                  key={src}
                  className={`lookbook__frame ${isCurrent ? 'is-active' : ''} ${isPast ? 'is-past' : 'is-upcoming'}`}
                  style={
                    {
                      zIndex: idx + 1,
                      opacity: isCurrent ? 1 : isPast ? Math.max(0.32, 0.82 - depth * 0.14) : 0,
                      transform: `translate3d(${offsetX}px, ${offsetY}px, 0) scale(${scale.toFixed(3)}) rotate(${tilt}deg)`,
                      pointerEvents: isCurrent ? 'auto' : 'none',
                    } as React.CSSProperties
                  }
                  onClick={() => onOpen(`/media/photos/${src}`, item)}
                  tabIndex={isCurrent ? 0 : -1}
                  aria-label={`Open ${item.name} lookbook photograph`}
                >
                  <div className="lookbook__frame-inner">
                    <img
                      src={`/media/photos/${src}`}
                      alt={`${item.name} lookbook`}
                      loading="eager"
                      decoding="async"
                      className={isCurrent && flashKey > 0 ? 'is-exposed' : ''}
                      key={isCurrent ? `${src}-${flashKey}` : src}
                    />
                    {isCurrent && flashKey > 0 && (
                      <span key={`strobe-${flashKey}`} className="lookbook__strobe" aria-hidden="true" />
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div className="lookbook__rail" aria-hidden="true">
          <span className="lookbook__rail-fill" style={{ transform: `scaleX(${Math.max(0.06, progress)})` }} />
        </div>
      </div>
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
    const scene = document.querySelector<HTMLElement>('#stand .stand__scene')
    scene?.addEventListener('pointermove', wake)
    return () => {
      scene?.removeEventListener('pointermove', wake)
      if (frame.current) cancelAnimationFrame(frame.current)
    }
  }, [])

  const boundTurn = (value: number) =>
    value < -35 ? -35 - rubberBand(-35 - value, 35) : value > 35 ? 35 + rubberBand(value - 35, 35) : value

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
    spring.current.setTarget(boundTurn(spring.current.target + delta * 0.4))
    spring.current.setVelocity(history.current.velocity().x * 0.4)
  }
  const finishDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current.active) return
    drag.current.active = false
    const velocity = history.current.velocity().x * 0.4
    history.current.reset()
    spring.current.setTarget(clamp(projectMomentum(spring.current.value, velocity), -35, 35))
    spring.current.setVelocity(velocity)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  return (
    <section id="stand" className="stand section" data-aura="#8FC3E6,#F2EDE4">
      <div className="stand__copy">
        <p className="display">the stand.</p>
        <p>a soft home for all six.</p>
      </div>
      <div
        className="stand__scene"
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        style={{ transform: `rotateY(${turn}deg)` }}
      >
        <img
          className="stand__image"
          src="/media/photos/mochi-blob-stand.webp"
          alt="MOCHI stand with all six lip jelly shades"
          loading="lazy"
          decoding="async"
        />
      </div>
    </section>
  )
}

function AllSix({ reduced }: { reduced: boolean }) {
  const [nudged, setNudged] = useState(false)
  return (
    <section id="all-six" className="all-six section" data-aura="#E46A8E,#F2B632">
      <div className="all-six__copy">
        <p className="display">all six.</p>
        <p>
          can&apos;t pick? <em>don&apos;t.</em>
        </p>
      </div>
      <button
        type="button"
        className={`pile ${reduced ? 'pile--static' : ''} ${nudged ? 'pile--nudged' : ''}`}
        onClick={() => setNudged(!nudged)}
        aria-label="all six MOCHI shades"
      >
        <img
          className="pile__image"
          src="/media/photos/mochi-all-pile.webp"
          alt="All six MOCHI lip jelly shades"
          loading="lazy"
          decoding="async"
        />
      </button>
    </section>
  )
}

function Wallpapers({ onOpen }: { onOpen: (index: number) => void }) {
  return (
    <section id="wallpapers" className="wallpapers section" data-aura="#2346B8,#F2EDE4">
      <p className="display">take the colour home.</p>
      <div className="wallpaper-fan">
        {flavours.map((item, index) => (
          <article
            className="wallpaper-card"
            key={item.key}
            style={{ '--jelly': item.jelly, '--aura': item.aura, '--i': index } as React.CSSProperties}
          >
            <button
              type="button"
              className="wallpaper-card__open"
              onClick={() => onOpen(index)}
              aria-label={`Preview ${item.name} wallpaper`}
            >
              <div
                className="wallpaper-card__aura"
                style={{ backgroundImage: `url(/media/cutouts/mochi-${item.asset}-aura.webp)` }}
              />
            </button>
            <a
              className="download-pill"
              href={`/media/wallpapers/mochi-${item.asset}-${wallpaperFileSize}.png`}
              download
            >
              ↓ DOWNLOAD
            </a>
          </article>
        ))}
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="footer section" data-aura="#2346B8,#B3122E">
      <div className="footer__word" aria-label="MOCHI">
        <span>M</span>
        <span>O</span>
        <span>C</span>
        <span>H</span>
        <span>I</span>
      </div>
      <p className="footer__signoff">
        <em>squeeze responsibly.</em>
      </p>
      <p className="footer__credit">J&amp;J Intelligence</p>
    </footer>
  )
}

function WallpaperPreview({
  index,
  onClose,
  onChange,
}: {
  index: number | null
  onClose: () => void
  onChange: (next: number) => void
}) {
  const startX = useRef<number | null>(null)
  useEffect(() => {
    if (index === null) return
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowRight') onChange((index + 1) % flavours.length)
      if (event.key === 'ArrowLeft') onChange((index + flavours.length - 1) % flavours.length)
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [index, onChange, onClose])
  if (index === null) return null
  const item = flavours[index]
  return (
    <div
      className="wallpaper-preview"
      role="dialog"
      aria-modal="true"
      aria-label={`${item.name} wallpaper preview`}
      onClick={onClose}
      onPointerDown={event => {
        startX.current = event.clientX
      }}
      onPointerUp={event => {
        if (startX.current !== null && Math.abs(event.clientX - startX.current) > 42) {
          onChange(event.clientX < startX.current ? (index + 1) % flavours.length : (index + flavours.length - 1) % flavours.length)
        }
        startX.current = null
      }}
    >
      <button type="button" className="wallpaper-preview__close" onClick={onClose}>
        CLOSE
      </button>
      <button
        type="button"
        className="wallpaper-preview__arrow wallpaper-preview__arrow--prev"
        onClick={event => {
          event.stopPropagation()
          onChange((index + flavours.length - 1) % flavours.length)
        }}
        aria-label="Previous wallpaper"
      >
        ←
      </button>
      <img src={`/media/wallpapers/mochi-${item.asset}-${wallpaperFileSize}.png`} alt={`${item.name} MOCHI wallpaper`} />
      <button
        type="button"
        className="wallpaper-preview__arrow wallpaper-preview__arrow--next"
        onClick={event => {
          event.stopPropagation()
          onChange((index + 1) % flavours.length)
        }}
        aria-label="Next wallpaper"
      >
        →
      </button>
      <a
        className="wallpaper-preview__download"
        href={`/media/wallpapers/mochi-${item.asset}-${wallpaperFileSize}.png`}
        download
        onClick={event => event.stopPropagation()}
      >
        ↓ DOWNLOAD
      </a>
    </div>
  )
}

function Lightbox({ data, onClose }: { data: { src: string; flavour: Flavour } | null; onClose: () => void }) {
  useEffect(() => {
    if (!data) return
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [data, onClose])
  if (!data) return null
  return (
    <div className="lightbox" role="dialog" aria-modal="true" onClick={onClose}>
      <button type="button" onClick={onClose} aria-label="Close">
        CLOSE
      </button>
      <img
        src={data.src}
        alt={`${data.flavour.name} lip jelly`}
        decoding="async"
        onError={event => {
          event.currentTarget.style.display = 'none'
        }}
      />
    </div>
  )
}

function App() {
  const [loaded, setLoaded] = useState(false)
  const [bag, setBag] = useState(0)
  const [reduced, setReduced] = useState(false)
  const [lightbox, setLightbox] = useState<{ src: string; flavour: Flavour } | null>(null)
  const [wallpaper, setWallpaper] = useState<number | null>(null)
  const [flavour, setFlavour] = useState(flavours[0])
  const context = useMemo(() => ({ flavour, setFlavour }), [flavour])

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

  useEffect(() => {
    if (reduced) return
    const lenis = new Lenis({
      duration: 1.2,
      smoothWheel: true,
      syncTouch: false,
      wheelMultiplier: 0.9,
    })
    const update = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(update)
    gsap.ticker.lagSmoothing(0)
    lenis.on('scroll', ScrollTrigger.update)
    return () => {
      gsap.ticker.remove(update)
      lenis.destroy()
    }
  }, [reduced])

  useEffect(() => {
    if (loaded) {
      document.body.classList.add('is-ready')
      window.setTimeout(() => ScrollTrigger.refresh(), 120)
    }
  }, [loaded])

  const jump = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' })
  }

  return (
    <FlavourContext.Provider value={context}>
      <Preloader done={loaded} onDone={() => setLoaded(true)} />
      <div className={`app ${reduced ? 'reduced-motion' : ''}`}>
        <GlobalAuraCanvas />
        <Header bag={bag} onJump={jump} />
        <main>
          <PhysicsHero onJump={jump} />
          <PhysicsBelief />
          <Flavours bag={bag} setBag={setBag} />
          <Texture />
          <Lookbook reduced={reduced} onOpen={(src, item) => setLightbox({ src, flavour: item })} />
          <Stand />
          <AllSix reduced={reduced} />
          <Wallpapers onOpen={setWallpaper} />
        </main>
        <Footer />
      </div>
      <Lightbox data={lightbox} onClose={() => setLightbox(null)} />
      <WallpaperPreview index={wallpaper} onClose={() => setWallpaper(null)} onChange={setWallpaper} />
    </FlavourContext.Provider>
  )
}

export default App
