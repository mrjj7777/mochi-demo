import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { flavours } from '../brand'
import { useFlavour } from '../context/FlavourContext'
import { clamp, createSpring } from '../physics/spring'
import type { DeviceTier, Flavour } from '../types/mochi'
import EditorialAction from './EditorialAction'

const FlavoursScene3D = lazy(() => import('../webgl/FlavoursScene3D'))

export type FlavoursSectionProps = {
  reduced: boolean
  tier: DeviceTier
  bag: number
  onAdd: (flavour: Flavour) => void
}

export default function FlavoursSection({ reduced, tier, onAdd }: FlavoursSectionProps) {
  const { flavour: ctxFlavour, setFlavour } = useFlavour()
  const sectionRef = useRef<HTMLElement>(null)
  const productStageRef = useRef<HTMLDivElement>(null)
  const ctaWrapRef = useRef<HTMLDivElement>(null)
  const fallbackImgRef = useRef<HTMLImageElement>(null)

  const [inView, setInView] = useState(false)
  const [fillProgress, setFillProgress] = useState(1)
  const swipeRef = useRef<{ x: number; y: number } | null>(null)

  const activeIndex = Math.max(
    0,
    flavours.findIndex(item => item.key === ctxFlavour.key),
  )
  const active = flavours[activeIndex] ?? flavours[0]

  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const io = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) {
          setInView(true)
          io.disconnect()
        }
      },
      { rootMargin: '280px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // Trigger outline -> fill transition + jelly landing spring on flavour change
  useEffect(() => {
    if (reduced) {
      setFillProgress(1)
      return
    }
    setFillProgress(0)
    const fillSpring = createSpring('settle', 0)
    fillSpring.setTarget(1)
    const landSpring = createSpring('jelly', 0.9)
    landSpring.setTarget(1)

    let raf = 0
    let last = performance.now()
    const startWait = window.setTimeout(() => {
      const tick = (now: number) => {
        const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000))
        last = now
        const f = clamp(fillSpring.step(dt), 0, 1)
        const s = landSpring.step(dt)
        setFillProgress(f)
        if (fallbackImgRef.current) {
          const sx = 1 / Math.sqrt(Math.max(0.75, s))
          fallbackImgRef.current.style.transform = `scale(${sx.toFixed(4)}, ${s.toFixed(4)})`
        }
        if (!fillSpring.atRest(0.005) || !landSpring.atRest(0.005)) {
          raf = requestAnimationFrame(tick)
        }
      }
      raf = requestAnimationFrame(tick)
    }, 110)

    return () => {
      window.clearTimeout(startWait)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [active.key, reduced])

  const selectIndex = useCallback(
    (nextIndex: number) => {
      const wrapped = (nextIndex + flavours.length) % flavours.length
      setFlavour(flavours[wrapped])
    },
    [setFlavour],
  )

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      selectIndex(activeIndex + 1)
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      selectIndex(activeIndex - 1)
    }
  }

  // Launch a tiny cutout tube along a parabolic arc into Header BAG (n)
  const launchFlyTube = () => {
    if (reduced) return
    const bagTarget = document.querySelector<HTMLElement>('[data-bag-target="true"]')
    const startRect = (productStageRef.current ?? ctaWrapRef.current)?.getBoundingClientRect()
    if (!bagTarget || !startRect) return

    const endRect = bagTarget.getBoundingClientRect()
    const startX = startRect.left + startRect.width * 0.5
    const startY = startRect.top + startRect.height * 0.45
    const endX = endRect.left + endRect.width * 0.5
    const endY = endRect.top + endRect.height * 0.5

    const ghost = document.createElement('img')
    ghost.src = `/media/cutouts/mochi-${active.asset}.webp`
    ghost.alt = ''
    ghost.setAttribute('aria-hidden', 'true')
    ghost.style.position = 'fixed'
    ghost.style.left = '0px'
    ghost.style.top = '0px'
    ghost.style.width = '54px'
    ghost.style.height = '68px'
    ghost.style.objectFit = 'contain'
    ghost.style.pointerEvents = 'none'
    ghost.style.zIndex = '95'
    ghost.style.transformOrigin = 'center center'
    document.body.appendChild(ghost)

    const ctrlX = (startX + endX) * 0.5 + 90
    const ctrlY = Math.min(startY, endY) - 120
    const started = performance.now()
    const duration = 560

    const animateArc = (now: number) => {
      const t = clamp((now - started) / duration, 0, 1)
      const ease = 1 - Math.pow(1 - t, 3)
      const inv = 1 - ease
      const x = inv * inv * startX + 2 * inv * ease * ctrlX + ease * ease * endX
      const y = inv * inv * startY + 2 * inv * ease * ctrlY + ease * ease * endY
      const scale = 1 - ease * 0.72
      const rot = ease * 24
      ghost.style.transform = `translate3d(${(x - 27).toFixed(1)}px, ${(y - 34).toFixed(1)}px, 0) scale(${scale.toFixed(3)}) rotate(${rot.toFixed(1)}deg)`
      ghost.style.opacity = t > 0.8 ? String(1 - (t - 0.8) / 0.2) : '1'

      if (t < 1) {
        requestAnimationFrame(animateArc)
      } else {
        ghost.remove()
      }
    }
    requestAnimationFrame(animateArc)
  }

  const handleAdd = () => {
    onAdd(active)
    launchFlyTube()
  }

  // Swipe on the outer stage background (outside interactive 3D tube drag)
  const onStagePointerDown = (event: React.PointerEvent<HTMLElement>) => {
    const target = event.target as HTMLElement
    if (target.closest('.flavours__stage') || target.closest('button')) return
    swipeRef.current = { x: event.clientX, y: event.clientY }
  }

  const onStagePointerUp = (event: React.PointerEvent<HTMLElement>) => {
    if (!swipeRef.current) return
    const dx = event.clientX - swipeRef.current.x
    const dy = event.clientY - swipeRef.current.y
    swipeRef.current = null
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      selectIndex(dx < 0 ? activeIndex + 1 : activeIndex - 1)
    }
  }

  const use3D = inView && !reduced && tier !== 'low'
  const word = active.name.toLowerCase()
  const svgViewWidth = Math.max(620, word.length * 145)

  return (
    <section
      id="flavours"
      ref={sectionRef}
      className="flavours section"
      data-aura={`${active.aura},#F2EDE4`}
      onKeyDown={handleKeyDown}
      onPointerDown={onStagePointerDown}
      onPointerUp={onStagePointerUp}
      tabIndex={-1}
    >
      <div className="flavours__frame">
        {/* Top Metadata */}
        <div className="flavours__top">
          <span className="flavours__label micro">06 FLAVOURS — 9 ML</span>
          <span className="flavours__index micro" aria-live="polite">
            {active.index}/06
          </span>
        </div>

        {/* Giant Fitted Krona Name Behind Tube: 1px outline -> flavour-colour fill */}
        <div className="flavours__backdrop" aria-hidden="true">
          <svg
            className="flavours__word-svg"
            viewBox={`0 0 ${svgViewWidth} 220`}
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <clipPath id={`flavour-fill-${active.key}`}>
                <rect
                  x="0"
                  y={220 * (1 - fillProgress)}
                  width={svgViewWidth}
                  height={220 * fillProgress + 2}
                />
              </clipPath>
            </defs>
            <text
              x={svgViewWidth * 0.5}
              y="165"
              textAnchor="middle"
              className="flavours__svg-text flavours__svg-text--outline"
              stroke={active.key === 'lychee' ? 'rgba(20,20,20,0.45)' : active.jelly}
            >
              {word}
            </text>
            <text
              x={svgViewWidth * 0.5}
              y="165"
              textAnchor="middle"
              className="flavours__svg-text flavours__svg-text--fill"
              fill={active.jelly}
              clipPath={`url(#flavour-fill-${active.key})`}
            >
              {word}
            </text>
          </svg>
        </div>

        {/* Single Locked Centered Product Stage */}
        <div ref={productStageRef} className="flavours__stage">
          {use3D ? (
            <Suspense
              fallback={
                <img
                  ref={fallbackImgRef}
                  className="flavours__cutout"
                  src={`/media/cutouts/mochi-${active.asset}.webp`}
                  width={1122}
                  height={1402}
                  alt={`${active.name} lip jelly`}
                  decoding="async"
                />
              }
            >
              <FlavoursScene3D flavour={active} reducedMotion={reduced} tier={tier} />
            </Suspense>
          ) : (
            <img
              ref={fallbackImgRef}
              className="flavours__cutout"
              src={`/media/cutouts/mochi-${active.asset}.webp`}
              width={1122}
              height={1402}
              alt={`${active.name} lip jelly`}
              decoding="async"
            />
          )}
        </div>

        {/* Bottom Copy, Add CTA & Text Switcher */}
        <div className="flavours__controls">
          <p className="flavours__mood">
            {word} — <em className="emotion">{active.mood}</em>
          </p>

          <div ref={ctaWrapRef} className="flavours__cta">
            <EditorialAction onClick={handleAdd} reduced={reduced}>
              + ADD TO BAG
            </EditorialAction>
          </div>

          <div className="flavour-switcher" role="tablist" aria-label="Choose lip jelly flavour">
            {flavours.map((item, idx) => {
              const selected = idx === activeIndex
              const readableAccent =
                item.key === 'lychee'
                  ? '#B84A6A'
                  : item.key === 'mint'
                    ? '#14524A'
                    : item.key === 'mango'
                      ? '#9A6900'
                      : item.jelly
              return (
                <button
                  key={item.key}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  className={`flavour-switcher__tab micro ${selected ? 'flavour-switcher__tab--active' : ''}`}
                  style={selected ? { color: readableAccent, borderBottomColor: readableAccent } : undefined}
                  onClick={() => selectIndex(idx)}
                  aria-label={`${item.name} — ${item.mood}`}
                >
                  <span>{item.name}</span>
                  <sup className="flavour-switcher__sup">{item.index}</sup>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
