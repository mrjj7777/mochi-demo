import { useEffect, useRef, useState } from 'react'
import { clamp, createSpring } from '../physics/spring'

export type PreloaderProps = {
  onDone: () => void
  done?: boolean
}

const PRELOAD_IMAGES = [
  '/media/hero-seq/poster.webp',
  '/media/cutouts/mochi-cherry.webp',
]

/**
 * Wordmark fills horizontally with Cherry jelly red (#B3122E) from 000 to 100
 * driven by real font + poster + cutout readiness, squeezes once, then wipes up
 * cleanly within <= 1.6s.
 */
export default function Preloader({ onDone, done = false }: PreloaderProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const wordRef = useRef<HTMLDivElement>(null)
  const fillRef = useRef<HTMLSpanElement>(null)
  const [count, setCount] = useState(0)
  const [dismissed, setDismissed] = useState(done)
  const finishedRef = useRef(done)

  useEffect(() => {
    if (done) {
      setDismissed(true)
      return
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      finishedRef.current = true
      setDismissed(true)
      onDone()
      return
    }

    let targetProgress = 0.08
    let assetsCompleted = false
    let phase: 'loading' | 'squeeze' | 'wipe' | 'done' = 'loading'
    let squeezeStarted = 0

    const progressSpring = createSpring('ui', 0)
    const squeezeSpring = createSpring('jelly', 1)
    const wipeSpring = createSpring('settle', 0)

    const markTask = (weight: number) => {
      targetProgress = clamp(targetProgress + weight, 0, 1)
      if (targetProgress >= 0.99) assetsCompleted = true
    }

    // Track real document.fonts readiness
    if (document.fonts?.ready) {
      document.fonts.ready.then(() => markTask(0.32)).catch(() => markTask(0.32))
    } else {
      markTask(0.32)
    }

    // Track poster + primary cherry cutout
    PRELOAD_IMAGES.forEach(src => {
      const img = new Image()
      const settle = () => markTask(0.3)
      img.onload = settle
      img.onerror = settle
      img.src = src
    })

    // Safety cap so preloader always completes and wipes up in <= 1.6s
    const forceReadyTimer = window.setTimeout(() => {
      targetProgress = 1
      assetsCompleted = true
    }, 820)

    const hardFinishTimer = window.setTimeout(() => {
      if (!finishedRef.current) {
        finishedRef.current = true
        setDismissed(true)
        onDone()
      }
    }, 1520)

    let raf = 0
    let last = performance.now()
    let displayed = 0

    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000))
      last = now

      if (phase === 'loading') {
        // Creep smoothly toward targetProgress so progress never stalls visibly
        const effectiveTarget = assetsCompleted ? 1 : Math.min(0.92, targetProgress + 0.14)
        progressSpring.setTarget(effectiveTarget)
        const val = clamp(progressSpring.step(dt), 0, 1)
        const nextCount = Math.round(val * 100)
        if (nextCount !== displayed) {
          displayed = nextCount
          setCount(nextCount)
        }
        if (fillRef.current) {
          fillRef.current.style.clipPath = `inset(0 ${(100 - val * 100).toFixed(2)}% 0 0)`
        }
        if (assetsCompleted && val >= 0.975) {
          setCount(100)
          if (fillRef.current) fillRef.current.style.clipPath = 'inset(0 0% 0 0)'
          phase = 'squeeze'
          squeezeStarted = now
          squeezeSpring.snap(0.9)
          squeezeSpring.setTarget(1)
        }
      } else if (phase === 'squeeze') {
        const sx = squeezeSpring.step(dt)
        const sy = 1 / Math.sqrt(Math.max(0.75, sx))
        if (wordRef.current) {
          wordRef.current.style.transform = `scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`
        }
        if (now - squeezeStarted > 260 || squeezeSpring.atRest(0.015)) {
          phase = 'wipe'
          wipeSpring.setTarget(-102)
        }
      } else if (phase === 'wipe') {
        const yPct = wipeSpring.step(dt)
        if (rootRef.current) {
          rootRef.current.style.transform = `translate3d(0, ${yPct.toFixed(2)}%, 0)`
        }
        if (yPct <= -99.5 || wipeSpring.atRest(0.3)) {
          phase = 'done'
          if (!finishedRef.current) {
            finishedRef.current = true
            setDismissed(true)
            onDone()
          }
          return
        }
      }

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(forceReadyTimer)
      window.clearTimeout(hardFinishTimer)
    }
  }, [done, onDone])

  if (dismissed) return null

  return (
    <div ref={rootRef} className="preloader" aria-hidden={dismissed}>
      <div ref={wordRef} className="preloader__mark" aria-label="Loading MOCHI">
        <span className="preloader__word preloader__word--base" aria-hidden="true">MOCHI</span>
        <span ref={fillRef} className="preloader__word preloader__word--fill" aria-hidden="true">MOCHI</span>
      </div>
      <span className="preloader__count micro" aria-live="polite">
        {String(count).padStart(3, '0')}
      </span>
    </div>
  )
}
