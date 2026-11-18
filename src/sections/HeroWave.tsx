import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { flavours } from '../brand'
import { useFlavour } from '../context/FlavourContext'
import { clamp, createSpring } from '../physics/spring'

gsap.registerPlugin(ScrollTrigger, useGSAP)

export type HeroWaveProps = {
  onJump: (id: string) => void
  reduced: boolean
}

const DESK_COUNT = 172
const MOB_COUNT = 86
const TUBE_CENTRES_X = [0.184, 0.313, 0.444, 0.572, 0.700, 0.828]

type HotspotCoord = { left: number; top: number; height: number }

export default function HeroWave({ onJump, reduced }: HeroWaveProps) {
  const heroRef = useRef<HTMLElement>(null)
  const pinRef = useRef<HTMLDivElement>(null)
  const canvasWrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const headlineLineRef = useRef<HTMLDivElement>(null)
  const dissolveRef = useRef<HTMLDivElement>(null)
  const hotspotsWrapRef = useRef<HTMLDivElement>(null)
  const scrollCueRef = useRef<HTMLButtonElement>(null)

  const { setFlavour } = useFlavour()

  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 700px)').matches : false,
  )
  const [atRest, setAtRest] = useState(true)
  const [activeHotspot, setActiveHotspot] = useState<number | null>(null)
  const [hotspotCoords, setHotspotCoords] = useState<HotspotCoord[]>([])

  const targetFrameRef = useRef(0)
  const currentFrameRef = useRef(0)
  const nudgeFrameRef = useRef(0)
  const progressRef = useRef(0)
  const hasScrolledRef = useRef(false)
  const loadedFramesRef = useRef<(HTMLImageElement | undefined)[]>([])
  const posterReadyRef = useRef(false)
  const hotspotHairlineRefs = useRef<(HTMLSpanElement | null)[]>([])
  const hotspotLabelRefs = useRef<(HTMLSpanElement | null)[]>([])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 700px)')
    const onChange = () => setIsMobile(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // Animate hovered hotspot 1px vertical hairline via ui spring
  useEffect(() => {
    if (reduced || isMobile) return
    const springs = flavours.map((_, i) => createSpring('ui', activeHotspot === i ? 1 : 0))
    let raf = 0
    let last = performance.now()

    const step = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000))
      last = now
      let moving = false
      springs.forEach((s, i) => {
        s.setTarget(activeHotspot === i ? 1 : 0)
        const v = s.step(dt)
        const node = hotspotHairlineRefs.current[i]
        const label = hotspotLabelRefs.current[i]
        if (node) {
          node.style.transform = `scaleY(${v.toFixed(4)})`
          node.style.opacity = clamp(v * 1.4, 0, 1).toFixed(3)
        }
        if (label) {
          label.style.opacity = clamp((v - 0.3) * 1.6, 0, 1).toFixed(3)
        }
        if (!s.atRest(0.005)) moving = true
      })
      if (moving) raf = requestAnimationFrame(step)
      else raf = 0
    }
    raf = requestAnimationFrame(step)
    return () => {
      if (raf) cancelAnimationFrame(raf)
    }
  }, [activeHotspot, reduced, isMobile])

  // Canvas progressive loader, cover math, idle nudge, and smooth frame lerp
  useEffect(() => {
    if (reduced) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return

    const count = isMobile ? MOB_COUNT : DESK_COUNT
    const dir = isMobile ? '/media/hero-seq/mob' : '/media/hero-seq/desk'
    loadedFramesRef.current = Array.from({ length: count })
    targetFrameRef.current = 0
    currentFrameRef.current = 0

    let disposed = false
    let raf = 0
    let nudgeRaf = 0
    let nudgeTimer = 0
    let nudgeRepeatTimer = 0
    let lastDrawnIndex = -1
    let cachedW = canvas.clientWidth
    let cachedH = canvas.clientHeight

    const findNearestLoaded = (index: number): HTMLImageElement | undefined => {
      const list = loadedFramesRef.current
      if (list[index]?.naturalWidth) return list[index]
      for (let offset = 1; offset < count; offset += 1) {
        if (index - offset >= 0 && list[index - offset]?.naturalWidth) return list[index - offset]
        if (index + offset < count && list[index + offset]?.naturalWidth) return list[index + offset]
      }
      return undefined
    }

    const computeAndDraw = (force = false) => {
      if (disposed) return
      const rawIndex = clamp(
        hasScrolledRef.current ? currentFrameRef.current : Math.max(currentFrameRef.current, nudgeFrameRef.current),
        0,
        count - 1,
      )
      if (!force && posterReadyRef.current && Math.abs(rawIndex - lastDrawnIndex) < 0.001) {
        return
      }

      if (cachedW < 1 || cachedH < 1) {
        const bounds = canvas.getBoundingClientRect()
        cachedW = bounds.width
        cachedH = bounds.height
      }
      if (cachedW < 1 || cachedH < 1) return

      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const pxW = Math.max(1, Math.round(cachedW * dpr))
      const pxH = Math.max(1, Math.round(cachedH * dpr))
      if (canvas.width !== pxW || canvas.height !== pxH) {
        canvas.width = pxW
        canvas.height = pxH
      }

      const lower = Math.floor(rawIndex)
      const upper = Math.min(count - 1, lower + 1)
      const frac = rawIndex - lower

      const imgA = findNearestLoaded(lower)
      const imgB = frac > 0.02 ? findNearestLoaded(upper) : undefined
      if (!imgA?.naturalWidth) return

      const scale = Math.max(cachedW / imgA.naturalWidth, cachedH / imgA.naturalHeight)
      const drawW = imgA.naturalWidth * scale
      const drawH = imgA.naturalHeight * scale
      const drawX = (cachedW - drawW) * 0.5
      const drawY = (cachedH - drawH) * 0.5

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.fillStyle = '#F2EDE4'
      ctx.fillRect(0, 0, cachedW, cachedH)
      ctx.globalAlpha = 1
      ctx.drawImage(imgA, drawX, drawY, drawW, drawH)

      // Mobile 86-frame sequence cross-fades nearest neighbours for silky motion
      if (isMobile && imgB && imgB !== imgA && imgB.naturalWidth) {
        ctx.globalAlpha = clamp(frac, 0, 1)
        ctx.drawImage(imgB, drawX, drawY, drawW, drawH)
        ctx.globalAlpha = 1
      }

      lastDrawnIndex = rawIndex
      if (!posterReadyRef.current) {
        posterReadyRef.current = true
        canvas.dataset.ready = 'true'
      }
    }

    const updateHotspotLayout = () => {
      if (isMobile) {
        setHotspotCoords([])
        return
      }
      const bounds = canvas.getBoundingClientRect()
      const pinBounds = pinRef.current?.getBoundingClientRect()
      if (bounds.width < 1 || bounds.height < 1) return
      const refImg = findNearestLoaded(0)
      const natW = refImg?.naturalWidth || 1600
      const natH = refImg?.naturalHeight || 900
      const scale = Math.max(bounds.width / natW, bounds.height / natH)
      const drawW = natW * scale
      const drawH = natH * scale
      const drawX = (bounds.width - drawW) * 0.5 + (pinBounds ? bounds.left - pinBounds.left : 0)
      const drawY = (bounds.height - drawH) * 0.5 + (pinBounds ? bounds.top - pinBounds.top : 0)
      const pinW = pinBounds?.width ?? bounds.width

      setHotspotCoords(
        TUBE_CENTRES_X.map(tx => ({
          left: drawX + tx * drawW,
          top: drawY + 0.25 * drawH,
          height: 0.58 * drawH,
        })).map(coord =>
          coord.left >= 28 && coord.left <= pinW - 28 ? coord : { left: -1, top: 0, height: 0 },
        ),
      )
    }

    const loadFrame = (index: number) => {
      if (disposed || index < 0 || index >= count || loadedFramesRef.current[index]) return
      const img = new Image()
      img.decoding = 'async'
      img.onload = () => {
        if (disposed) return
        loadedFramesRef.current[index] = img
        if (index === 0) {
          computeAndDraw(true)
          updateHotspotLayout()
        }
      }
      // Frame 0 reuses preloaded /media/hero-seq/poster.webp so boot makes zero duplicate image requests
      img.src =
        index === 0
          ? '/media/hero-seq/poster.webp'
          : `${dir}/${String(index + 1).padStart(4, '0')}.webp`
    }

    // 1. Frame 0 only at boot so Slow 4G mobile LCP is never saturated
    loadFrame(0)

    const restTimers: number[] = []
    let sequenceStarted = false
    let deferredSeqTimer = 0

    const startSequence = () => {
      if (disposed || sequenceStarted) return
      sequenceStarted = true
      window.clearTimeout(deferredSeqTimer)
      window.removeEventListener('scroll', startSequence)
      window.removeEventListener('wheel', startSequence)
      window.removeEventListener('touchstart', startSequence)
      window.removeEventListener('pointerdown', startSequence)
      window.removeEventListener('pointermove', startSequence)
      window.removeEventListener('keydown', startSequence)

      for (let i = 8; i < count; i += 8) loadFrame(i)
      let delay = 20
      for (let i = 1; i < count; i += 1) {
        if (i % 8 === 0) continue
        const idx = i
        const t = window.setTimeout(() => loadFrame(idx), delay)
        restTimers.push(t)
        delay += 12
      }
    }

    window.addEventListener('scroll', startSequence, { once: true, passive: true })
    window.addEventListener('wheel', startSequence, { once: true, passive: true })
    window.addEventListener('touchstart', startSequence, { once: true, passive: true })
    window.addEventListener('pointerdown', startSequence, { once: true, passive: true })
    window.addEventListener('pointermove', startSequence, { once: true, passive: true })
    window.addEventListener('keydown', startSequence, { once: true, passive: true })

    const scheduleDeferred = () => {
      if (disposed || sequenceStarted) return
      deferredSeqTimer = window.setTimeout(startSequence, isMobile ? 6200 : 2400)
    }
    if (document.readyState === 'complete') scheduleDeferred()
    else window.addEventListener('load', scheduleDeferred, { once: true })

    // Idle nudge: after 2.5s on desktop (after deferred load on mobile), squish 1 -> 18 -> 1 over 1.4s
    const runNudge = () => {
      if (disposed || hasScrolledRef.current || progressRef.current >= 0.02) return
      startSequence()
      const start = performance.now()
      const duration = 1400
      const maxNudgeFrame = isMobile ? 9 : 17
      const animateNudge = (now: number) => {
        if (disposed || hasScrolledRef.current || progressRef.current >= 0.02) {
          nudgeFrameRef.current = 0
          return
        }
        const t = clamp((now - start) / duration, 0, 1)
        const bell = Math.sin(t * Math.PI)
        nudgeFrameRef.current = bell * maxNudgeFrame
        if (t < 1) {
          nudgeRaf = requestAnimationFrame(animateNudge)
        } else {
          nudgeFrameRef.current = 0
          nudgeRepeatTimer = window.setTimeout(runNudge, 8000)
        }
      }
      nudgeRaf = requestAnimationFrame(animateNudge)
    }

    nudgeTimer = window.setTimeout(runNudge, isMobile ? 6800 : 2500)

    let last = performance.now()
    const tick = (now: number) => {
      if (disposed) return
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000))
      last = now
      const lerpAlpha = 1 - Math.pow(1 - 0.14, dt * 60)
      currentFrameRef.current += (targetFrameRef.current - currentFrameRef.current) * lerpAlpha
      computeAndDraw()
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    const onResize = () => {
      const bounds = canvas.getBoundingClientRect()
      cachedW = bounds.width
      cachedH = bounds.height
      computeAndDraw(true)
      updateHotspotLayout()
    }
    const ro = new ResizeObserver(onResize)
    ro.observe(canvas)
    window.addEventListener('resize', onResize)
    updateHotspotLayout()

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      cancelAnimationFrame(nudgeRaf)
      window.clearTimeout(nudgeTimer)
      window.clearTimeout(nudgeRepeatTimer)
      window.clearTimeout(deferredSeqTimer)
      window.removeEventListener('scroll', startSequence)
      window.removeEventListener('wheel', startSequence)
      window.removeEventListener('touchstart', startSequence)
      window.removeEventListener('pointerdown', startSequence)
      window.removeEventListener('pointermove', startSequence)
      window.removeEventListener('keydown', startSequence)
      window.removeEventListener('load', scheduleDeferred)
      restTimers.forEach(t => window.clearTimeout(t))
      ro.disconnect()
      window.removeEventListener('resize', onResize)
    }
  }, [isMobile, reduced])

  // GSAP ScrollTrigger pinning + choreography
  useGSAP(
    () => {
      if (reduced || !heroRef.current || !pinRef.current) return
      const count = isMobile ? MOB_COUNT : DESK_COUNT

      const trigger = ScrollTrigger.create({
        trigger: heroRef.current,
        start: 'top top',
        end: () => `+=${Math.round(window.innerHeight * (isMobile ? 1.6 : 2.2))}`,
        pin: pinRef.current,
        scrub: true,
        invalidateOnRefresh: true,
        onUpdate: self => {
          const p = self.progress
          progressRef.current = p
          if (p > 0.004) hasScrolledRef.current = true

          targetFrameRef.current = p * (count - 1)

          const nextRest = p < 0.05
          setAtRest(prev => (prev !== nextRest ? nextRest : prev))
          if (!nextRest) setActiveHotspot(null)

          // Headline mask: 0.15–0.45 enter, 0.45–0.80 hold, 0.80–1.00 exit up
          let headlineY = 110
          let headlineOpacity = 0
          if (p >= 0.15 && p < 0.45) {
            const k = clamp((p - 0.15) / 0.3, 0, 1)
            const eased = 1 - Math.pow(1 - k, 3)
            headlineY = (1 - eased) * 110
            headlineOpacity = eased
          } else if (p >= 0.45 && p < 0.8) {
            headlineY = 0
            headlineOpacity = 1
          } else if (p >= 0.8) {
            const k = clamp((p - 0.8) / 0.2, 0, 1)
            const eased = k * k
            headlineY = -eased * 120
            headlineOpacity = 1 - eased
          }

          if (headlineLineRef.current) {
            headlineLineRef.current.style.transform = `translate3d(0, ${headlineY.toFixed(2)}%, 0)`
            headlineLineRef.current.style.opacity = headlineOpacity.toFixed(3)
          }

          // 0.80–1.00: canvas scales 1 -> 1.06, 30vh bottom cream gradient rises seamlessly into #belief
          const exitT = p >= 0.8 ? clamp((p - 0.8) / 0.2, 0, 1) : 0
          if (canvasWrapRef.current) {
            const s = 1 + exitT * 0.06
            canvasWrapRef.current.style.transform = `scale(${s.toFixed(4)})`
          }
          if (dissolveRef.current) {
            dissolveRef.current.style.opacity = (0.12 + exitT * 0.48).toFixed(3)
            dissolveRef.current.style.transform = `translate3d(0, ${((1 - exitT) * 20).toFixed(1)}%, 0)`
          }
          if (scrollCueRef.current) {
            const cueOpacity = clamp(1 - p * 12, 0, 1)
            scrollCueRef.current.style.opacity = cueOpacity.toFixed(3)
            scrollCueRef.current.style.pointerEvents = cueOpacity > 0.1 ? 'auto' : 'none'
          }
        },
      })

      return () => trigger.kill()
    },
    { scope: heroRef, dependencies: [isMobile, reduced] },
  )

  return (
    <section
      id="hero"
      ref={heroRef}
      className={`hero section ${reduced ? 'hero--reduced' : ''}`}
      data-aura="#F2EDE4,#F6D3D6"
    >
      <div ref={pinRef} className="hero__pin">
        <div className="hero__media-mask">
          <div ref={canvasWrapRef} className="hero__media">
            <img
              className="hero__poster"
              src="/media/hero-seq/poster.webp"
              width={1600}
              height={900}
              alt="Six MOCHI lip jelly tubes standing in a row"
              loading="eager"
              decoding="sync"
              fetchPriority="high"
            />
            {!reduced && (
              <canvas
                ref={canvasRef}
                className="hero__canvas"
                aria-label="MOCHI lip jelly wave sequence"
              />
            )}
            {isMobile && <div className="hero__mobile-fades" aria-hidden="true" />}
          </div>
        </div>

        {/* Smooth 30vh multi-stop cream dissolve into #belief (zero seam ΔE <= 1.5) */}
        <div ref={dissolveRef} className="hero__dissolve" aria-hidden="true" />

        {/* Headline in upper calm band inside line mask */}
        <div className="hero__headline-mask">
          <h1
            ref={headlineLineRef}
            className="hero__headline"
            style={reduced ? { transform: 'translate3d(0,0,0)', opacity: 1 } : undefined}
          >
            <span className="display">soft is</span>{' '}
            <em className="emotion">a choice.</em>
          </h1>
        </div>

        {/* Rest hotspots over the 6 tubes (desktop only, progress < 0.05) */}
        {!reduced && !isMobile && (
          <div
            ref={hotspotsWrapRef}
            className={`hero__hotspots ${atRest ? 'hero__hotspots--active' : 'hero__hotspots--hidden'}`}
          >
            {flavours.map((item, idx) => {
              const coord = hotspotCoords[idx]
              if (!coord || coord.left < 0) return null
              const isOpen = activeHotspot === idx
              return (
                <button
                  key={item.key}
                  type="button"
                  className={`hero__hotspot ${isOpen ? 'hero__hotspot--open' : ''}`}
                  style={{
                    left: `${coord.left.toFixed(1)}px`,
                    top: `${coord.top.toFixed(1)}px`,
                    height: `${coord.height.toFixed(1)}px`,
                  }}
                  tabIndex={atRest ? 0 : -1}
                  aria-label={`${item.name} — ${item.mood}. Jump to flavour`}
                  onPointerEnter={() => setActiveHotspot(idx)}
                  onPointerLeave={() => setActiveHotspot(prev => (prev === idx ? null : prev))}
                  onFocus={() => setActiveHotspot(idx)}
                  onBlur={() => setActiveHotspot(prev => (prev === idx ? null : prev))}
                  onClick={() => {
                    setFlavour(item)
                    onJump('flavours')
                  }}
                >
                  <span
                    ref={el => {
                      hotspotHairlineRefs.current[idx] = el
                    }}
                    className="hero__hotspot-line"
                    aria-hidden="true"
                  />
                  <span
                    ref={el => {
                      hotspotLabelRefs.current[idx] = el
                    }}
                    className="hero__hotspot-label micro"
                    aria-hidden="true"
                  >
                    {item.name} — {item.mood}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {/* Bottom-left mono HUD */}
        <p className="hero__mono micro">LIP JELLY — DROP 01 — SIX MOODS</p>

        {/* Bottom-center vertical 64px hairline scroll cue */}
        {!reduced && (
          <button
            ref={scrollCueRef}
            type="button"
            className="hero__scroll-cue"
            onClick={() => onJump('belief')}
            aria-label="Scroll to belief section"
          >
            <span className="hero__scroll-track" aria-hidden="true">
              <span className="hero__scroll-runner" />
            </span>
            <span className="hero__scroll-text micro">SCROLL</span>
          </button>
        )}

        {/* Bottom-right corner intentionally left completely clear for Veo watermark */}
      </div>
    </section>
  )
}
