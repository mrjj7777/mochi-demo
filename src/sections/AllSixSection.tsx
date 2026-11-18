import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { clamp, createSpring } from '../physics/spring'
import type { SharedSectionProps } from '../types/mochi'
import { useMediaMeta } from './media'

const PilePhysics3D = lazy(() => import('../webgl/PilePhysics3D'))

const PILE_PHOTO = '/media/photos/mochi-all-pile.webp'

export default function AllSixSection({ reduced, tier }: SharedSectionProps) {
  const sectionRef = useRef<HTMLElement>(null)
  const fallbackWrapRef = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  const meta = useMediaMeta(PILE_PHOTO)

  const targetRef = useRef({ x: 0, y: 0 })
  const xSpring = useRef(createSpring('settle', 0))
  const ySpring = useRef(createSpring('settle', 0))

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
      { rootMargin: '220px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const use3D = inView && !reduced && tier !== 'low'

  // Subtle <= 12px pointer parallax for static photo fallback (disabled under reduced motion)
  useEffect(() => {
    if (use3D || reduced) return
    const el = sectionRef.current
    if (!el) return

    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000))
      last = now
      xSpring.current.setTarget(targetRef.current.x)
      ySpring.current.setTarget(targetRef.current.y)
      const x = xSpring.current.step(dt)
      const y = ySpring.current.step(dt)
      if (fallbackWrapRef.current) {
        fallbackWrapRef.current.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`
      }
      if (!xSpring.current.atRest(0.02) || !ySpring.current.atRest(0.02)) {
        raf = requestAnimationFrame(tick)
      } else {
        raf = 0
      }
    }

    const onMove = (event: PointerEvent) => {
      const rect = el.getBoundingClientRect()
      const nx = clamp(((event.clientX - rect.left) / Math.max(1, rect.width) - 0.5) * 2, -1, 1)
      const ny = clamp(((event.clientY - rect.top) / Math.max(1, rect.height) - 0.5) * 2, -1, 1)
      targetRef.current = { x: nx * 12, y: ny * 12 }
      if (!raf) {
        last = performance.now()
        raf = requestAnimationFrame(tick)
      }
    }

    const onLeave = () => {
      targetRef.current = { x: 0, y: 0 }
      if (!raf) {
        last = performance.now()
        raf = requestAnimationFrame(tick)
      }
    }

    el.addEventListener('pointermove', onMove, { passive: true })
    el.addEventListener('pointerleave', onLeave)
    return () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [use3D, reduced])

  const fallbackView = (
    <div ref={fallbackWrapRef} className="all-six__fallback">
      <div
        className="all-six__photo-mask mochi-blur-img"
        style={meta.blurDataUrl ? { backgroundImage: `url(${meta.blurDataUrl})` } : undefined}
      >
        <picture>
          {meta.avif && <source srcSet={meta.avif} type="image/avif" />}
          <img
            className="all-six__image"
            src={PILE_PHOTO}
            width={meta.width}
            height={meta.height}
            alt="All six MOCHI lip jelly flavours in a pile"
            loading="lazy"
            decoding="async"
          />
        </picture>
      </div>
    </div>
  )

  return (
    <section
      id="all-six"
      ref={sectionRef}
      className="all-six section"
      data-aura="#E46A8E,#F2B632"
    >
      <div className="all-six__copy mochi-grid">
        <div className="all-six__copy-inner">
          <p className="all-six__question">can't pick?</p>
          <h2 className="emotion all-six__answer">don't.</h2>
        </div>
      </div>

      <div className="all-six__stage">
        {use3D ? (
          <Suspense fallback={fallbackView}>
            <PilePhysics3D active={inView} reducedMotion={reduced} tier={tier} />
          </Suspense>
        ) : (
          fallbackView
        )}
      </div>
    </section>
  )
}
