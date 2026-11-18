import { useEffect, useMemo, useRef, useState } from 'react'
import { useFitText } from './fitText'
import {
  computeNormalDentTargets,
  extractWordLetters,
  getCachedKronaFont,
  loadKronaFont,
  serializeContours,
} from './opentypeLetters'
import { SPRINGS, clamp, createSpring, type SpringValue } from './spring'
import './kinetic.css'

type FooterSectionProps = {
  reduced: boolean
}

function FooterWordFallback() {
  const ref = useRef<HTMLSpanElement>(null)
  useFitText(ref, { maxWidthRatio: 1.0, minPx: 11, maxPx: 520 })
  return (
    <span ref={ref} className="footer__fallback">
      MOCHI
    </span>
  )
}

export default function FooterSection({ reduced }: FooterSectionProps) {
  const [font, setFont] = useState(() => getCachedKronaFont())
  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const groupRefs = useRef<Array<SVGGElement | null>>([])
  const pathRefs = useRef<Array<SVGPathElement | null>>([])
  const enteredRef = useRef(false)

  useEffect(() => {
    if (font) return
    let active = true
    loadKronaFont()
      .then(loaded => {
        if (active) setFont(loaded)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [font])

  const word = useMemo(() => {
    if (!font) return null
    return extractWordLetters(font, 'MOCHI', {
      fontSize: 100,
      paddingX: 10,
      paddingTop: 10,
      paddingBottom: 10,
    })
  }, [font])

  useEffect(() => {
    if (!word) return
    const wrapEl = wrapRef.current
    const svgEl = svgRef.current
    if (!wrapEl || !svgEl) return

    pathRefs.current.forEach((node, idx) => {
      if (node && word.letters[idx]) {
        node.setAttribute('d', word.letters[idx].basePath)
      }
    })

    if (reduced) {
      enteredRef.current = true
      svgEl.style.opacity = '1'
      groupRefs.current.forEach(node => {
        if (node) node.removeAttribute('transform')
      })
      return
    }

    const { stiffness, damping, mass } = SPRINGS.jelly
    const vertexBuffers = word.letters.map(letter => ({
      disp: new Float32Array(letter.vertexCount),
      vel: new Float32Array(letter.vertexCount),
      target: new Float32Array(letter.vertexCount),
    }))

    type LetterMotion = {
      cx: number
      baselineY: number
      phase: 'waiting' | 'falling' | 'spring' | 'settled'
      delay: number
      dropY: number
      dropVy: number
      bounced: boolean
      springY: SpringValue
      springScaleY: SpringValue
      pushX: SpringValue
      pushY: SpringValue
    }

    const letterMotions: LetterMotion[] = word.letters.map((letter, idx) => ({
      cx: letter.box.cx,
      baselineY: letter.box.y2,
      phase: enteredRef.current ? 'settled' : 'waiting',
      delay: idx * 0.05,
      dropY: -48 - idx * 6,
      dropVy: 0,
      bounced: false,
      springY: createSpring('jelly', 0),
      springScaleY: createSpring('jelly', 1),
      pushX: createSpring('jelly', 0),
      pushY: createSpring('jelly', 0),
    }))

    if (!enteredRef.current) {
      svgEl.style.opacity = '0'
    } else {
      svgEl.style.opacity = '1'
    }

    const pointer = { x: 0, y: 0, active: false, down: false }
    let raf = 0
    let entryElapsed = 0
    let lastTime = performance.now()
    let disposed = false

    const wake = () => {
      if (disposed || raf) return
      lastTime = performance.now()
      raf = requestAnimationFrame(tick)
    }

    const triggerEntry = () => {
      if (enteredRef.current || disposed) return
      enteredRef.current = true
      entryElapsed = 0
      svgEl.style.opacity = '1'
      for (const lm of letterMotions) {
        lm.phase = 'falling'
      }
      wake()
    }

    const updatePointer = (event: PointerEvent) => {
      const rect = svgEl.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return
      pointer.x = ((event.clientX - rect.left) / rect.width) * word.totalWidth
      pointer.y = ((event.clientY - rect.top) / rect.height) * word.totalHeight
      pointer.active = true
      wake()
    }

    const onPointerDown = (event: PointerEvent) => {
      pointer.down = true
      updatePointer(event)
    }

    const onPointerUp = () => {
      pointer.down = false
      wake()
    }

    const onPointerLeave = () => {
      pointer.active = false
      pointer.down = false
      wake()
    }

    const tick = (now: number) => {
      raf = 0
      if (disposed) return
      const rawDt = clamp((now - lastTime) / 1000, 0, 0.05)
      lastTime = now
      entryElapsed += rawDt
      const substeps = rawDt > 0.022 ? 2 : 1
      const dt = rawDt / substeps

      const maxDent = pointer.down ? 6.8 : 4.8
      const radius = 52
      let anyActive = pointer.active

      for (let i = 0; i < word.letters.length; i += 1) {
        const letter = word.letters[i]
        const lm = letterMotions[i]
        const buf = vertexBuffers[i]

        // 1. Entry gravity drop -> single baseline bounce -> jelly settle
        let yOffset = 0
        let scaleY = 1
        let scaleX = 1

        if (lm.phase === 'falling') {
          anyActive = true
          if (entryElapsed >= lm.delay) {
            const gravity = 1100
            lm.dropVy += gravity * rawDt
            lm.dropY += lm.dropVy * rawDt
            if (lm.dropY >= 0) {
              if (!lm.bounced) {
                lm.bounced = true
                lm.dropY = 0
                lm.dropVy = -lm.dropVy * 0.24
                lm.springScaleY.snap(0.88)
                lm.springScaleY.setTarget(1)
              } else {
                lm.phase = 'spring'
                lm.springY.snap(0)
                lm.springY.setVelocity(lm.dropVy * 0.25)
                lm.springY.setTarget(0)
              }
            }
          }
          yOffset = lm.dropY
          for (let step = 0; step < substeps; step += 1) {
            lm.springScaleY.step(dt)
          }
          scaleY = clamp(lm.springScaleY.value, 0.82, 1.15)
          scaleX = clamp(1 / Math.sqrt(scaleY), 0.9, 1.12)
        } else if (lm.phase === 'spring') {
          for (let step = 0; step < substeps; step += 1) {
            lm.springY.step(dt)
            lm.springScaleY.step(dt)
          }
          yOffset = lm.springY.value
          scaleY = clamp(lm.springScaleY.value, 0.84, 1.14)
          scaleX = clamp(1 / Math.sqrt(scaleY), 0.9, 1.1)
          if (lm.springY.atRest(0.02) && lm.springScaleY.atRest(0.002)) {
            lm.phase = 'settled'
            lm.springY.snap(0)
            lm.springScaleY.snap(1)
          } else {
            anyActive = true
          }
        }

        // 2. Pointer proximity push (gentle whole-letter home spring + vertex denting)
        if (pointer.active) {
          const dx = letter.box.cx - pointer.x
          const dy = letter.box.cy - pointer.y
          const dist = Math.hypot(dx, dy)
          if (dist < 72 && dist > 0.5) {
            const falloff = Math.exp(-(dist * dist) / (2 * 34 * 34))
            const strength = pointer.down ? 7.5 : 5.2
            lm.pushX.setTarget(clamp((dx / dist) * strength * falloff, -6, 6))
            lm.pushY.setTarget(clamp((dy / dist) * strength * falloff, -6, 6))
          } else {
            lm.pushX.setTarget(0)
            lm.pushY.setTarget(0)
          }
          computeNormalDentTargets(letter, pointer.x, pointer.y, {
            radius,
            maxDent,
            out: buf.target,
          })
        } else {
          lm.pushX.setTarget(0)
          lm.pushY.setTarget(0)
          buf.target.fill(0)
        }

        for (let step = 0; step < substeps; step += 1) {
          lm.pushX.step(dt)
          lm.pushY.step(dt)
        }

        const pushActive = !lm.pushX.atRest(0.01) || !lm.pushY.atRest(0.01)
        if (pushActive) anyActive = true

        const groupEl = groupRefs.current[i]
        if (groupEl) {
          const totalX = clamp(lm.pushX.value, -7, 7)
          const totalY = yOffset + clamp(lm.pushY.value, -7, 7)
          if (
            Math.abs(totalX) < 0.01 &&
            Math.abs(totalY) < 0.01 &&
            Math.abs(scaleX - 1) < 0.001 &&
            Math.abs(scaleY - 1) < 0.001
          ) {
            groupEl.removeAttribute('transform')
          } else {
            groupEl.setAttribute(
              'transform',
              `translate(${(lm.cx + totalX).toFixed(2)}, ${(lm.baselineY + totalY).toFixed(2)}) scale(${scaleX.toFixed(4)}, ${scaleY.toFixed(4)}) translate(${(-lm.cx).toFixed(2)}, ${(-lm.baselineY).toFixed(2)})`,
            )
          }
        }

        // 3. Per-vertex normal denting on `jelly` spring
        let maxAbs = 0
        let maxVel = 0
        for (let step = 0; step < substeps; step += 1) {
          for (let vIdx = 0; vIdx < letter.vertexCount; vIdx += 1) {
            const u = buf.disp[vIdx]
            const v = buf.vel[vIdx]
            const t = buf.target[vIdx]
            const acc = ((t - u) * stiffness - v * damping) / mass
            const nextV = v + acc * dt
            const nextU = clamp(u + nextV * dt, -2.0, 7.2)
            buf.vel[vIdx] = nextV
            buf.disp[vIdx] = nextU
            if (step === substeps - 1) {
              const absU = Math.abs(nextU)
              const absV = Math.abs(nextV)
              if (absU > maxAbs) maxAbs = absU
              if (absV > maxVel) maxVel = absV
            }
          }
        }

        const pathEl = pathRefs.current[i]
        if (pathEl) {
          if (maxAbs < 0.008 && maxVel < 0.015 && !pointer.active) {
            buf.disp.fill(0)
            buf.vel.fill(0)
            pathEl.setAttribute('d', letter.basePath)
          } else {
            anyActive = true
            pathEl.setAttribute('d', serializeContours(letter.contours, buf.disp))
          }
        }
      }

      if (anyActive) {
        raf = requestAnimationFrame(tick)
      }
    }

    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          observer.disconnect()
          triggerEntry()
        }
      },
      { threshold: 0.08 },
    )
    observer.observe(wrapEl)

    const rect = wrapEl.getBoundingClientRect()
    if (rect.top < window.innerHeight * 0.96 && rect.bottom > 0) {
      observer.disconnect()
      triggerEntry()
    }

    wrapEl.addEventListener('pointermove', updatePointer, { passive: true })
    wrapEl.addEventListener('pointerdown', onPointerDown, { passive: true })
    window.addEventListener('pointerup', onPointerUp, { passive: true })
    wrapEl.addEventListener('pointerleave', onPointerLeave, { passive: true })
    wrapEl.addEventListener('pointercancel', onPointerLeave, { passive: true })

    return () => {
      disposed = true
      observer.disconnect()
      if (raf) cancelAnimationFrame(raf)
      wrapEl.removeEventListener('pointermove', updatePointer)
      wrapEl.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
      wrapEl.removeEventListener('pointerleave', onPointerLeave)
      wrapEl.removeEventListener('pointercancel', onPointerLeave)
    }
  }, [word, reduced])

  const ratio = word ? `${word.totalWidth} / ${word.totalHeight}` : '421.62 / 98.42'

  return (
    <footer id="footer" className="footer section" data-aura="#2346B8,#B3122E">
      <div
        ref={wrapRef}
        className="footer__wordmark-wrap"
        style={{ aspectRatio: ratio }}
        aria-label="MOCHI"
      >
        {word ? (
          <>
            <svg
              ref={svgRef}
              className="footer__svg"
              viewBox={word.viewBox}
              preserveAspectRatio="xMidYMid meet"
              aria-hidden="true"
            >
              {word.letters.map((letter, idx) => (
                <g
                  key={`footer-${idx}-${letter.char}`}
                  ref={node => {
                    groupRefs.current[idx] = node
                  }}
                >
                  <path
                    ref={node => {
                      pathRefs.current[idx] = node
                    }}
                    d={letter.basePath}
                    fill="currentColor"
                    fillRule="nonzero"
                  />
                </g>
              ))}
            </svg>
            <span className="kinetic-sr-only">MOCHI</span>
          </>
        ) : (
          <FooterWordFallback />
        )}
      </div>

      <p className="footer__signoff">
        <em>squeeze responsibly.</em>
      </p>
      <p className="footer__credit micro">Made by J&amp;J Intelligence</p>
      <p className="footer__legal micro">
        Studio demo · MOCHI is an invented brand by J&amp;J Intelligence. Not a real product.
      </p>
    </footer>
  )
}
