import { useEffect, useMemo, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { clamp } from '../physics'
import './Belief.css'

gsap.registerPlugin(ScrollTrigger, useGSAP)

type LineSpec = {
  id: 'soft' | 'squeezable' | 'yours'
  text: string
  className: string
  /** -1 = top line presses down, 0 = center core squashes, +1 = bottom line presses up */
  role: -1 | 0 | 1
}

const LINES: LineSpec[] = [
  { id: 'soft', text: 'soft.', className: 'belief__word--cherry', role: -1 },
  { id: 'squeezable', text: 'squeezable.', className: 'belief__word--lychee', role: 0 },
  { id: 'yours', text: 'yours.', className: 'belief__word--mango', role: 1 },
]

type ViscousSpring = { value: number; velocity: number; target: number }

function stepViscous(s: ViscousSpring, dt: number, stiffness: number, damping: number, mass: number) {
  const force = (s.target - s.value) * stiffness
  const accel = (force - s.velocity * damping) / mass
  s.velocity += accel * dt
  s.value += s.velocity * dt
}

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = clamp((x - edge0) / Math.max(1e-4, edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

export default function Belief() {
  const sectionRef = useRef<HTMLElement>(null)
  const pinRef = useRef<HTMLDivElement>(null)
  const wordRefs = useRef<Array<HTMLSpanElement | null>>([])
  const charRefs = useRef<Array<Array<HTMLSpanElement | null>>>([])

  const progressRef = useRef(0)
  const velocityRef = useRef(0)
  const activeRef = useRef(false)

  const charLists = useMemo(() => LINES.map(line => Array.from(line.text)), [])

  useEffect(() => {
    const section = sectionRef.current
    const pin = pinRef.current
    if (!section || !pin) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) return

    let disposed = false
    let rafId = 0
    let lastNow = performance.now()

    // Real-world viscous elastomer springs (heavy matte silicone feel: firm, tactile, zero cartoon jitter)
    const spreadSpring: ViscousSpring = { value: 1, velocity: 0, target: 1 }
    const squeezeSpring: ViscousSpring = { value: 0, velocity: 0, target: 0 }
    const releaseOvershoot: ViscousSpring = { value: 0, velocity: 0, target: 0 }

    const charSprings: ViscousSpring[][] = charLists.map(chars =>
      chars.map(() => ({ value: 0, velocity: 0, target: 0 })),
    )

    const tick = (now: number) => {
      rafId = 0
      if (disposed || document.visibilityState === 'hidden') return

      const dt = Math.min(0.04, Math.max(0.001, (now - lastNow) / 1000))
      lastNow = now

      const p = progressRef.current
      // Decay instantaneous scroll velocity smoothly
      velocityRef.current *= Math.exp(-9 * dt)
      const velBoost = clamp(Math.abs(velocityRef.current) * 0.08, 0, 0.14)

      // Phase 1 (0.00 -> 0.28): lines glide inward from architectural spread to touching contact
      // Phase 2 (0.24 -> 0.66): peak physical compression across all three lines together
      // Phase 3 (0.64 -> 0.96): elastic release — lines breathe back open with tactile silicone rebound
      const approach = 1 - smoothstep(0.0, 0.28, p)
      const releaseOpen = smoothstep(0.66, 0.96, p)
      const targetSpread = Math.max(approach, releaseOpen * 0.92)

      const squeezeIn = smoothstep(0.22, 0.5, p)
      const squeezeOut = 1 - smoothstep(0.56, 0.78, p)
      const rawSqueeze = clamp(squeezeIn * squeezeOut + squeezeIn * squeezeOut * velBoost, 0, 1.08)

      // Release recoil impulse when crossing past peak compression
      const releaseWave = smoothstep(0.62, 0.74, p) * (1 - smoothstep(0.74, 0.94, p))

      spreadSpring.target = targetSpread
      squeezeSpring.target = rawSqueeze
      releaseOvershoot.target = releaseWave

      // Weighted elastomer constants: heavy mass + smooth viscous damping
      stepViscous(spreadSpring, dt, 130, 22, 1.35)
      stepViscous(squeezeSpring, dt, 155, 19.5, 1.45)
      stepViscous(releaseOvershoot, dt, 120, 16.5, 1.2)

      const spread = spreadSpring.value
      const sq = clamp(squeezeSpring.value, -0.1, 1.15)
      const recoil = releaseOvershoot.value

      const isMobile = window.innerWidth <= 767
      const maxSpreadPx = isMobile ? 38 : 76
      const maxPressPx = isMobile ? 18 : 40

      LINES.forEach((line, lineIdx) => {
        const wordEl = wordRefs.current[lineIdx]
        const chars = charLists[lineIdx]
        const mid = (chars.length - 1) / 2

        // Line-level vertical travel: spread apart at rest, locked tightly together under squeeze
        let lineY = 0
        if (line.role === -1) {
          lineY = -spread * maxSpreadPx + sq * maxPressPx - recoil * (isMobile ? 7 : 14)
        } else if (line.role === 1) {
          lineY = spread * maxSpreadPx - sq * maxPressPx + recoil * (isMobile ? 7 : 14)
        } else {
          // Center line absorbs micro vertical shift from scroll velocity
          lineY = clamp(velocityRef.current * 2.2, -10, 10) * (0.25 + sq * 0.75)
        }

        // Line-level compression & Poisson volume preservation (100% GPU transform — ZERO layout reflow)
        const compressStrength = line.role === 0 ? 0.32 : 0.22
        const lineScaleY = clamp(1 - sq * compressStrength + recoil * 0.045, 0.64, 1.08)
        const lineScaleX = clamp(1 / Math.pow(lineScaleY, 0.44), 0.96, 1.18)

        if (wordEl) {
          wordEl.style.transform = `translate3d(0, ${lineY.toFixed(2)}px, 0) scale(${lineScaleX.toFixed(4)}, ${lineScaleY.toFixed(4)})`
        }

        // Per-character micro-elasticity on desktop; mobile stays locked 60fps via word-level elastomer transforms
        if (!isMobile) {
          chars.forEach((_, charIdx) => {
            const normDist = mid > 0 ? (charIdx - mid) / mid : 0 // -1..+1
            const centerWeight = 1 - Math.min(1, Math.abs(normDist)) * 0.55
            const cSpring = charSprings[lineIdx][charIdx]
            cSpring.target = sq * centerWeight

            // Subtle physical phase lag from center outward
            const stiffness = 175 - Math.abs(normDist) * 32
            stepViscous(cSpring, dt, stiffness, 20, 1.25)

            const charEl = charRefs.current[lineIdx]?.[charIdx]
            if (charEl) {
              const cSq = clamp(cSpring.value, -0.08, 1.15)
              // Outer characters subtly push outward as inner material compresses (real elastomer Poisson bulge)
              const bulgeX = normDist * cSq * 7.5
              const cScaleY = clamp(1 - cSq * (line.role === 0 ? 0.09 : 0.06), 0.88, 1.04)
              const cScaleX = clamp(1 / Math.pow(cScaleY, 0.5), 0.97, 1.07)
              charEl.style.transform = `translate3d(${bulgeX.toFixed(2)}px, 0, 0) scale(${cScaleX.toFixed(4)}, ${cScaleY.toFixed(4)})`
            }
          })
        }
      })

      const settled =
        Math.abs(spreadSpring.target - spreadSpring.value) < 0.001 &&
        Math.abs(spreadSpring.velocity) < 0.001 &&
        Math.abs(squeezeSpring.target - squeezeSpring.value) < 0.001 &&
        Math.abs(squeezeSpring.velocity) < 0.001 &&
        Math.abs(releaseOvershoot.target - releaseOvershoot.value) < 0.001 &&
        Math.abs(releaseOvershoot.velocity) < 0.001 &&
        Math.abs(velocityRef.current) < 0.01

      if (activeRef.current || !settled) {
        rafId = requestAnimationFrame(tick)
      }
    }

    const wake = () => {
      if (disposed || document.visibilityState === 'hidden') return
      if (!rafId) {
        lastNow = performance.now()
        rafId = requestAnimationFrame(tick)
      }
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        activeRef.current = entry?.isIntersecting ?? false
        if (activeRef.current) wake()
      },
      { threshold: 0 },
    )
    observer.observe(section)

    const onWake = () => wake()
    pin.addEventListener('mochi-belief-wake', onWake)
    wake()

    return () => {
      disposed = true
      observer.disconnect()
      pin.removeEventListener('mochi-belief-wake', onWake)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [charLists])

  useGSAP(
    () => {
      const section = sectionRef.current
      const pin = pinRef.current
      if (!section || !pin) return
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (reduced) return

      const isMobile = window.matchMedia('(max-width: 767px)').matches
      const trigger = ScrollTrigger.create({
        trigger: section,
        start: 'top top',
        end: () => `+=${Math.round(window.innerHeight * (isMobile ? 1.2 : 2.3))}`,
        pin: true,
        pinSpacing: true,
        anticipatePin: 1,
        scrub: true,
        invalidateOnRefresh: true,
        onUpdate: self => {
          progressRef.current = self.progress
          velocityRef.current = clamp(self.getVelocity() / 1400, -2.5, 2.5)
          pin.dispatchEvent(new Event('mochi-belief-wake'))
        },
      })
      return () => trigger.kill()
    },
    { scope: sectionRef },
  )

  return (
    <section
      ref={sectionRef}
      id="belief"
      className="belief section"
      data-aura="#2FA4A8,#E46A8E"
      aria-label="soft. squeezable. yours."
    >
      <div ref={pinRef} className="belief__pin">
        <div className="belief__stack">
          {LINES.map((line, lineIdx) => (
            <span
              key={line.id}
              ref={el => {
                wordRefs.current[lineIdx] = el
              }}
              className={`belief__word ${line.className}`}
            >
              {charLists[lineIdx].map((ch, charIdx) => (
                <span
                  key={`${line.id}-${charIdx}`}
                  ref={el => {
                    if (!charRefs.current[lineIdx]) charRefs.current[lineIdx] = []
                    charRefs.current[lineIdx][charIdx] = el
                  }}
                  className="belief__char"
                  aria-hidden="true"
                >
                  {ch}
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
