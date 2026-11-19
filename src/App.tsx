import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import Lenis from 'lenis'
import { flavours, type Flavour } from './brand'
import PhysicsBelief from './components/Belief'
import BlobjectShowcase, { type GalleryItem } from './components/BlobjectShowcase'
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
      '/media/campaigns/blobject-form.webp',
      '/media/campaigns/pink-noise.webp',
      '/media/photos/mochi-model-1.webp',
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
    const cap = window.setTimeout(() => setAssetsReady(true), 850)
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
        <button onClick={() => onJump('wallpapers')}>ARCHIVE</button>
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
              { xPercent: -8 },
              {
                xPercent: 8,
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

function Texture() {
  const photoRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const lensRef = useRef<HTMLDivElement>(null)
  const target = useRef({ x: 0, y: 0, ready: false })
  const current = useRef({ x: 0, y: 0 })
  const [active, setActive] = useState(false)

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
        const lensSize = lens.offsetWidth || 150

        // Pixel-exact object-fit: cover geometry so the lens magnifies the EXACT pixel under the cursor
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
      id="texture"
      className="texture section"
      data-aura="#8FC3E6,#F4A27E"
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
      <p className="texture__line">
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
      <div className="stand__inner">
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
        <p className="footer__signoff">SQUEEZE RESPONSIBLY.</p>
      </div>
      <p className="footer__credit">J&amp;J Intelligence</p>
    </footer>
  )
}

function GalleryModal({
  state,
  onClose,
  onChange,
}: {
  state: { items: GalleryItem[]; index: number } | null
  onClose: () => void
  onChange: (nextIndex: number) => void
}) {
  const startX = useRef<number | null>(null)
  useEffect(() => {
    if (!state) return
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowRight') onChange((state.index + 1) % state.items.length)
      if (event.key === 'ArrowLeft') onChange((state.index + state.items.length - 1) % state.items.length)
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [state, onChange, onClose])

  if (!state) return null
  const item = state.items[state.index]

  return (
    <div
      className="wallpaper-preview"
      role="dialog"
      aria-modal="true"
      aria-label={item.title}
      onClick={onClose}
      onPointerDown={event => {
        startX.current = event.clientX
      }}
      onPointerUp={event => {
        if (startX.current !== null && Math.abs(event.clientX - startX.current) > 42) {
          onChange(
            event.clientX < startX.current
              ? (state.index + 1) % state.items.length
              : (state.index + state.items.length - 1) % state.items.length,
          )
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
          onChange((state.index + state.items.length - 1) % state.items.length)
        }}
        aria-label="Previous"
      >
        ←
      </button>
      <img src={item.src} alt={item.alt} />
      <button
        type="button"
        className="wallpaper-preview__arrow wallpaper-preview__arrow--next"
        onClick={event => {
          event.stopPropagation()
          onChange((state.index + 1) % state.items.length)
        }}
        aria-label="Next"
      >
        →
      </button>
      <a
        className="wallpaper-preview__download"
        href={item.downloadSrc}
        download
        onClick={event => event.stopPropagation()}
      >
        ↓ DOWNLOAD
      </a>
    </div>
  )
}

function App() {
  const [loaded, setLoaded] = useState(false)
  const [bag, setBag] = useState(0)
  const [reduced, setReduced] = useState(false)
  const [galleryModal, setGalleryModal] = useState<{ items: GalleryItem[]; index: number } | null>(null)
  const [flavour, setFlavour] = useState(flavours[0])
  const lenisRef = useRef<Lenis | null>(null)
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
      duration: 1.15,
      smoothWheel: true,
      syncTouch: false,
      wheelMultiplier: 0.9,
    })
    lenisRef.current = lenis
    const update = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(update)
    gsap.ticker.lagSmoothing(0)
    lenis.on('scroll', ScrollTrigger.update)
    return () => {
      gsap.ticker.remove(update)
      lenis.destroy()
      lenisRef.current = null
    }
  }, [reduced])

  useEffect(() => {
    if (loaded) {
      document.body.classList.add('is-ready')
      window.setTimeout(() => ScrollTrigger.refresh(), 140)
    }
  }, [loaded])

  const jump = (id: string) => {
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
      <div className={`app ${reduced ? 'reduced-motion' : ''}`}>
        <GlobalAuraCanvas />
        <Header bag={bag} onJump={jump} />
        <main>
          <PhysicsHero onJump={jump} />
          <PhysicsBelief />
          <Flavours bag={bag} setBag={setBag} />
          <Texture />
          <Stand />
          <BlobjectShowcase
            reduced={reduced}
            onOpenItem={(items, index) => setGalleryModal({ items, index })}
          />
        </main>
        <Footer />
      </div>
      <GalleryModal
        state={galleryModal}
        onClose={() => setGalleryModal(null)}
        onChange={nextIndex => setGalleryModal(prev => (prev ? { ...prev, index: nextIndex } : null))}
      />
    </FlavourContext.Provider>
  )
}

export default App
