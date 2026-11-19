import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import './hero.css'

gsap.registerPlugin(ScrollTrigger, useGSAP)

type HeroProps = { onJump: (id: string) => void }

const DESK_FRAMES = 172
const MOB_FRAMES = 86
const FPS = 24

function formatTimecode(frame: number) {
  const f = Math.max(0, Math.round(frame))
  const secs = Math.floor(f / FPS)
  const rem = f % FPS
  return `00:${String(secs).padStart(2, '0')}:${String(rem).padStart(2, '0')}`
}

export default function Hero({ onJump }: HeroProps) {
  const heroRef = useRef<HTMLElement>(null)
  const pinRef = useRef<HTMLDivElement>(null)
  const mediaRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const timecodeRef = useRef<HTMLSpanElement>(null)
  const progressBarRef = useRef<HTMLSpanElement>(null)

  const scrollProgressRef = useRef(0)
  const targetFrame = useRef(0)
  const currentFrame = useRef(0)
  const autoFrameRef = useRef(0)
  const autoDirRef = useRef<1 | -1>(1)
  const autoPauseRef = useRef(0.35) // gentle cinema hold before seamless pendulum wave begins
  const framesRef = useRef<Array<HTMLImageElement | undefined>>([])
  const activeRef = useRef(true)
  const dirtyRef = useRef(true)

  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : false,
  )

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const sync = () => setIsMobile(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const pin = pinRef.current
    const media = mediaRef.current
    if (!canvas || !pin || !media) return
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const count = isMobile ? MOB_FRAMES : DESK_FRAMES
    const dir = isMobile ? '/media/hero-seq-1920/mob' : '/media/hero-seq-1920/desk'
    const posterSrc = isMobile ? '/media/hero-seq-1920/poster-mob.webp' : '/media/hero-seq-1920/poster.webp'

    framesRef.current = Array.from({ length: count })
    targetFrame.current = 0
    currentFrame.current = 0
    autoFrameRef.current = 0
    autoPauseRef.current = 0.35

    let disposed = false
    let rafId = 0
    let lastNow = performance.now()
    let cachedW = 0
    let cachedH = 0
    let lastDrawnIndex = -1
    let lastTimecode = ''

    // Subtle 65mm optical camera parallax on pointer move (true push-in depth)
    let pointerX = 0
    let pointerY = 0
    let camX = 0
    let camY = 0

    const findNearest = (index: number): HTMLImageElement | undefined => {
      const list = framesRef.current
      if (list[index]?.naturalWidth) return list[index]
      for (let offset = 1; offset < count; offset += 1) {
        if (index - offset >= 0 && list[index - offset]?.naturalWidth) return list[index - offset]
        if (index + offset < count && list[index + offset]?.naturalWidth) return list[index + offset]
      }
      return undefined
    }

    const drawFrame = (frameVal: number, force = false) => {
      if (disposed) return
      const clamped = Math.max(0, Math.min(count - 1, frameVal))
      // Crisp integer cinema shutter (eliminates double-exposure ghosting on moving jelly droplets)
      const frameIdx = Math.round(clamped)
      if (!force && frameIdx === lastDrawnIndex) return

      if (cachedW < 1 || cachedH < 1) {
        const rect = canvas.getBoundingClientRect()
        cachedW = rect.width
        cachedH = rect.height
      }
      if (cachedW < 1 || cachedH < 1) return

      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const pxW = Math.max(1, Math.round(cachedW * dpr))
      const pxH = Math.max(1, Math.round(cachedH * dpr))
      if (canvas.width !== pxW || canvas.height !== pxH) {
        canvas.width = pxW
        canvas.height = pxH
      }

      const img = findNearest(frameIdx)
      if (!img?.naturalWidth) return

      // Architectural 65mm crop: overscan 1.10x centered cleanly on the 6 tubes
      // Eliminates raw left-edge banding and bottom-right corner watermark on every viewport ratio.
      const overscan = isMobile ? 1.04 : 1.1
      const baseScale = Math.max(cachedW / img.naturalWidth, cachedH / img.naturalHeight) * overscan
      const drawW = img.naturalWidth * baseScale
      const drawH = img.naturalHeight * baseScale
      const offsetX = isMobile ? 0 : -cachedW * 0.008
      const offsetY = isMobile ? 0 : cachedH * 0.01
      const drawX = (cachedW - drawW) * 0.5 + offsetX
      const drawY = (cachedH - drawH) * 0.5 + offsetY

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.fillStyle = '#F2EDE4'
      ctx.fillRect(0, 0, cachedW, cachedH)
      ctx.drawImage(img, drawX, drawY, drawW, drawH)

      lastDrawnIndex = frameIdx
      if (!pin.classList.contains('is-ready')) pin.classList.add('is-ready')

      // Live subtle director's monitor HUD updates (zero React re-renders)
      const normP = count > 1 ? frameIdx / (count - 1) : 0
      const tc = formatTimecode(isMobile ? frameIdx * 2 : frameIdx)
      if (timecodeRef.current && tc !== lastTimecode) {
        timecodeRef.current.textContent = `${tc} — 24FPS`
        lastTimecode = tc
      }
      if (progressBarRef.current) {
        progressBarRef.current.style.transform = `scaleX(${normP.toFixed(4)})`
      }
    }

    const tick = (now: number) => {
      rafId = 0
      if (disposed || !activeRef.current || document.visibilityState === 'hidden') return

      const dt = Math.min(0.05, Math.max(0.001, (now - lastNow) / 1000))
      lastNow = now

      const scrollP = scrollProgressRef.current
      const isAtTop = scrollP < 0.012

      if (!reduced && isAtTop) {
        // Living luxury cinema pendulum at top of page:
        // Seamless left->right and right->left 6-tube squish wave with zero cut seam.
        if (autoPauseRef.current > 0) {
          autoPauseRef.current = Math.max(0, autoPauseRef.current - dt)
        } else {
          const cinemaFps = isMobile ? 11 : 21
          autoFrameRef.current += dt * cinemaFps * autoDirRef.current
          if (autoFrameRef.current >= count - 1) {
            autoFrameRef.current = count - 1
            autoDirRef.current = -1
            autoPauseRef.current = 0.55
          } else if (autoFrameRef.current <= 0) {
            autoFrameRef.current = 0
            autoDirRef.current = 1
            autoPauseRef.current = 0.55
          }
        }
        targetFrame.current = autoFrameRef.current
      } else {
        // Sync auto-cursor so returning to top resumes seamlessly with zero jump
        autoFrameRef.current = currentFrame.current
        autoPauseRef.current = 0.25
      }

      const diff = targetFrame.current - currentFrame.current
      if (reduced) {
        currentFrame.current = targetFrame.current
      } else {
        const damping = isAtTop ? 15 : 10.5
        const alpha = 1 - Math.exp(-damping * dt)
        currentFrame.current += diff * alpha
      }

      // Smooth 65mm optical camera micro-parallax (push-in direction matches gallery)
      const camAlpha = 1 - Math.exp(-6.5 * dt)
      camX += (pointerX - camX) * camAlpha
      camY += (pointerY - camY) * camAlpha

      const scrollZoom = isMobile ? 0 : Math.min(1, scrollP / 0.72) * 0.048
      const exitRecede = Math.min(1, Math.max(0, (scrollP - 0.68) / 0.32)) * 0.06
      const liveScale = 1 + scrollZoom - exitRecede
      const tx = reduced || isMobile ? 0 : -camX * 14
      const ty = reduced || isMobile ? 0 : -camY * 8
      const rotY = reduced || isMobile ? 0 : camX * 1.15
      const rotX = reduced || isMobile ? 0 : -camY * 0.75

      media.style.transform = `perspective(1600px) translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) rotateY(${rotY.toFixed(3)}deg) rotateX(${rotX.toFixed(3)}deg) scale(${liveScale.toFixed(4)})`

      drawFrame(currentFrame.current, dirtyRef.current)
      dirtyRef.current = false

      if (!reduced && activeRef.current) {
        rafId = requestAnimationFrame(tick)
      }
    }

    const wake = () => {
      if (disposed || !activeRef.current || document.visibilityState === 'hidden') return
      if (!rafId) {
        lastNow = performance.now()
        rafId = requestAnimationFrame(tick)
      }
    }

    // Fast concurrent frame streaming queue (8 in-flight, opening frames prioritized first)
    const queue: number[] = []
    for (let i = 0; i < Math.min(count, 36); i += 1) queue.push(i)
    for (let i = 36; i < count; i += 4) queue.push(i)
    for (let i = 36; i < count; i += 1) {
      if ((i - 36) % 4 !== 0) queue.push(i)
    }

    let cursor = 0
    const MAX_CONCURRENT = 8
    const loadNext = () => {
      if (disposed || cursor >= queue.length) return
      const index = queue[cursor++]
      if (framesRef.current[index]) {
        loadNext()
        return
      }
      const img = new Image()
      img.decoding = 'async'
      img.onload = () => {
        if (disposed) return
        framesRef.current[index] = img
        if (index === 0) {
          dirtyRef.current = true
          drawFrame(currentFrame.current, true)
          wake()
        } else if (Math.abs(index - currentFrame.current) <= 2) {
          dirtyRef.current = true
        }
        loadNext()
      }
      img.onerror = () => {
        if (!disposed) loadNext()
      }
      img.src = index === 0 ? posterSrc : `${dir}/${String(index + 1).padStart(4, '0')}.webp`
    }

    for (let w = 0; w < MAX_CONCURRENT; w += 1) loadNext()

    const onPointerMove = (e: PointerEvent) => {
      if (isMobile || reduced) return
      const rect = pin.getBoundingClientRect()
      pointerX = Math.max(-1, Math.min(1, ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1))
      pointerY = Math.max(-1, Math.min(1, ((e.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1))
      wake()
    }

    const onPointerLeave = () => {
      pointerX = 0
      pointerY = 0
    }

    const onResize = () => {
      const rect = canvas.getBoundingClientRect()
      cachedW = rect.width
      cachedH = rect.height
      dirtyRef.current = true
      drawFrame(currentFrame.current, true)
    }

    const onVisibility = () => {
      activeRef.current = document.visibilityState !== 'hidden'
      if (activeRef.current) wake()
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        activeRef.current = entry?.isIntersecting ?? true
        if (activeRef.current) wake()
      },
      { threshold: 0 },
    )
    observer.observe(pin)

    const onWakeEvent = () => wake()
    pin.addEventListener('mochi-hero-wake', onWakeEvent)
    pin.addEventListener('pointermove', onPointerMove, { passive: true })
    pin.addEventListener('pointerleave', onPointerLeave)
    window.addEventListener('resize', onResize, { passive: true })
    document.addEventListener('visibilitychange', onVisibility)
    wake()

    return () => {
      disposed = true
      observer.disconnect()
      pin.removeEventListener('mochi-hero-wake', onWakeEvent)
      pin.removeEventListener('pointermove', onPointerMove)
      pin.removeEventListener('pointerleave', onPointerLeave)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', onVisibility)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [isMobile])

  useGSAP(
    () => {
      const hero = heroRef.current
      const pin = pinRef.current
      if (!hero || !pin) return
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const count = isMobile ? MOB_FRAMES : DESK_FRAMES

      if (reduced) {
        pin.style.setProperty('--hero-headline-progress', '1')
        pin.style.setProperty('--hero-cue-opacity', '0')
        pin.style.setProperty('--hero-exit-fade', '0')
        return
      }

      const trigger = ScrollTrigger.create({
        trigger: hero,
        start: 'top top',
        end: () => `+=${Math.round(window.innerHeight * (isMobile ? 2.1 : 3.1))}`,
        pin: true,
        pinSpacing: true,
        anticipatePin: 1,
        scrub: true,
        invalidateOnRefresh: true,
        onUpdate: self => {
          const p = self.progress
          scrollProgressRef.current = p

          // Smooth cinematic scrub of the full 6-tube squish wave before Belief shutter sweeps up
          const waveP = Math.min(1, p / 0.72)
          if (p >= 0.012) {
            targetFrame.current = waveP * (count - 1)
          }
          pin.dispatchEvent(new Event('mochi-hero-wake'))

          const enter = Math.min(1, Math.max(0, (waveP - 0.12) / 0.22))
          const exit = 1 - Math.min(1, Math.max(0, (p - 0.66) / 0.14))
          const headline = enter * exit
          const cueOpacity = Math.max(0, 1 - p * 12)
          const shutterP = Math.min(1, Math.max(0, (p - 0.66) / 0.34))

          pin.style.setProperty('--hero-progress', p.toFixed(4))
          pin.style.setProperty('--hero-headline-progress', headline.toFixed(4))
          pin.style.setProperty('--hero-cue-opacity', cueOpacity.toFixed(4))
          pin.style.setProperty('--hero-exit-fade', shutterP.toFixed(4))
        },
      })
      return () => trigger.kill()
    },
    { scope: heroRef, dependencies: [isMobile] },
  )

  return (
    <section id="hero" className="mochi-hero" ref={heroRef} data-aura="#F2EDE4,#F6D3D6">
      <div
        className="mochi-hero__pin"
        ref={pinRef}
        style={
          {
            '--hero-progress': 0,
            '--hero-headline-progress': 0,
            '--hero-cue-opacity': 1,
            '--hero-exit-fade': 0,
          } as React.CSSProperties
        }
      >
        <div className="mochi-hero__media" ref={mediaRef}>
          <img
            className="mochi-hero__poster"
            src={isMobile ? '/media/hero-seq-1920/poster-mob.webp' : '/media/hero-seq-1920/poster.webp'}
            alt="Six MOCHI lip jelly tubes"
            width={isMobile ? 720 : 1920}
            height={isMobile ? 1280 : 1080}
            loading="eager"
            decoding="sync"
            fetchPriority="high"
          />
          <canvas ref={canvasRef} className="mochi-hero__canvas" aria-label="MOCHI lip jelly cinema film" />
        </div>

        {/* Optical 65mm studio lens falloff, subtle 35mm film texture, and theatre exit scrim */}
        <div className="mochi-hero__cinema-grade" aria-hidden="true" />
        <div className="mochi-hero__film-grain" aria-hidden="true" />
        <div className="mochi-hero__seam-fade" aria-hidden="true" />

        <div className="mochi-hero__headline" aria-hidden="true">
          <span>soft is</span> <em>a choice.</em>
        </div>

        {/* Minimalist luxury director's monitor HUD */}
        <p className="mochi-hero__mono">LIP JELLY — DROP 01 — SIX MOODS</p>

        <button
          type="button"
          className="mochi-hero__scroll-cue"
          onClick={() => onJump('belief')}
          aria-label="Scroll to explore"
        >
          <span className="mochi-hero__scroll-line" aria-hidden="true" />
          <span>SCROLL</span>
        </button>

        <div className="mochi-hero__hud-right" aria-hidden="true">
          <span ref={timecodeRef} className="mochi-hero__timecode">
            00:00:00 — 24FPS
          </span>
          <span className="mochi-hero__reel-track">
            <span ref={progressBarRef} className="mochi-hero__reel-fill" />
          </span>
        </div>
      </div>
    </section>
  )
}
