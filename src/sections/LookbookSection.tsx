import { useCallback, useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { flavours } from '../brand'
import { PointerHistory, clamp, createSpring, projectMomentum, rubberBandClamp } from '../physics/spring'
import type { Flavour } from '../types/mochi'
import { useMediaMeta } from './media'

gsap.registerPlugin(ScrollTrigger, useGSAP)

export type LookbookSectionProps = {
  reduced: boolean
  onOpen: (src: string, flavour: Flavour, caption?: string) => void
}

type LookbookFrame = {
  index: string
  src: string
  flavour: Flavour
  caption: string
  alt: string
}

const LOOKBOOK_FRAMES: LookbookFrame[] = [
  {
    index: '01',
    src: '/media/photos/mochi-model-1.webp',
    flavour: flavours[0], // CHERRY — loud
    caption: '(01) CHERRY — LOUD',
    alt: 'Creator applying MOCHI Cherry lip jelly',
  },
  {
    index: '02',
    src: '/media/photos/mochi-peach-model.webp',
    flavour: flavours[1], // PEACH — easy
    caption: '(02) PEACH — EASY',
    alt: 'MOCHI Peach lip jelly glossy close-up',
  },
  {
    index: '03',
    src: '/media/photos/mochi-model-4.webp',
    flavour: flavours[2], // LYCHEE — quiet
    caption: '(03) LYCHEE — QUIET',
    alt: 'Creator holding MOCHI Lychee lip jelly',
  },
  {
    index: '04',
    src: '/media/photos/mochi-model-3.webp',
    flavour: flavours[3], // GRAPE — late
    caption: '(04) GRAPE — LATE',
    alt: 'Two creators wearing MOCHI Grape lip jelly',
  },
  {
    index: '05',
    src: '/media/photos/mochi-model-2.webp',
    flavour: flavours[4], // MINT — fresh
    caption: '(05) MINT — FRESH',
    alt: 'Creator holding MOCHI Mint lip jelly',
  },
  {
    index: '06',
    src: '/media/photos/mochi-model-5.webp',
    flavour: flavours[5], // MANGO — sunny
    caption: '(06) MANGO — SUNNY',
    alt: 'Creator holding MOCHI Mango lip jelly',
  },
  {
    index: '07',
    src: '/media/photos/mochi-diptych-cherry.webp',
    flavour: flavours[0], // CHERRY — loud
    caption: '(07) CHERRY — LOUD',
    alt: 'Cherry diptych creator portrait and green light study',
  },
  {
    index: '08',
    src: '/media/photos/mochi-diptych-lychee.webp',
    flavour: flavours[2], // LYCHEE — quiet
    caption: '(08) LYCHEE — QUIET',
    alt: 'Lychee diptych product study and glossy portrait',
  },
]

function LookbookImage({ src, alt, eager = false }: { src: string; alt: string; eager?: boolean }) {
  const meta = useMediaMeta(src)
  return (
    <div
      className="lookbook__media mochi-blur-img"
      style={meta.blurDataUrl ? { backgroundImage: `url(${meta.blurDataUrl})` } : undefined}
    >
      <picture>
        {meta.avif && <source srcSet={meta.avif} type="image/avif" />}
        <img
          src={src}
          width={meta.width}
          height={meta.height}
          alt={alt}
          loading={eager ? 'eager' : 'lazy'}
          decoding={eager ? 'sync' : 'async'}
          draggable={false}
        />
      </picture>
    </div>
  )
}

/**
 * Desktop: Pinned horizontal travel film strip across all 8 creator frames,
 * zero gaps, zero boxes, border-radius 0, PointerHistory momentum drag +
 * rubber-band ends, velocity skew <= 3 deg, and luminous cream studio flash
 * light sweep as each frame passes the focal light center.
 * Mobile / reduced motion: clean vertical edge-to-edge contact stack.
 */
export default function LookbookSection({ reduced, onOpen }: LookbookSectionProps) {
  const sectionRef = useRef<HTMLElement>(null)
  const pinRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const frameRefs = useRef<(HTMLButtonElement | null)[]>([])
  const flashRefs = useRef<(HTMLSpanElement | null)[]>([])

  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 700px)').matches : false,
  )
  const [focusedIndex, setFocusedIndex] = useState(0)

  const scrollProgressRef = useRef(0)
  const dragOffsetSpring = useRef(createSpring('settle', 0))
  const skewSpring = useRef(createSpring('settle', 0))
  const flashSprings = useRef(LOOKBOOK_FRAMES.map(() => createSpring('settle', 0)))
  const historyRef = useRef(new PointerHistory(5))

  const dragStateRef = useRef({
    active: false,
    pointerId: -1,
    startX: 0,
    lastX: 0,
    moved: 0,
    pressedIndex: -1,
  })
  const maxTravelRef = useRef(0)
  const prevTotalXRef = useRef(0)
  const lastFocusedRef = useRef(0)
  const handledPointerTapRef = useRef(false)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 700px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  const desktopPinned = !isMobile && !reduced

  const computeMaxTravel = useCallback(() => {
    const track = trackRef.current
    const viewport = viewportRef.current
    if (!track || !viewport) return 0
    const dist = Math.max(0, track.scrollWidth - viewport.clientWidth)
    maxTravelRef.current = dist
    return dist
  }, [])

  // GSAP ScrollTrigger pins the section and stops vertical motion while travelling horizontally
  useGSAP(
    () => {
      if (!desktopPinned || !sectionRef.current || !pinRef.current) return
      computeMaxTravel()

      const trigger = ScrollTrigger.create({
        trigger: sectionRef.current,
        start: 'top top',
        end: () => `+=${Math.max(900, Math.round(computeMaxTravel() * 0.92))}`,
        pin: pinRef.current,
        scrub: true,
        invalidateOnRefresh: true,
        onRefresh: () => computeMaxTravel(),
        onUpdate: self => {
          scrollProgressRef.current = self.progress
        },
      })

      return () => trigger.kill()
    },
    { scope: sectionRef, dependencies: [desktopPinned, computeMaxTravel] },
  )

  // Continuous physics loop when visible (drag inertia, rubber-banding, skew <= 3 deg, studio flash sweep)
  useEffect(() => {
    if (!desktopPinned) return
    let raf = 0
    let visible = true
    let last = performance.now()
    const section = sectionRef.current

    const io = new IntersectionObserver(
      entries => {
        visible = entries[0]?.isIntersecting ?? true
      },
      { rootMargin: '200px' },
    )
    if (section) io.observe(section)

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      if (!visible || document.hidden) return
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000))
      last = now

      const maxTravel = maxTravelRef.current || computeMaxTravel()
      const baseScrollX = -scrollProgressRef.current * maxTravel

      if (!dragStateRef.current.active) {
        // Clamp drag target gently back inside valid bounds so strip never sits off-edge
        const minDrag = -maxTravel - baseScrollX
        const maxDrag = -baseScrollX
        dragOffsetSpring.current.setTarget(clamp(dragOffsetSpring.current.target, minDrag, maxDrag))
      }

      const rawTotalX = baseScrollX + dragOffsetSpring.current.step(dt)
      const clampedX = dragStateRef.current.active
        ? rubberBandClamp(rawTotalX, -maxTravel, 0, 140)
        : clamp(rawTotalX, -maxTravel - 140, 140)

      // Strip travel velocity -> velocity skew clamped strictly to <= 3 deg
      const instVel = (clampedX - prevTotalXRef.current) / Math.max(0.008, dt)
      prevTotalXRef.current = clampedX
      const globalScrollVel = Number.parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue('--scroll-velocity') || '0',
      )
      const targetSkew = clamp(instVel * 0.0016 + globalScrollVel * 0.45, -3, 3)
      skewSpring.current.setTarget(Math.abs(targetSkew) < 0.01 ? 0 : targetSkew)
      let skewDeg = clamp(skewSpring.current.step(dt), -3, 3)
      if (Math.abs(targetSkew) < 0.01 && Math.abs(skewDeg) < 0.025 && Math.abs(skewSpring.current.velocity) < 0.08) {
        skewSpring.current.snap(0)
        skewDeg = 0
      }

      if (trackRef.current) {
        trackRef.current.style.transform =
          Math.abs(skewDeg) < 0.01
            ? `translate3d(${clampedX.toFixed(2)}px, 0, 0)`
            : `translate3d(${clampedX.toFixed(2)}px, 0, 0) skewX(${skewDeg.toFixed(3)}deg)`
      }

      // Studio flash / luminous cream light sweep as each creator frame enters focal light center
      const vw = window.innerWidth
      const centerX = vw * 0.5
      let nearestIdx = 0
      let nearestDist = Infinity

      frameRefs.current.forEach((frameEl, idx) => {
        if (!frameEl) return
        const rect = frameEl.getBoundingClientRect()
        const frameCenter = rect.left + rect.width * 0.5
        const dist = Math.abs(frameCenter - centerX)
        if (dist < nearestDist) {
          nearestDist = dist
          nearestIdx = idx
        }

        const halfZone = Math.max(180, rect.width * 0.62)
        const proximity = clamp(1 - dist / halfZone, 0, 1)
        const signedPos = clamp((frameCenter - centerX) / halfZone, -1, 1)

        const flashSpring = flashSprings.current[idx]
        flashSpring.setTarget(proximity)
        const light = flashSpring.step(dt)

        const flashOverlay = flashRefs.current[idx]
        if (flashOverlay) {
          const sweepX = signedPos * 38
          flashOverlay.style.opacity = (light * 0.72).toFixed(3)
          flashOverlay.style.transform = `translate3d(${sweepX.toFixed(1)}%, 0, 0)`
        }
        frameEl.style.filter = `brightness(${(1 + light * 0.085).toFixed(3)}) contrast(${(1 + light * 0.03).toFixed(3)})`
      })

      if (nearestIdx !== lastFocusedRef.current) {
        lastFocusedRef.current = nearestIdx
        setFocusedIndex(nearestIdx)
      }
    }

    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
    }
  }, [desktopPinned, computeMaxTravel])

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!desktopPinned) return
    const btn = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>('[data-frame-index]')
    const idx = btn ? Number.parseInt(btn.dataset.frameIndex || '-1', 10) : -1
    dragStateRef.current = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      lastX: event.clientX,
      moved: 0,
      pressedIndex: idx,
    }
    dragOffsetSpring.current.setTarget(dragOffsetSpring.current.value)
    dragOffsetSpring.current.setVelocity(0)
    historyRef.current.reset()
    historyRef.current.add(event.clientX, event.clientY)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!desktopPinned || !dragStateRef.current.active) return
    const dx = event.clientX - dragStateRef.current.lastX
    dragStateRef.current.lastX = event.clientX
    dragStateRef.current.moved += Math.abs(dx)
    historyRef.current.add(event.clientX, event.clientY)

    const nextOffset = dragOffsetSpring.current.target + dx
    dragOffsetSpring.current.setTarget(nextOffset)
    dragOffsetSpring.current.snap(nextOffset)
  }

  const finishDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!desktopPinned || !dragStateRef.current.active) return
    const { moved, pressedIndex } = dragStateRef.current
    dragStateRef.current.active = false

    const vx = historyRef.current.velocity().x
    historyRef.current.reset()

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    if (moved < 6 && pressedIndex >= 0 && LOOKBOOK_FRAMES[pressedIndex]) {
      handledPointerTapRef.current = true
      window.setTimeout(() => {
        handledPointerTapRef.current = false
      }, 60)
      const frame = LOOKBOOK_FRAMES[pressedIndex]
      onOpen(frame.src, frame.flavour, frame.caption)
      return
    }

    const maxTravel = maxTravelRef.current || computeMaxTravel()
    const baseScrollX = -scrollProgressRef.current * maxTravel
    const minDrag = -maxTravel - baseScrollX
    const maxDrag = -baseScrollX
    const projected = clamp(projectMomentum(dragOffsetSpring.current.value, vx), minDrag, maxDrag)
    dragOffsetSpring.current.setVelocity(vx)
    dragOffsetSpring.current.setTarget(projected)
  }

  return (
    <section
      id="lookbook"
      ref={sectionRef}
      className={`lookbook section ${desktopPinned ? 'lookbook--pinned' : 'lookbook--stack'}`}
      data-aura="#F2EDE4,#F6D3D6"
    >
      <div ref={pinRef} className="lookbook__pin">
        {/* Magazine Spread Header: "worn by" Krona left / "everyone." Instrument Serif Italic right */}
        <header className="lookbook__head mochi-grid">
          <h2 className="lookbook__title">
            <span className="display lookbook__title-top">worn by</span>
            <em className="emotion lookbook__title-bottom">everyone.</em>
          </h2>
          {desktopPinned && (
            <span className="lookbook__counter micro" aria-live="polite">
              {LOOKBOOK_FRAMES[focusedIndex]?.index ?? '01'} / 08
            </span>
          )}
        </header>

        <div
          ref={viewportRef}
          className={`lookbook__viewport ${desktopPinned ? 'lookbook__viewport--strip' : 'lookbook__viewport--stack'}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
        >
          <div ref={trackRef} className="lookbook__track">
            {LOOKBOOK_FRAMES.map((frame, idx) => (
              <button
                key={`${frame.index}-${frame.src}`}
                ref={el => {
                  frameRefs.current[idx] = el
                }}
                type="button"
                data-frame-index={idx}
                className="lookbook__frame"
                onClick={() => {
                  if (handledPointerTapRef.current) return
                  onOpen(frame.src, frame.flavour, frame.caption)
                }}
                aria-label={`Open ${frame.caption} lookbook portrait`}
              >
                <div className="lookbook__photo-box">
                  <LookbookImage src={frame.src} alt={frame.alt} eager />
                  {desktopPinned && (
                    <span
                      ref={el => {
                        flashRefs.current[idx] = el
                      }}
                      className="lookbook__flash"
                      aria-hidden="true"
                    />
                  )}
                </div>
                <span className="lookbook__caption micro">{frame.caption}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
