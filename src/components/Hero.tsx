import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import './hero.css'

gsap.registerPlugin(ScrollTrigger, useGSAP)

type HeroProps = { onJump: (id: string) => void }

const DESK_FRAMES = 172
const MOB_FRAMES = 86

export default function Hero({ onJump }: HeroProps) {
  const heroRef = useRef<HTMLElement>(null)
  const pinRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const targetFrame = useRef(0)
  const currentFrame = useRef(0)
  const framesRef = useRef<Array<HTMLImageElement | undefined>>([])
  const activeRef = useRef(true)
  const dirtyRef = useRef(true)

  useEffect(() => {
    const canvas = canvasRef.current
    const pin = pinRef.current
    if (!canvas || !pin) return
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const isMobile = window.matchMedia('(max-width: 700px)').matches
    const count = isMobile ? MOB_FRAMES : DESK_FRAMES
    const dir = isMobile ? '/media/hero-seq-v4/mob' : '/media/hero-seq-v4/desk'

    framesRef.current = Array.from({ length: count })
    targetFrame.current = 0
    currentFrame.current = 0

    let disposed = false
    let rafId = 0
    let lastNow = performance.now()
    let cachedW = 0
    let cachedH = 0
    let lastDrawn = -1

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
      if (!force && Math.abs(frameVal - lastDrawn) < 0.004) return

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

      const clamped = Math.max(0, Math.min(count - 1, frameVal))
      const lower = Math.floor(clamped)
      const upper = Math.min(count - 1, lower + 1)
      const frac = clamped - lower

      const imgA = findNearest(lower)
      if (!imgA?.naturalWidth) return
      const imgB = frac > 0.02 ? findNearest(upper) : undefined

      // Smart framing: keep ALL 6 MOCHI tubes completely uncropped on every aspect ratio.
      // On widescreen (>= 1.55), cover cleanly with zero artificial zoom.
      // On narrower/split-pane/tablet/mobile viewports (< 1.55), fit width cleanly and feather top/bottom into cream.
      const viewAspect = cachedW / Math.max(1, cachedH)
      const imgAspect = imgA.naturalWidth / Math.max(1, imgA.naturalHeight)
      const fitByWidth = viewAspect < imgAspect * 0.88
      const baseScale = fitByWidth
        ? cachedW / imgA.naturalWidth
        : Math.max(cachedW / imgA.naturalWidth, cachedH / imgA.naturalHeight)

      const drawW = imgA.naturalWidth * baseScale
      const drawH = imgA.naturalHeight * baseScale
      const drawX = (cachedW - drawW) * 0.5
      const drawY = (cachedH - drawH) * 0.5

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.fillStyle = '#F2EDE4'
      ctx.fillRect(0, 0, cachedW, cachedH)
      ctx.globalAlpha = 1
      ctx.drawImage(imgA, drawX, drawY, drawW, drawH)

      if (imgB && imgB !== imgA && imgB.naturalWidth) {
        ctx.globalAlpha = frac
        ctx.drawImage(imgB, drawX, drawY, drawW, drawH)
        ctx.globalAlpha = 1
      }

      // Soft cream feather at top & bottom edges when letterboxed on square/portrait screens
      if (fitByWidth && drawY > 2) {
        const feather = Math.min(72, drawH * 0.16)
        const topGrad = ctx.createLinearGradient(0, drawY, 0, drawY + feather)
        topGrad.addColorStop(0, '#F2EDE4')
        topGrad.addColorStop(1, 'rgba(242, 237, 228, 0)')
        ctx.fillStyle = topGrad
        ctx.fillRect(0, drawY - 1, cachedW, feather + 2)

        const botY = drawY + drawH
        const botGrad = ctx.createLinearGradient(0, botY - feather, 0, botY)
        botGrad.addColorStop(0, 'rgba(242, 237, 228, 0)')
        botGrad.addColorStop(1, '#F2EDE4')
        ctx.fillStyle = botGrad
        ctx.fillRect(0, botY - feather - 1, cachedW, feather + 2)
      }

      pin.classList.toggle('is-fitted', fitByWidth)
      lastDrawn = frameVal
      if (!pin.classList.contains('is-ready')) pin.classList.add('is-ready')
    }

    const tick = (now: number) => {
      rafId = 0
      if (disposed || !activeRef.current || document.visibilityState === 'hidden') return

      const dt = Math.min(0.05, Math.max(0.001, (now - lastNow) / 1000))
      lastNow = now

      const diff = targetFrame.current - currentFrame.current
      if (reduced || Math.abs(diff) < 0.005) {
        currentFrame.current = targetFrame.current
      } else {
        const alpha = 1 - Math.exp(-8.5 * dt)
        currentFrame.current += diff * alpha
      }

      drawFrame(currentFrame.current, dirtyRef.current)
      dirtyRef.current = false

      if (!reduced && Math.abs(targetFrame.current - currentFrame.current) >= 0.005) {
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

    const loadIndex = (index: number) => {
      if (disposed || index < 0 || index >= count || framesRef.current[index]) return
      const img = new Image()
      img.decoding = 'async'
      img.onload = () => {
        if (disposed) return
        framesRef.current[index] = img
        if (index === 0) {
          dirtyRef.current = true
          drawFrame(currentFrame.current, true)
        } else if (Math.abs(index - currentFrame.current) <= 2) {
          dirtyRef.current = true
          wake()
        }
      }
      img.src = index === 0 ? '/media/hero-seq-v4/poster.webp' : `${dir}/${String(index + 1).padStart(4, '0')}.webp`
    }

    loadIndex(0)
    const timers: number[] = []
    for (let i = 6; i < count; i += 6) loadIndex(i)
    let delay = 22
    for (let i = 1; i < count; i += 1) {
      if (i % 6 === 0) continue
      const idx = i
      timers.push(window.setTimeout(() => loadIndex(idx), delay))
      delay += 10
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
    window.addEventListener('resize', onResize, { passive: true })
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      disposed = true
      timers.forEach(t => window.clearTimeout(t))
      observer.disconnect()
      pin.removeEventListener('mochi-hero-wake', onWakeEvent)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', onVisibility)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [])

  useGSAP(
    () => {
      const hero = heroRef.current
      const pin = pinRef.current
      if (!hero || !pin) return
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const isMobile = window.matchMedia('(max-width: 700px)').matches
      const count = isMobile ? MOB_FRAMES : DESK_FRAMES

      if (reduced) {
        pin.style.setProperty('--hero-headline-progress', '1')
        pin.style.setProperty('--hero-cue-opacity', '0')
        return
      }

      const trigger = ScrollTrigger.create({
        trigger: hero,
        start: 'top top',
        end: () => `+=${Math.round(window.innerHeight * (isMobile ? 1.65 : 2.35))}`,
        pin,
        scrub: true,
        invalidateOnRefresh: true,
        onUpdate: self => {
          const p = self.progress
          targetFrame.current = p * (count - 1)
          pin.dispatchEvent(new Event('mochi-hero-wake'))

          const enter = Math.min(1, Math.max(0, (p - 0.14) / 0.2))
          const exit = 1 - Math.min(1, Math.max(0, (p - 0.82) / 0.14))
          const headline = enter * exit
          const cueOpacity = Math.max(0, 1 - p * 12)

          pin.style.setProperty('--hero-progress', p.toFixed(4))
          pin.style.setProperty('--hero-headline-progress', headline.toFixed(4))
          pin.style.setProperty('--hero-cue-opacity', cueOpacity.toFixed(4))
        },
      })
      return () => trigger.kill()
    },
    { scope: heroRef },
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
          } as React.CSSProperties
        }
      >
        <img
          className="mochi-hero__poster"
          src="/media/hero-seq-v4/poster.webp"
          alt="Six MOCHI lip jelly tubes"
          loading="eager"
          decoding="sync"
          fetchPriority="high"
        />
        <canvas ref={canvasRef} className="mochi-hero__canvas" aria-label="MOCHI lip jelly wave" />
        <div className="mochi-hero__grade" aria-hidden="true" />
        <div className="mochi-hero__headline" aria-hidden="true">
          <span>soft is</span> <em>a choice.</em>
        </div>
        <button
          type="button"
          className="mochi-hero__scroll-cue"
          onClick={() => onJump('belief')}
          aria-label="Scroll to explore"
        >
          <span>SCROLL</span>
        </button>
      </div>
    </section>
  )
}
