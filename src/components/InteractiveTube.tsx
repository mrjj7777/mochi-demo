import { useEffect, useRef } from 'react'
import { type Flavour } from '../brand'
import { clamp, createSpring, rubberBand } from '../physics'

/** Interactive real-photo MOCHI tube: press or drag to squish on jelly spring (120/9) and pop the milky cap off. */
export default function InteractiveTube({ item, className = '' }: { item: Flavour; className?: string }) {
  const bodyRef = useRef<HTMLImageElement>(null)
  const capRef = useRef<HTMLImageElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)

  const squishSpring = useRef(createSpring('jelly', 0))
  const capSpring = useRef(createSpring('jelly', 0))
  const tiltSpring = useRef(createSpring('jelly', 0))
  const dragRef = useRef({ active: false, startX: 0, startY: 0 })
  const rafRef = useRef(0)

  const isSideCap = item.asset === 'cherry'
  const src = `/media/cutouts/mochi-${item.asset}.webp`

  useEffect(() => {
    let disposed = false
    let lastNow = performance.now()

    // Reset springs smoothly when switching flavour
    squishSpring.current.snap(0)
    capSpring.current.snap(0)
    tiltSpring.current.snap(0)

    const tick = (now: number) => {
      rafRef.current = 0
      if (disposed) return
      const dt = Math.min(0.045, Math.max(0.001, (now - lastNow) / 1000))
      lastNow = now

      const sq = clamp(squishSpring.current.step(dt), -0.35, 1.35)
      const cap = clamp(capSpring.current.step(dt), -0.25, 1.4)
      const tilt = clamp(tiltSpring.current.step(dt), -18, 18)

      const scaleY = clamp(1 - sq * 0.14, 0.78, 1.12)
      const scaleX = clamp(1 / Math.pow(scaleY, 0.78), 0.9, 1.18)

      if (bodyRef.current) {
        bodyRef.current.style.transform = `rotate(${tilt.toFixed(2)}deg) scale(${scaleX.toFixed(4)}, ${scaleY.toFixed(4)})`
      }
      if (capRef.current) {
        if (isSideCap) {
          const hopY = -cap * 32
          const hopRot = -cap * 16 + tilt * 0.4
          capRef.current.style.transform = `translate3d(${(cap * 8).toFixed(2)}px, ${hopY.toFixed(2)}px, 0) rotate(${hopRot.toFixed(2)}deg)`
        } else {
          const popY = -cap * 48
          const popX = cap * 14 + tilt * 0.8
          const popRot = cap * 16 + tilt * 0.65
          capRef.current.style.transform = `translate3d(${popX.toFixed(2)}px, ${popY.toFixed(2)}px, 0) rotate(${popRot.toFixed(2)}deg)`
        }
      }

      if (
        dragRef.current.active ||
        !squishSpring.current.atRest(0.0005) ||
        !capSpring.current.atRest(0.0005) ||
        !tiltSpring.current.atRest(0.005)
      ) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }

    const wake = () => {
      if (!rafRef.current && !disposed) {
        lastNow = performance.now()
        rafRef.current = requestAnimationFrame(tick)
      }
    }

    const stage = stageRef.current
    if (!stage) return

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return
      dragRef.current = { active: true, startX: e.clientX, startY: e.clientY }
      squishSpring.current.setTarget(1)
      squishSpring.current.setVelocity(3.2)
      capSpring.current.setTarget(1)
      capSpring.current.setVelocity(4.8)
      stage.setPointerCapture(e.pointerId)
      wake()
    }

    const onMove = (e: PointerEvent) => {
      if (!dragRef.current.active) return
      const dx = e.clientX - dragRef.current.startX
      const dy = e.clientY - dragRef.current.startY
      const boundedTilt = rubberBand(dx * 0.14, 14)
      const extraSquish = clamp(1 + Math.abs(dy) * 0.004, 0.85, 1.25)
      tiltSpring.current.setTarget(boundedTilt)
      squishSpring.current.setTarget(extraSquish)
      capSpring.current.setTarget(clamp(1 + Math.hypot(dx, dy) * 0.003, 1, 1.3))
      wake()
    }

    const onUp = (e: PointerEvent) => {
      if (!dragRef.current.active) return
      dragRef.current.active = false
      squishSpring.current.setTarget(0)
      capSpring.current.setTarget(0)
      tiltSpring.current.setTarget(0)
      if (stage.hasPointerCapture(e.pointerId)) stage.releasePointerCapture(e.pointerId)
      wake()
    }

    stage.addEventListener('pointerdown', onDown)
    stage.addEventListener('pointermove', onMove)
    stage.addEventListener('pointerup', onUp)
    stage.addEventListener('pointercancel', onUp)
    return () => {
      disposed = true
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      stage.removeEventListener('pointerdown', onDown)
      stage.removeEventListener('pointermove', onMove)
      stage.removeEventListener('pointerup', onUp)
      stage.removeEventListener('pointercancel', onUp)
    }
  }, [isSideCap, item.asset])

  return (
    <div
      ref={stageRef}
      className={`flavour-tube ${isSideCap ? 'flavour-tube--side-cap' : 'flavour-tube--top-cap'} ${className}`}
      role="button"
      tabIndex={0}
      aria-label={`Press or drag ${item.name} tube to squish and pop the cap`}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          stageRef.current?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))
          window.setTimeout(() => {
            stageRef.current?.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
          }, 260)
        }
      }}
    >
      <img
        ref={bodyRef}
        className="flavour-panel__image flavour-tube__body"
        src={src}
        alt={`${item.name} lip jelly`}
        loading="eager"
        decoding="async"
        draggable={false}
      />
      <img
        ref={capRef}
        className="flavour-panel__image flavour-tube__cap"
        src={src}
        alt=""
        aria-hidden="true"
        loading="eager"
        decoding="async"
        draggable={false}
      />
    </div>
  )
}
