import { useEffect, useRef, useState } from 'react'
import { useFlavour } from '../context/FlavourContext'
import { createSpring } from '../physics/spring'

export type HeaderProps = {
  bag: number
  onJump: (id: string) => void
}

type NavItemProps = {
  label: string
  active: boolean
  onClick: () => void
  className?: string
  ariaLabel?: string
}

function BracketNavButton({ label, active, onClick, className = '', ariaLabel }: NavItemProps) {
  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)
  const leftRef = useRef<HTMLSpanElement>(null)
  const rightRef = useRef<HTMLSpanElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  const bracketSpring = useRef(createSpring('ui', active ? 1 : 0))
  const scaleSpring = useRef(createSpring('ui', 1))
  const rafRef = useRef(0)

  useEffect(() => {
    const show = active || hovered
    bracketSpring.current.setTarget(show ? 1 : 0)
    scaleSpring.current.setTarget(pressed ? 0.97 : 1)

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const apply = () => {
      const b = bracketSpring.current.value
      const s = scaleSpring.current.value
      if (btnRef.current) btnRef.current.style.transform = `scale(${s.toFixed(4)})`
      if (leftRef.current) {
        leftRef.current.style.opacity = b.toFixed(3)
        leftRef.current.style.transform = `translate3d(${((1 - b) * 6).toFixed(2)}px, 0, 0)`
      }
      if (rightRef.current) {
        rightRef.current.style.opacity = b.toFixed(3)
        rightRef.current.style.transform = `translate3d(${((b - 1) * 6).toFixed(2)}px, 0, 0)`
      }
    }

    if (reduced) {
      bracketSpring.current.snap(show ? 1 : 0)
      scaleSpring.current.snap(pressed ? 0.97 : 1)
      apply()
      return
    }

    let last = performance.now()
    const step = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000))
      last = now
      bracketSpring.current.step(dt)
      scaleSpring.current.step(dt)
      apply()
      if (!bracketSpring.current.atRest() || !scaleSpring.current.atRest()) {
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
  }, [active, hovered, pressed])

  return (
    <button
      ref={btnRef}
      type="button"
      className={`nav-link micro ${active ? 'nav-link--active' : ''} ${className}`}
      onClick={onClick}
      aria-label={ariaLabel ?? label}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => {
        setHovered(false)
        setPressed(false)
      }}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => {
        setHovered(false)
        setPressed(false)
      }}
    >
      <span ref={leftRef} className="nav-link__bracket nav-link__bracket--l" aria-hidden="true">[</span>
      <span className="nav-link__text">{label}</span>
      <span ref={rightRef} className="nav-link__bracket nav-link__bracket--r" aria-hidden="true">]</span>
    </button>
  )
}

function RollingBagCount({ bag }: { bag: number }) {
  const [display, setDisplay] = useState({ prev: bag, next: bag, rolling: false })
  const trackRef = useRef<HTMLSpanElement>(null)
  const springRef = useRef(createSpring('ui', 1))

  useEffect(() => {
    if (bag === display.next) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const oldVal = display.next
    setDisplay({ prev: oldVal, next: bag, rolling: !reduced })

    if (reduced) return
    springRef.current.snap(0)
    springRef.current.setTarget(1)

    let raf = 0
    let last = performance.now()
    const step = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000))
      last = now
      const p = springRef.current.step(dt)
      if (trackRef.current) {
        trackRef.current.style.transform = `translate3d(0, ${(-p * 50).toFixed(2)}%, 0)`
      }
      if (!springRef.current.atRest(0.004)) {
        raf = requestAnimationFrame(step)
      } else {
        setDisplay({ prev: bag, next: bag, rolling: false })
      }
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [bag, display.next])

  return (
    <span className="nav-bag__slot" aria-hidden="true">
      {display.rolling ? (
        <span ref={trackRef} className="nav-bag__roller">
          <span>{display.prev}</span>
          <span>{display.next}</span>
        </span>
      ) : (
        <span className="nav-bag__static">{display.next}</span>
      )}
    </span>
  )
}

export default function Header({ bag, onJump }: HeaderProps) {
  const { activeSection } = useFlavour()
  const [observed, setObserved] = useState<string>('hero')

  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>('main section[id], footer[id]'))
    if (!sections.length) return
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (visible?.target.id) setObserved(visible.target.id)
      },
      { threshold: [0.15, 0.45, 0.7] },
    )
    sections.forEach(s => observer.observe(s))
    return () => observer.disconnect()
  }, [])

  const current = observed || activeSection

  return (
    <header className="site-header">
      <BracketNavButton
        label="MOCHI"
        active={current === 'hero'}
        onClick={() => onJump('hero')}
        className="site-header__brand"
        ariaLabel="MOCHI, jump to top"
      />
      <nav className="site-header__nav" aria-label="Primary navigation">
        <BracketNavButton
          label="FLAVOURS"
          active={current === 'flavours'}
          onClick={() => onJump('flavours')}
        />
        <BracketNavButton
          label="WALLPAPERS"
          active={current === 'wallpapers'}
          onClick={() => onJump('wallpapers')}
        />
        <button
          type="button"
          className="nav-bag micro"
          data-bag-target="true"
          onClick={() => onJump('flavours')}
          aria-label={`Bag, ${bag} items`}
        >
          <span>BAG (</span>
          <RollingBagCount bag={bag} />
          <span>)</span>
        </button>
      </nav>
    </header>
  )
}
