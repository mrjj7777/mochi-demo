import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { flavours } from './brand'
import { FlavourContext } from './context/FlavourContext'
import { clamp, publishScrollVelocity } from './physics/spring'
import AllSixSection from './sections/AllSixSection'
import Cursor from './sections/Cursor'
import FlavoursSection from './sections/FlavoursSection'
import Header from './sections/Header'
import HeroWave from './sections/HeroWave'
import Lightbox from './sections/Lightbox'
import LookbookSection from './sections/LookbookSection'
import Preloader from './sections/Preloader'
import SqueezeSection from './sections/SqueezeSection'
import StandSection from './sections/StandSection'
import TextureSection from './sections/TextureSection'
import WallpaperProof from './sections/WallpaperProof'
import WallpapersSection from './sections/WallpapersSection'
import type { DeviceTier, Flavour } from './types/mochi'
import GlobalAura from './webgl/GlobalAura'

const MochiTube3D = lazy(() => import('./webgl/MochiTube3D'))
const BeliefSection = lazy(() => import('./physics/BeliefSection'))
const FooterSection = lazy(() => import('./physics/FooterSection'))

gsap.registerPlugin(ScrollTrigger)

const SECTION_IDS = [
  'hero',
  'belief',
  'squeeze',
  'flavours',
  'texture',
  'lookbook',
  'stand',
  'all-six',
  'wallpapers',
  'footer',
]

function detectDeviceTier(): DeviceTier {
  if (typeof window === 'undefined') return 'high'
  const canvas = document.createElement('canvas')
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
  if (!gl) return 'low'

  const cores = navigator.hardwareConcurrency || 4
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory || 4
  const smallScreen = window.matchMedia('(max-width: 700px)').matches

  if (cores <= 2 || memory <= 2) return 'low'
  if (smallScreen || cores <= 4 || memory <= 4) return 'mid'
  return 'high'
}

function Compare3DView() {
  return (
    <div style={{ minHeight: '100vh', background: '#F2EDE4', color: '#141414', padding: '40px 64px' }}>
      <h1 className="display" style={{ fontSize: '36px', marginBottom: '24px' }}>
        3d vs cutout
      </h1>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '24px',
        }}
      >
        {flavours.map(item => (
          <article
            key={item.key}
            data-compare-flavour={item.key}
            style={{
              border: '1px solid rgba(20,20,20,0.18)',
              padding: '16px',
              background: '#F2EDE4',
            }}
          >
            <p className="micro" style={{ margin: '0 0 12px' }}>
              {item.name} — {item.mood.toUpperCase()}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', height: '420px' }}>
              <div style={{ position: 'relative', height: '100%' }}>
                <Suspense fallback={null}>
                  <MochiTube3D
                    colour={item.jelly}
                    aura={item.aura}
                    exposed={item.key === 'cherry'}
                    ariaLabel={`${item.name} 3D tube`}
                  />
                </Suspense>
                <span className="micro" style={{ position: 'absolute', bottom: '4px', left: '4px' }}>
                  3D
                </span>
              </div>
              <div style={{ position: 'relative', height: '100%', display: 'grid', placeItems: 'center' }}>
                <img
                  src={`/media/cutouts/mochi-${item.asset}.webp`}
                  alt={`${item.name} cutout`}
                  style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                />
                <span className="micro" style={{ position: 'absolute', bottom: '4px', left: '4px' }}>
                  CUTOUT
                </span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

export default function App() {
  const compareMode = useMemo(() => {
    if (typeof window === 'undefined') return false
    return new URLSearchParams(window.location.search).get('compare3d') === '1'
  }, [])

  const [flavour, setFlavour] = useState<Flavour>(flavours[0])
  const [activeSection, setActiveSection] = useState('hero')
  const [bag, setBag] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [loupeSuppressed, setLoupeSuppressed] = useState(false)
  const [lightbox, setLightbox] = useState<{ src: string; flavour: Flavour; caption?: string } | null>(null)
  const [wallpaperIndex, setWallpaperIndex] = useState<number | null>(null)
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false,
  )
  const [tier] = useState<DeviceTier>(() => detectDeviceTier())
  const [mountKinetic, setMountKinetic] = useState(
    () => reduced || (typeof window !== 'undefined' && (window.innerWidth > 768 || window.scrollY > 4)),
  )

  const lenisRef = useRef<Lenis | null>(null)

  useEffect(() => {
    if (mountKinetic || compareMode) return
    const enable = () => setMountKinetic(true)
    window.addEventListener('scroll', enable, { passive: true, once: true })
    window.addEventListener('wheel', enable, { passive: true, once: true })
    window.addEventListener('touchstart', enable, { passive: true, once: true })
    window.addEventListener('pointerdown', enable, { passive: true, once: true })
    window.addEventListener('keydown', enable, { passive: true, once: true })
    const isMobile = window.innerWidth <= 768
    const timer = window.setTimeout(enable, isMobile ? 6200 : 1200)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('scroll', enable)
      window.removeEventListener('wheel', enable)
      window.removeEventListener('touchstart', enable)
      window.removeEventListener('pointerdown', enable)
      window.removeEventListener('keydown', enable)
    }
  }, [mountKinetic, compareMode])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(mq.matches)
    onChange()
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [])

  // Sync active flavour to CSS custom properties for global selection/accent styling
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--jelly', flavour.jelly)
    root.style.setProperty('--aura', flavour.aura)
  }, [flavour])

  // Single unified Lenis + GSAP ScrollTrigger ticker loop (04 & 08-2.7)
  useEffect(() => {
    if (compareMode) return
    if (reduced) {
      publishScrollVelocity(0)
      return
    }

    const lenis = new Lenis({
      lerp: 0.08,
      smoothWheel: true,
      syncTouch: false,
    })
    lenisRef.current = lenis

    const onScroll = ({ velocity }: { velocity: number }) => {
      ScrollTrigger.update()
      publishScrollVelocity(clamp(velocity * 0.14, -2.5, 2.5))
    }

    lenis.on('scroll', onScroll)
    gsap.ticker.lagSmoothing(0)

    const tick = (timeSeconds: number) => {
      lenis.raf(timeSeconds * 1000)
    }
    gsap.ticker.add(tick)
    ScrollTrigger.refresh()

    return () => {
      gsap.ticker.remove(tick)
      lenis.off('scroll', onScroll)
      lenis.destroy()
      lenisRef.current = null
      publishScrollVelocity(0)
    }
  }, [reduced, compareMode])

  // Track which section is centered for [ NAV ] bracket highlight
  useEffect(() => {
    if (compareMode) return
    const updateActive = () => {
      const focusY = window.innerHeight * 0.45
      for (const id of SECTION_IDS) {
        const el = document.getElementById(id)
        if (!el) continue
        const rect = el.getBoundingClientRect()
        if (rect.top <= focusY && rect.bottom >= focusY) {
          setActiveSection(prev => (prev === id ? prev : id))
          return
        }
      }
    }
    updateActive()
    window.addEventListener('scroll', updateActive, { passive: true })
    return () => window.removeEventListener('scroll', updateActive)
  }, [compareMode])

  // Refresh ScrollTrigger once initial preload settles and fonts finish loading
  useEffect(() => {
    if (!loaded || compareMode) return
    const id = window.setTimeout(() => ScrollTrigger.refresh(), 120)
    document.fonts?.ready?.then(() => ScrollTrigger.refresh())
    return () => window.clearTimeout(id)
  }, [loaded, compareMode])

  useEffect(() => {
    if (!mountKinetic || compareMode) return
    const id = window.setTimeout(() => ScrollTrigger.refresh(), 180)
    return () => window.clearTimeout(id)
  }, [mountKinetic, compareMode])

  const jump = useCallback(
    (id: string) => {
      const target = document.getElementById(id)
      if (!target) return
      if (lenisRef.current && !reduced) {
        lenisRef.current.scrollTo(target, { offset: 0, duration: 1.1 })
      } else {
        target.scrollIntoView({ behavior: 'auto' })
      }
    },
    [reduced],
  )

  const handleAdd = useCallback((item: Flavour) => {
    setFlavour(item)
    setBag(current => current + 1)
  }, [])

  const contextValue = useMemo(
    () => ({ flavour, setFlavour, activeSection, setActiveSection }),
    [flavour, activeSection],
  )

  if (compareMode) {
    return (
      <FlavourContext.Provider value={contextValue}>
        <Compare3DView />
      </FlavourContext.Provider>
    )
  }

  return (
    <FlavourContext.Provider value={contextValue}>
      <Preloader done={loaded} onDone={() => setLoaded(true)} />
      <div className={`app ${reduced ? 'reduced-motion' : ''}`}>
        <GlobalAura activeAura={flavour.aura} activeGlow="#F2EDE4" />
        <div className="app-grain" aria-hidden="true" />
        <Header bag={bag} onJump={jump} />
        <main>
          <HeroWave onJump={jump} reduced={reduced} />
          {mountKinetic ? (
            <Suspense
              fallback={
                <section id="belief" className="belief section" data-aura="#2FA4A8,#E46A8E" style={{ minHeight: '150vh' }} />
              }
            >
              <BeliefSection reduced={reduced} />
            </Suspense>
          ) : (
            <section id="belief" className="belief section" data-aura="#2FA4A8,#E46A8E" style={{ minHeight: '150vh' }} />
          )}
          <SqueezeSection reduced={reduced} tier={tier} />
          <FlavoursSection reduced={reduced} tier={tier} bag={bag} onAdd={handleAdd} />
          <TextureSection reduced={reduced} tier={tier} onLoupeHover={setLoupeSuppressed} />
          <LookbookSection
            reduced={reduced}
            onOpen={(src, item, caption) => setLightbox({ src, flavour: item, caption })}
          />
          <StandSection reduced={reduced} tier={tier} />
          <AllSixSection reduced={reduced} tier={tier} />
          <WallpapersSection reduced={reduced} tier={tier} onOpen={setWallpaperIndex} />
        </main>
        {mountKinetic ? (
          <Suspense
            fallback={
              <footer id="footer" className="footer section" data-aura="#2346B8,#B3122E" style={{ minHeight: '60vh' }} />
            }
          >
            <FooterSection reduced={reduced} />
          </Suspense>
        ) : (
          <footer id="footer" className="footer section" data-aura="#2346B8,#B3122E" style={{ minHeight: '60vh' }} />
        )}
        {reduced && <p className="reduced-note micro">motion reduced.</p>}
        <Cursor suppressed={loupeSuppressed} />
      </div>
      <Lightbox data={lightbox} onClose={() => setLightbox(null)} />
      <WallpaperProof index={wallpaperIndex} onClose={() => setWallpaperIndex(null)} onChange={setWallpaperIndex} />
    </FlavourContext.Provider>
  )
}
