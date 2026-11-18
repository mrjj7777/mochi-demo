import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { clamp, createSpring } from '../physics/spring'
import type { SharedSectionProps, SqueezeAnchors } from '../types/mochi'

gsap.registerPlugin(ScrollTrigger, useGSAP)

const SqueezeScene3D = lazy(() => import('../webgl/SqueezeScene3D'))

const CALLOUTS: Array<{ key: keyof SqueezeAnchors; label: string; side: 'left' | 'right'; row: 'top' | 'bottom' }> = [
  { key: 'nozzle', label: '9 ML', side: 'left', row: 'top' },
  { key: 'middle', label: 'SILICONE TUBE', side: 'left', row: 'bottom' },
  { key: 'top', label: 'JELLY, NOT STICKY', side: 'right', row: 'top' },
  { key: 'cap', label: 'MILKY CAP', side: 'right', row: 'bottom' },
]

const DEFAULT_ANCHORS: SqueezeAnchors = {
  nozzle: [0.43, 0.14],
  top: [0.48, 0.31],
  middle: [0.34, 0.50],
  cap: [0.69, 0.76],
}

const HEADING_TEXT = 'one squeeze.'

type LeaderLineGeom = {
  key: keyof SqueezeAnchors
  d: string
  length: number
}

export default function SqueezeSection({ reduced, tier }: SharedSectionProps) {
  const sectionRef = useRef<HTMLElement>(null)
  const pinRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const productBoxRef = useRef<HTMLDivElement>(null)
  const fallbackImgRef = useRef<HTMLImageElement>(null)
  const charRefs = useRef<(HTMLSpanElement | null)[]>([])
  const calloutRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const pathRefs = useRef<Record<string, SVGPathElement | null>>({})

  const [inView, setInView] = useState(false)
  const [progress, setProgress] = useState(0)
  const [anchors, setAnchors] = useState<SqueezeAnchors>(DEFAULT_ANCHORS)
  const [svgSize, setSvgSize] = useState({ width: 1200, height: 700 })
  const [lines, setLines] = useState<LeaderLineGeom[]>([])

  const squeezeSpring = useRef(createSpring('jelly', 0))
  const progressRef = useRef(0)
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 700px)').matches : false,
  )

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 700px)')
    const onChange = () => setIsMobile(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // Lazy-mount 3D scene near viewport
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

  // Bell-curve compression on middle letters of "one squeeze." driven by jelly spring
  useEffect(() => {
    if (reduced) {
      charRefs.current.forEach(node => {
        if (node) node.style.transform = 'scaleX(1)'
      })
      return
    }
    let raf = 0
    let last = performance.now()
    const total = HEADING_TEXT.length
    const center = (total - 1) * 0.5

    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000))
      last = now
      const targetSqueeze = Math.sin(clamp(progressRef.current, 0, 1) * Math.PI)
      squeezeSpring.current.setTarget(targetSqueeze)
      const amount = squeezeSpring.current.step(dt)

      charRefs.current.forEach((node, idx) => {
        if (!node) return
        const dist = (idx - center) / Math.max(1, center)
        const bell = Math.exp(-dist * dist * 3.1)
        const scaleX = clamp(1 - amount * bell * 0.30, 0.66, 1.08)
        const scaleY = 1 + (1 - scaleX) * 0.16
        node.style.transform = `scale(${scaleX.toFixed(4)}, ${scaleY.toFixed(4)})`
      })

      if (fallbackImgRef.current) {
        const sx = 1 + amount * 0.06
        const sy = 1 - amount * 0.05
        fallbackImgRef.current.style.transform = `rotate(-3deg) scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`
      }

      if (!squeezeSpring.current.atRest(0.002) || progressRef.current > 0.01) {
        raf = requestAnimationFrame(tick)
      } else {
        raf = 0
      }
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [progress, reduced])

  // Pin 180vh desktop scroll scrub
  useGSAP(
    () => {
      if (reduced || isMobile || !sectionRef.current || !pinRef.current) return
      const trigger = ScrollTrigger.create({
        trigger: sectionRef.current,
        start: 'top top',
        end: () => `+=${Math.round(window.innerHeight * 0.8)}`,
        pin: pinRef.current,
        scrub: true,
        invalidateOnRefresh: true,
        onUpdate: self => {
          progressRef.current = self.progress
          setProgress(self.progress)
        },
      })
      return () => trigger.kill()
    },
    { scope: sectionRef, dependencies: [reduced, isMobile] },
  )

  // Compute pixel-accurate curved SVG hairline leader lines to live 3D SqueezeAnchors
  const recomputeLines = useCallback(() => {
    const stage = stageRef.current
    const product = productBoxRef.current
    if (!stage || !product) return

    const sr = stage.getBoundingClientRect()
    const pr = product.getBoundingClientRect()
    if (sr.width < 10 || sr.height < 10) return

    setSvgSize({ width: Math.round(sr.width), height: Math.round(sr.height) })

    const computed: LeaderLineGeom[] = []
    CALLOUTS.forEach(item => {
      const labelEl = calloutRefs.current[item.key]
      if (!labelEl) return
      const lr = labelEl.getBoundingClientRect()
      const anchor = anchors[item.key] ?? DEFAULT_ANCHORS[item.key]

      const startX = item.side === 'left' ? lr.right - sr.left + 10 : lr.left - sr.left - 10
      const startY = lr.top - sr.top + lr.height * 0.5

      const endX = pr.left - sr.left + anchor[0] * pr.width
      const endY = pr.top - sr.top + anchor[1] * pr.height

      const midX = startX + (endX - startX) * 0.56
      const ctrl1Y = startY
      const ctrl2Y = endY
      const d = `M ${startX.toFixed(1)} ${startY.toFixed(1)} C ${midX.toFixed(1)} ${ctrl1Y.toFixed(1)}, ${midX.toFixed(1)} ${ctrl2Y.toFixed(1)}, ${endX.toFixed(1)} ${endY.toFixed(1)}`
      const approxLen = Math.hypot(endX - startX, endY - startY) * 1.25
      computed.push({ key: item.key, d, length: Math.max(40, approxLen) })
    })
    setLines(computed)
  }, [anchors])

  useEffect(() => {
    recomputeLines()
    const stage = stageRef.current
    if (!stage) return
    const ro = new ResizeObserver(recomputeLines)
    ro.observe(stage)
    window.addEventListener('resize', recomputeLines)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', recomputeLines)
    }
  }, [recomputeLines])

  const use3D = inView && !reduced && tier !== 'low'
  const lineDraw = reduced ? 1 : isMobile ? 1 : clamp((progress - 0.08) / 0.36, 0.25, 1)

  return (
    <section
      id="squeeze"
      ref={sectionRef}
      className={`squeeze section ${reduced ? 'squeeze--reduced' : ''}`}
      data-aura="#2FA4A8,#F2EDE4"
    >
      <div ref={pinRef} className="squeeze__pin">
        <div ref={stageRef} className="squeeze__stage mochi-grid">
          <div className="squeeze__heading-wrap">
            <h2 className="display squeeze__title" aria-label={HEADING_TEXT}>
              {Array.from(HEADING_TEXT).map((ch, idx) => (
                <span
                  key={`${ch}-${idx}`}
                  ref={el => {
                    charRefs.current[idx] = el
                  }}
                  className="squeeze__char"
                  aria-hidden="true"
                >
                  {ch === ' ' ? '\u00A0' : ch}
                </span>
              ))}
            </h2>
          </div>

          <div ref={productBoxRef} className="squeeze__product">
            {use3D ? (
              <Suspense
                fallback={
                  <img
                    ref={fallbackImgRef}
                    className="squeeze__cutout"
                    src="/media/cutouts/mochi-cherry.webp"
                    width={1122}
                    height={1402}
                    alt="Cherry MOCHI lip jelly tube"
                    loading="lazy"
                    decoding="async"
                  />
                }
              >
                <SqueezeScene3D
                  progress={progress}
                  reducedMotion={reduced}
                  tier={tier}
                  onAnchors={setAnchors}
                />
              </Suspense>
            ) : (
              <img
                ref={fallbackImgRef}
                className="squeeze__cutout"
                src="/media/cutouts/mochi-cherry.webp"
                width={1122}
                height={1402}
                alt="Cherry MOCHI lip jelly tube"
                loading="lazy"
                decoding="async"
              />
            )}
          </div>

          {/* 1px Curved SVG Hairline Leader Lines to live SqueezeAnchors */}
          <svg
            className="squeeze__leaders"
            viewBox={`0 0 ${svgSize.width} ${svgSize.height}`}
            width={svgSize.width}
            height={svgSize.height}
            aria-hidden="true"
          >
            {lines.map((line, index) => {
              const pathEl = pathRefs.current[line.key]
              const totalLen = pathEl?.getTotalLength?.() || line.length
              const reveal = clamp((lineDraw - index * 0.08) / 0.65, 0, 1)
              const offset = totalLen * (1 - reveal)
              return (
                <path
                  key={line.key}
                  ref={el => {
                    pathRefs.current[line.key] = el
                  }}
                  d={line.d}
                  fill="none"
                  stroke="rgba(20, 20, 20, 0.48)"
                  strokeWidth="1"
                  strokeDasharray={totalLen}
                  strokeDashoffset={offset}
                />
              )
            })}
          </svg>

          {/* Plain Mono Callouts — zero boxes, zero pills */}
          <div className="squeeze__callouts">
            {CALLOUTS.map(item => (
              <div
                key={item.key}
                ref={el => {
                  calloutRefs.current[item.key] = el
                }}
                className={`squeeze__callout squeeze__callout--${item.side} squeeze__callout--${item.row} micro`}
              >
                {item.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
