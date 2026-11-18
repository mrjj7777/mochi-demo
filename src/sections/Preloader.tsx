import { useEffect, useRef, useState } from 'react'
import { clamp, createSpring } from '../physics/spring'

export type PreloaderProps = {
  onDone: () => void
  done?: boolean
}

const HERO_POSTER = '/media/hero-seq/poster.webp'

/**
 * Wordmark fills horizontally with Cherry jelly red (#B3122E) from 000 to 100
 * driven by font + hero poster readiness, squeezes once, then wipes up swiftly
 * (~550–750ms) so LCP hero poster paints unblocked.
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

    let targetProgress = 0.2
    let assetsCompleted = false
    let phase: 'loading' | 'squeeze' | 'wipe' | 'done' = 'loading'
    let squeezeStarted = 0

    const progressSpring = createSpring({ stiffness: 520, damping: 42, mass: 1 }, 0.15)
    const squeezeSpring = createSpring('jelly', 1)
    const wipeSpring = createSpring('ui', 0)

    const markTask = (weight: number) => {
      targetProgress = clamp(targetProgress + weight, 0, 1)
      if (targetProgress >= 0.99) assetsCompleted = true
    }

    // Track real document.fonts readiness
    if (document.fonts?.ready) {
      document.fonts.ready.then(() => markTask(0.4)).catch(() => markTask(0.4))
    } else {
      markTask(0.4)
    }

    // Track hero poster readiness (preloaded in index.html)
    const posterImg = new Image()
    const settlePoster = () => markTask(0.4)
    posterImg.onload = settlePoster
    posterImg.onerror = settlePoster
    posterImg.src = HERO_POSTER

    // Swift cap so preloader fills, squeezes, and wipes cleanly within ~550–750ms
    const forceReadyTimer = window.setTimeout(() => {
      targetProgress = 1
      assetsCompleted = true
    }, 340)

    const hardFinishTimer = window.setTimeout(() => {
      if (!finishedRef.current) {
        finishedRef.current = true
        setDismissed(true)
        onDone()
      }
    }, 760)

    let raf = 0
    let last = performance.now()
    let displayed = 0

    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000))
      last = now

      if (phase === 'loading') {
        const effectiveTarget = assetsCompleted ? 1 : Math.min(0.92, targetProgress + 0.18)
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
        if (assetsCompleted && val >= 0.96) {
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
        if (now - squeezeStarted > 140 || squeezeSpring.atRest(0.025)) {
          phase = 'wipe'
          if (rootRef.current) rootRef.current.style.pointerEvents = 'none'
          wipeSpring.setTarget(-102)
        }
      } else if (phase === 'wipe') {
        const yPct = wipeSpring.step(dt)
        if (rootRef.current) {
          rootRef.current.style.transform = `translate3d(0, ${yPct.toFixed(2)}%, 0)`
        }
        if (yPct <= -98.5 || wipeSpring.atRest(0.5)) {
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
