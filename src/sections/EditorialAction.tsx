import { useEffect, useRef, useState } from 'react'
import { createSpring } from '../physics/spring'

type CommonProps = {
  children: React.ReactNode
  className?: string
  reduced?: boolean
  darkSurface?: boolean
  ariaLabel?: string
}

type ButtonVariant = CommonProps & {
  as?: 'button'
  onClick?: React.MouseEventHandler<HTMLButtonElement>
  type?: 'button' | 'submit' | 'reset'
}

type LinkVariant = CommonProps & {
  as: 'a'
  href: string
  download?: boolean | string
  onClick?: React.MouseEventHandler<HTMLAnchorElement>
}

export type EditorialActionProps = ButtonVariant | LinkVariant

/**
 * Straight-edged editorial text CTA driven strictly by `ui` springs.
 * - Hover/focus: 1px underline draws left-to-right.
 * - Pointerdown: scale dips to 0.97 and an ink block sweeps behind text in milk.
 */
export default function EditorialAction(props: EditorialActionProps) {
  const { children, className = '', reduced = false, darkSurface = false, ariaLabel } = props
  const rootRef = useRef<HTMLButtonElement & HTMLAnchorElement>(null)
  const lineRef = useRef<HTMLSpanElement>(null)
  const inkRef = useRef<HTMLSpanElement>(null)
  const labelRef = useRef<HTMLSpanElement>(null)

  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)

  const scaleSpring = useRef(createSpring('ui', 1))
  const lineSpring = useRef(createSpring('ui', 0))
  const sweepSpring = useRef(createSpring('ui', 0))
  const rafRef = useRef(0)

  useEffect(() => {
    const lineTarget = hovered || pressed ? 1 : 0
    const scaleTarget = pressed ? 0.97 : 1
    const sweepTarget = pressed ? 1 : 0

    scaleSpring.current.setTarget(scaleTarget)
    lineSpring.current.setTarget(lineTarget)
    sweepSpring.current.setTarget(sweepTarget)

    const applyVisuals = () => {
      const root = rootRef.current
      const line = lineRef.current
      const ink = inkRef.current
      const label = labelRef.current
      if (root) root.style.transform = `scale(${scaleSpring.current.value.toFixed(4)})`
      if (line) line.style.transform = `scaleX(${lineSpring.current.value.toFixed(4)})`
      if (ink) ink.style.transform = `scaleX(${sweepSpring.current.value.toFixed(4)})`
      if (label) {
        const inverted = sweepSpring.current.value > 0.35
        if (darkSurface) {
          label.style.color = inverted ? 'var(--ink)' : 'var(--milk)'
        } else {
          label.style.color = inverted ? 'var(--milk)' : 'var(--ink)'
        }
      }
    }

    if (reduced) {
      scaleSpring.current.snap(scaleTarget)
      lineSpring.current.snap(lineTarget)
      sweepSpring.current.snap(sweepTarget)
      applyVisuals()
      return
    }

    let last = performance.now()
    const step = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000))
      last = now
      scaleSpring.current.step(dt)
      lineSpring.current.step(dt)
      sweepSpring.current.step(dt)
      applyVisuals()
      if (!scaleSpring.current.atRest() || !lineSpring.current.atRest() || !sweepSpring.current.atRest()) {
        rafRef.current = requestAnimationFrame(step)
      } else {
        rafRef.current = 0
      }
    }

    if (!rafRef.current) rafRef.current = requestAnimationFrame(step)
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = 0
      }
    }
  }, [hovered, pressed, reduced, darkSurface])

  const handlers = {
    onPointerEnter: () => setHovered(true),
    onPointerLeave: () => {
      setHovered(false)
      setPressed(false)
    },
    onPointerDown: () => setPressed(true),
    onPointerUp: () => setPressed(false),
    onPointerCancel: () => setPressed(false),
    onFocus: () => setHovered(true),
    onBlur: () => {
      setHovered(false)
      setPressed(false)
    },
  }

  const inkStyle = darkSurface ? { background: 'var(--milk)' } : undefined

  if (props.as === 'a') {
    return (
      <a
        ref={rootRef}
        className={`editorial-action ${className}`}
        href={props.href}
        download={props.download}
        aria-label={ariaLabel}
        onClick={props.onClick}
        {...handlers}
      >
        <span ref={inkRef} className="editorial-action__ink" style={{ ...inkStyle, transform: 'scaleX(0)' }} aria-hidden="true" />
        <span ref={labelRef} className="editorial-action__label">{children}</span>
        <span ref={lineRef} className="editorial-action__line" style={{ transform: 'scaleX(0)' }} aria-hidden="true" />
      </a>
    )
  }

  return (
    <button
      ref={rootRef}
      type={props.type ?? 'button'}
      className={`editorial-action ${className}`}
      aria-label={ariaLabel}
      onClick={props.onClick}
      {...handlers}
    >
      <span ref={inkRef} className="editorial-action__ink" style={{ ...inkStyle, transform: 'scaleX(0)' }} aria-hidden="true" />
      <span ref={labelRef} className="editorial-action__label">{children}</span>
      <span ref={lineRef} className="editorial-action__line" style={{ transform: 'scaleX(0)' }} aria-hidden="true" />
    </button>
  )
}
