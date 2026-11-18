import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { clamp, createSpring } from '../physics/spring'
import type { DeviceTier } from '../types/mochi'
import { useMediaMeta } from './media'

const RefractiveLoupe = lazy(() => import('../webgl/RefractiveLoupe'))

export type TextureSectionProps = {
  reduced: boolean
  tier: DeviceTier
  onLoupeHover?: (hovered: boolean) => void
}

const IMAGE_SRC = '/media/photos/mochi-peach-model.webp'

export default function TextureSection({ reduced, tier, onLoupeHover }: TextureSectionProps) {
  const sectionRef = useRef<HTMLElement>(null)
  const meta = useMediaMeta(IMAGE_SRC)

  const [inView, setInView] = useState(false)
  const [visible, setVisible] = useState(false)
  const [coords, setCoords] = useState({ xPct: 54, yPct: 44 })
  const [wobbleKey, setWobbleKey] = useState(0)
  const [isTouch, setIsTouch] = useState(false)

  const targetRef = useRef({ x: 54, y: 44 })
  const xSpring = useRef(createSpring('settle', 54))
  const ySpring = useRef(createSpring('settle', 44))
  const stopTimerRef = useRef(0)
  const activeHoverRef = useRef(false)

  useEffect(() => {
    const coarse = window.matchMedia('(pointer: coarse)')
    const update = () => setIsTouch(coarse.matches)
    update()
    coarse.addEventListener?.('change', update)
    return () => coarse.removeEventListener?.('change', update)
  }, [])

  // Lazy-mount WebGL loupe near viewport
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

  // Desktop: settle spring tracks pointer; Touch: gentle figure-8 drift over glossy lips
  useEffect(() => {
    if (reduced) {
      setVisible(false)
      return
    }

    let raf = 0
    let last = performance.now()

    if (isTouch) {
      setVisible(true)
      const started = performance.now()
      const drift = (now: number) => {
        const t = (now - started) / 1000
        const x = 52 + Math.sin(t * 0.55) * 11
        const y = 44 + Math.sin(t * 1.1) * 7
        setCoords({ xPct: x, yPct: y })
        raf = requestAnimationFrame(drift)
      }
      raf = requestAnimationFrame(drift)
      return () => cancelAnimationFrame(raf)
    }

    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000))
      last = now
      xSpring.current.setTarget(targetRef.current.x)
      ySpring.current.setTarget(targetRef.current.y)
      const x = xSpring.current.step(dt)
      const y = ySpring.current.step(dt)
      setCoords({ xPct: x, yPct: y })
      if (!xSpring.current.atRest(0.02) || !ySpring.current.atRest(0.02) || activeHoverRef.current) {
        raf = requestAnimationFrame(tick)
      } else {
        raf = 0
      }
    }

    if (visible) raf = requestAnimationFrame(tick)
    return () => {
      if (raf) cancelAnimationFrame(raf)
    }
  }, [isTouch, reduced, visible])

  const updatePointerTarget = (event: React.PointerEvent<HTMLElement>) => {
    if (reduced || isTouch || event.pointerType === 'touch') return
    const rect = event.currentTarget.getBoundingClientRect()
    const x = clamp(((event.clientX - rect.left) / Math.max(1, rect.width)) * 100, 8, 92)
    const y = clamp(((event.clientY - rect.top) / Math.max(1, rect.height)) * 100, 12, 88)
    targetRef.current = { x, y }

    window.clearTimeout(stopTimerRef.current)
    stopTimerRef.current = window.setTimeout(() => {
      if (activeHoverRef.current) setWobbleKey(k => k + 1)
    }, 95)
  }

  const handleEnter = (event: React.PointerEvent<HTMLElement>) => {
    if (reduced || isTouch || event.pointerType === 'touch') return
    activeHoverRef.current = true
    const rect = event.currentTarget.getBoundingClientRect()
    const x = clamp(((event.clientX - rect.left) / Math.max(1, rect.width)) * 100, 8, 92)
    const y = clamp(((event.clientY - rect.top) / Math.max(1, rect.height)) * 100, 12, 88)
    targetRef.current = { x, y }
    xSpring.current.snap(x)
    ySpring.current.snap(y)
    setCoords({ xPct: x, yPct: y })
    setVisible(true)
    onLoupeHover?.(true)
  }

  const handleLeave = () => {
    activeHoverRef.current = false
    window.clearTimeout(stopTimerRef.current)
    if (!isTouch) {
      setVisible(false)
      onLoupeHover?.(false)
    }
  }

  useEffect(() => {
    return () => {
      window.clearTimeout(stopTimerRef.current)
      onLoupeHover?.(false)
    }
  }, [onLoupeHover])

  const useWebGL = inView && !reduced && tier !== 'low'

  const domFallbackLens = visible && !reduced && (
    <div
      className="texture__lens-fallback"
      style={{
        left: `${coords.xPct.toFixed(2)}%`,
        top: `${coords.yPct.toFixed(2)}%`,
        backgroundImage: `url(${IMAGE_SRC})`,
        backgroundPosition: `${coords.xPct.toFixed(2)}% ${coords.yPct.toFixed(2)}%`,
      }}
      aria-hidden="true"
    >
      <span className="crop-mark crop-mark--tl" />
      <span className="crop-mark crop-mark--tr" />
      <span className="crop-mark crop-mark--bl" />
      <span className="crop-mark crop-mark--br" />
    </div>
  )

  return (
    <section
      id="texture"
      ref={sectionRef}
      className={`texture section ${visible ? 'texture--loupe-active' : ''}`}
      data-aura="#8FC3E6,#F4A27E"
      onPointerEnter={handleEnter}
      onPointerMove={updatePointerTarget}
      onPointerLeave={handleLeave}
    >
      {/* Full-bleed peach macro with >= 24vh multi-stop top/bottom fade masks */}
      <div
        className="texture__photo"
        style={
          meta.blurDataUrl
            ? { backgroundImage: `url(${meta.blurDataUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : undefined
        }
      >
        <picture>
          {meta.avif && <source srcSet={meta.avif} type="image/avif" />}
          <img
            src={IMAGE_SRC}
            width={meta.width}
            height={meta.height}
            alt="MOCHI peach lip jelly on glossy lips"
            loading="lazy"
            decoding="async"
          />
        </picture>

        {!reduced &&
          (useWebGL ? (
            <Suspense fallback={domFallbackLens}>
              <RefractiveLoupe
                imageSrc={IMAGE_SRC}
                xPct={coords.xPct}
                yPct={coords.yPct}
                visible={visible}
                wobbleKey={wobbleKey}
                reducedMotion={reduced}
              />
            </Suspense>
          ) : (
            domFallbackLens
          ))}

        {visible && !reduced && (
          <span
            className="texture__readout micro"
            style={{
              left: `${clamp(coords.xPct, 14, 72).toFixed(2)}%`,
              top: `${clamp(coords.yPct, 18, 76).toFixed(2)}%`,
            }}
            aria-hidden="true"
          >
            2.0× — GLOSS
          </span>
        )}
      </div>

      <p className="texture__line">
        real lips. <em className="emotion">real gloss.</em>
      </p>
      {(!visible || reduced) && <span className="texture__static-readout micro">2.0× — GLOSS</span>}
    </section>
  )
}
