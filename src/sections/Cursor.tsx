import { useEffect, useRef, useState } from 'react'
import { createSpring } from '../physics/spring'

export type CursorProps = {
  suppressed?: boolean
}

/**
 * Thin `+` crosshair easing after the pointer (`settle` spring) that opens
 * cleanly into `[ ]` corner brackets around interactive buttons and links.
 * Hidden on touch devices, reduced motion, or when `suppressed` (Texture loupe).
 */
export default function Cursor({ suppressed = false }: CursorProps) {
  const [enabled, setEnabled] = useState(false)
  const [visible, setVisible] = useState(false)
  const [bracketed, setBracketed] = useState(false)

  const boxRef = useRef<HTMLDivElement>(null)
  const crossRef = useRef<HTMLSpanElement>(null)

  const xSpring = useRef(createSpring('settle', -100))
  const ySpring = useRef(createSpring('settle', -100))
  const wSpring = useRef(createSpring('ui', 16))
  const hSpring = useRef(createSpring('ui', 16))
  const openSpring = useRef(createSpring('ui', 0))

  const targetElRef = useRef<HTMLElement | null>(null)
  const pointerRef = useRef({ x: -100, y: -100, seen: false })
  const rafRef = useRef(0)

  useEffect(() => {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)')
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setEnabled(fine.matches && !reduced.matches)
    update()
    fine.addEventListener?.('change', update)
    reduced.addEventListener?.('change', update)
    return () => {
      fine.removeEventListener?.('change', update)
      reduced.removeEventListener?.('change', update)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return

    let last = performance.now()
    const wake = () => {
      if (!rafRef.current) {
        last = performance.now()
        rafRef.current = requestAnimationFrame(step)
      }
    }

    const step = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000))
      last = now

      const targetEl = targetElRef.current
      if (targetEl && document.contains(targetEl)) {
        const rect = targetEl.getBoundingClientRect()
        xSpring.current.setTarget(rect.left + rect.width * 0.5)
        ySpring.current.setTarget(rect.top + rect.height * 0.5)
        wSpring.current.setTarget(Math.max(24, rect.width + 14))
        hSpring.current.setTarget(Math.max(24, rect.height + 10))
        openSpring.current.setTarget(1)
      } else {
        xSpring.current.setTarget(pointerRef.current.x)
        ySpring.current.setTarget(pointerRef.current.y)
        wSpring.current.setTarget(16)
        hSpring.current.setTarget(16)
        openSpring.current.setTarget(0)
      }

      const x = xSpring.current.step(dt)
      const y = ySpring.current.step(dt)
      const w = wSpring.current.step(dt)
      const h = hSpring.current.step(dt)
      const open = openSpring.current.step(dt)

      if (boxRef.current) {
        boxRef.current.style.transform = `translate3d(${(x - w * 0.5).toFixed(2)}px, ${(y - h * 0.5).toFixed(2)}px, 0)`
        boxRef.current.style.width = `${w.toFixed(1)}px`
        boxRef.current.style.height = `${h.toFixed(1)}px`
        boxRef.current.style.setProperty('--bracket-open', open.toFixed(3))
      }
      if (crossRef.current) {
        crossRef.current.style.opacity = `${Math.max(0, 1 - open * 1.4).toFixed(3)}`
      }

      const active =
        !xSpring.current.atRest(0.15) ||
        !ySpring.current.atRest(0.15) ||
        !wSpring.current.atRest(0.15) ||
        !hSpring.current.atRest(0.15) ||
        !openSpring.current.atRest(0.01)

      if (active) {
        rafRef.current = requestAnimationFrame(step)
      } else {
        rafRef.current = 0
      }
    }

    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return
      const first = !pointerRef.current.seen
      pointerRef.current = { x: event.clientX, y: event.clientY, seen: true }
      if (first) {
        xSpring.current.snap(event.clientX)
        ySpring.current.snap(event.clientY)
      }
      setVisible(true)

      const hit = (event.target as HTMLElement | null)?.closest<HTMLElement>(
        'button, a, [role="tab"], [data-cursor-bracket]',
      ) ?? null
      if (hit !== targetElRef.current) {
        targetElRef.current = hit
        setBracketed(Boolean(hit))
      }
      wake()
    }

    const onLeave = () => {
      setVisible(false)
      targetElRef.current = null
      setBracketed(false)
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('mouseleave', onLeave)
    return () => {
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('mouseleave', onLeave)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
  }, [enabled])

  if (!enabled) return null

  const hidden = !visible || suppressed

  return (
    <div
      ref={boxRef}
      className={`mochi-cursor ${bracketed ? 'mochi-cursor--bracketed' : ''} ${hidden ? 'mochi-cursor--hidden' : ''}`}
      style={hidden ? { display: 'none' } : undefined}
      aria-hidden="true"
    >
      <span ref={crossRef} className="mochi-cursor__cross" />
      <span className="mochi-cursor__corner mochi-cursor__corner--tl" />
      <span className="mochi-cursor__corner mochi-cursor__corner--tr" />
      <span className="mochi-cursor__corner mochi-cursor__corner--bl" />
      <span className="mochi-cursor__corner mochi-cursor__corner--br" />
    </div>
  )
}
