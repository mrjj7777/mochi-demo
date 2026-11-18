import { useEffect, useMemo, useRef, useState } from 'react'
import Matter from 'matter-js'
import { useFitText } from './fitText'
import {
  computeNormalDentTargets,
  extractWordLetters,
  getCachedKronaFont,
  loadKronaFont,
  serializeContours,
  type ExtractedWord,
} from './opentypeLetters'
import { SPRINGS, clamp, createSpring, type SpringValue } from './spring'
import './kinetic.css'

type BeliefSectionProps = {
  reduced: boolean
}

type WordFallbackProps = {
  text: string
  className?: string
}

function WordFallback({ text, className = '' }: WordFallbackProps) {
  const ref = useRef<HTMLSpanElement>(null)
  useFitText(ref, { maxWidthRatio: 0.9, minPx: 11, maxPx: 220 })
  return (
    <span ref={ref} className={`belief__fallback ${className}`}>
      {text}
    </span>
  )
}

/**
 * Word 1: `soft.` (#B3122E)
 * Invisible pointer circle collider pushes nearby path vertices inward along
 * their vertex normals with Gaussian falloff, springing back with `jelly`.
 */
function SoftWord({
  word,
  reduced,
}: {
  word: ExtractedWord | null
  reduced: boolean
}) {
  const hitRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const pathRefs = useRef<Array<SVGPathElement | null>>([])

  useEffect(() => {
    if (!word) return
    pathRefs.current.forEach((el, idx) => {
      if (el && word.letters[idx]) {
        el.setAttribute('d', word.letters[idx].basePath)
      }
    })
    if (reduced) return

    const hitEl = hitRef.current
    const svgEl = svgRef.current
    if (!hitEl || !svgEl) return

    const { stiffness, damping, mass } = SPRINGS.jelly
    const letterBuffers = word.letters.map(letter => ({
      disp: new Float32Array(letter.vertexCount),
      vel: new Float32Array(letter.vertexCount),
      target: new Float32Array(letter.vertexCount),
    }))

    const pointer = { x: 0, y: 0, active: false, down: false }
    let raf = 0
    let lastTime = performance.now()
    let disposed = false

    const wake = () => {
      if (disposed || raf) return
      lastTime = performance.now()
      raf = requestAnimationFrame(tick)
    }

    const updatePointerFromEvent = (event: PointerEvent) => {
      const rect = svgEl.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return
      pointer.x = ((event.clientX - rect.left) / rect.width) * word.totalWidth
      pointer.y = ((event.clientY - rect.top) / rect.height) * word.totalHeight
      pointer.active = true
      wake()
    }

    const onPointerDown = (event: PointerEvent) => {
      pointer.down = true
      updatePointerFromEvent(event)
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
      const substeps = rawDt > 0.022 ? 2 : 1
      const dt = rawDt / substeps

      const maxDent = pointer.down ? 11.0 : 8.2
      const radius = 66
      let anyMoving = pointer.active

      for (let l = 0; l < word.letters.length; l += 1) {
        const letter = word.letters[l]
        const buf = letterBuffers[l]
        if (pointer.active) {
          computeNormalDentTargets(letter, pointer.x, pointer.y, {
            radius,
            maxDent,
            out: buf.target,
          })
        } else {
          buf.target.fill(0)
        }

        let maxAbs = 0
        let maxVel = 0

        for (let step = 0; step < substeps; step += 1) {
          for (let i = 0; i < letter.vertexCount; i += 1) {
            const u = buf.disp[i]
            const v = buf.vel[i]
            const t = buf.target[i]
            const acc = ((t - u) * stiffness - v * damping) / mass
            const nextV = v + acc * dt
            const nextU = clamp(u + nextV * dt, -3.5, 13.8)
            buf.vel[i] = nextV
            buf.disp[i] = nextU
            if (step === substeps - 1) {
              const absU = Math.abs(nextU)
              const absV = Math.abs(nextV)
              if (absU > maxAbs) maxAbs = absU
              if (absV > maxVel) maxVel = absV
            }
          }
        }

        const pathEl = pathRefs.current[l]
        if (pathEl) {
          if (maxAbs < 0.008 && maxVel < 0.015 && !pointer.active) {
            buf.disp.fill(0)
            buf.vel.fill(0)
            pathEl.setAttribute('d', letter.basePath)
          } else {
            anyMoving = true
            pathEl.setAttribute('d', serializeContours(letter.contours, buf.disp))
          }
        }
      }

      if (anyMoving) {
        raf = requestAnimationFrame(tick)
      }
    }

    hitEl.addEventListener('pointermove', updatePointerFromEvent, { passive: true })
    hitEl.addEventListener('pointerdown', onPointerDown, { passive: true })
    window.addEventListener('pointerup', onPointerUp, { passive: true })
    hitEl.addEventListener('pointerleave', onPointerLeave, { passive: true })
    hitEl.addEventListener('pointercancel', onPointerLeave, { passive: true })

    return () => {
      disposed = true
      if (raf) cancelAnimationFrame(raf)
      hitEl.removeEventListener('pointermove', updatePointerFromEvent)
      hitEl.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
      hitEl.removeEventListener('pointerleave', onPointerLeave)
      hitEl.removeEventListener('pointercancel', onPointerLeave)
    }
  }, [word, reduced])

  const ratio = word ? `${word.totalWidth} / ${word.totalHeight}` : '289.3 / 103.25'

  return (
    <div ref={hitRef} className="belief__hit-zone belief__hit-zone--soft">
      <div
        className="belief__word-box belief__word-box--soft"
        style={{ aspectRatio: ratio }}
      >
        {word ? (
          <>
            <svg
              ref={svgRef}
              className="belief__svg belief__svg--soft"
              viewBox={word.viewBox}
              preserveAspectRatio="xMidYMid meet"
              aria-hidden="true"
            >
              {word.letters.map((letter, idx) => (
                <path
                  key={`soft-${idx}-${letter.char}`}
                  ref={node => {
                    pathRefs.current[idx] = node
                  }}
                  d={letter.basePath}
                  fill="#B3122E"
                  fillRule="nonzero"
                />
              ))}
            </svg>
            <span className="kinetic-sr-only">soft.</span>
          </>
        ) : (
          <WordFallback text="soft." className="belief__fallback--soft" />
        )}
      </div>
    </div>
  )
}

/**
 * Word 2: `squeezable.` (#E46A8E)
 * Scroll progress + `--scroll-velocity` compress the word horizontally from
 * both ends (per-letter scaleX bell curve + inward squeeze), springing back
 * with elastic overshoot on release.
 */
function SqueezableWord({
  word,
  reduced,
}: {
  word: ExtractedWord | null
  reduced: boolean
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const groupRefs = useRef<Array<SVGGElement | null>>([])

  useEffect(() => {
    if (!word) return
    groupRefs.current.forEach(node => {
      if (node) node.removeAttribute('transform')
    })
    if (reduced) return

    const boxEl = boxRef.current
    if (!boxEl) return

    const wordCx = word.totalWidth * 0.5
    const halfInkW = Math.max(1, word.inkWidth * 0.5)
    const springs: SpringValue[] = word.letters.map(() => createSpring('jelly', 0))

    let raf = 0
    let idleTimer = 0
    let lastTime = performance.now()
    let lastScrollY = window.scrollY
    let lastScrollTs = performance.now()
    let disposed = false

    const wake = () => {
      if (disposed || raf) return
      lastTime = performance.now()
      raf = requestAnimationFrame(tick)
    }

    const applySqueezeTarget = (pressure: number) => {
      springs.forEach(spring => {
        spring.setTarget(pressure)
      })
      wake()
    }

    const onScroll = () => {
      const now = performance.now()
      const dtScroll = Math.max(8, now - lastScrollTs) / 1000
      const deltaY = Math.abs(window.scrollY - lastScrollY)
      lastScrollY = window.scrollY
      lastScrollTs = now

      const nativeVel = clamp(deltaY / dtScroll / 2100, 0, 1)
      const cssVelRaw = Number.parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue('--scroll-velocity'),
      )
      const cssVel = Number.isFinite(cssVelRaw) ? clamp(Math.abs(cssVelRaw) / 2.5, 0, 1) : 0
      const scrollVelocity = Math.max(nativeVel, cssVel)

      const rect = boxEl.getBoundingClientRect()
      const vh = Math.max(1, window.innerHeight)
      const centerNorm = (rect.top + rect.height * 0.5) / vh
      const inView = rect.bottom > -vh * 0.25 && rect.top < vh * 1.25
      if (!inView) {
        applySqueezeTarget(0)
        return
      }

      const focusBell = clamp(1 - Math.abs(centerNorm - 0.5) / 0.72, 0, 1)
      const progressPulse = Math.sin(clamp((1.15 - centerNorm) / 1.3, 0, 1) * Math.PI)
      const pressure = clamp(
        (0.18 + scrollVelocity * 0.82) * (0.35 + 0.65 * Math.max(focusBell, progressPulse)),
        0,
        0.95,
      )

      applySqueezeTarget(pressure)

      if (idleTimer) window.clearTimeout(idleTimer)
      idleTimer = window.setTimeout(() => {
        idleTimer = 0
        applySqueezeTarget(0)
      }, 90)
    }

    const tick = (now: number) => {
      raf = 0
      if (disposed) return
      const rawDt = clamp((now - lastTime) / 1000, 0, 0.05)
      lastTime = now
      const substeps = rawDt > 0.022 ? 2 : 1
      const dt = rawDt / substeps

      let anyActive = false

      for (let i = 0; i < word.letters.length; i += 1) {
        const letter = word.letters[i]
        const spring = springs[i]
        for (let step = 0; step < substeps; step += 1) {
          spring.step(dt)
        }

        const node = groupRefs.current[i]
        if (node) {
          if (spring.atRest(0.001) && spring.target === 0) {
            spring.snap(0)
            node.removeAttribute('transform')
          } else {
            anyActive = true
            const normX = (letter.box.cx - wordCx) / halfInkW
            const bell = Math.exp(-(normX * normX) / (2 * 0.55 * 0.55))
            const s = clamp(spring.value, -0.35, 0.95)
            const scaleX = clamp(1 - s * (0.12 + 0.24 * bell), 0.58, 1.12)
            const scaleY = clamp(1 + (1 - scaleX) * 0.18, 0.94, 1.1)
            const shiftX = -(letter.box.cx - wordCx) * s * 0.18
            const cx = letter.box.cx
            const cy = letter.box.cy
            node.setAttribute(
              'transform',
              `translate(${(cx + shiftX).toFixed(2)}, ${cy.toFixed(2)}) scale(${scaleX.toFixed(4)}, ${scaleY.toFixed(4)}) translate(${(-cx).toFixed(2)}, ${(-cy).toFixed(2)})`,
            )
          }
        }
      }

      if (anyActive) {
        raf = requestAnimationFrame(tick)
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      disposed = true
      if (raf) cancelAnimationFrame(raf)
      if (idleTimer) window.clearTimeout(idleTimer)
      window.removeEventListener('scroll', onScroll)
    }
  }, [word, reduced])

  const ratio = word ? `${word.totalWidth} / ${word.totalHeight}` : '812.38 / 124.54'

  return (
    <div
      ref={boxRef}
      className="belief__word-box belief__word-box--squeezable"
      style={{ aspectRatio: ratio }}
    >
      {word ? (
        <>
          <svg
            className="belief__svg belief__svg--squeezable"
            viewBox={word.viewBox}
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
          >
            {word.letters.map((letter, idx) => (
              <g
                key={`sq-${idx}-${letter.char}`}
                ref={node => {
                  groupRefs.current[idx] = node
                }}
              >
                <path d={letter.basePath} fill="#E46A8E" fillRule="nonzero" />
              </g>
            ))}
          </svg>
          <span className="kinetic-sr-only">squeezable.</span>
        </>
      ) : (
        <WordFallback text="squeezable." className="belief__fallback--squeezable" />
      )}
    </div>
  )
}

/**
 * Word 3: `yours.` (#C48800)
 * Powered by `matter-js` 2D bodies: letters drop from above on scroll entry,
 * collide with the baseline & neighbours, bounce slightly, and settle smoothly
 * onto exact alignment via `settle` springs. Once settled, they stay still.
 */
function YoursWord({
  word,
  reduced,
}: {
  word: ExtractedWord | null
  reduced: boolean
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const groupRefs = useRef<Array<SVGGElement | null>>([])
  const hasStartedRef = useRef(false)

  useEffect(() => {
    if (!word) return
    const svgEl = svgRef.current
    if (reduced) {
      hasStartedRef.current = true
      if (svgEl) svgEl.style.opacity = '1'
      groupRefs.current.forEach(node => {
        if (node) node.removeAttribute('transform')
      })
      return
    }

    const boxEl = boxRef.current
    if (!boxEl || !svgEl) return

    if (hasStartedRef.current) {
      svgEl.style.opacity = '1'
      groupRefs.current.forEach(node => {
        if (node) node.removeAttribute('transform')
      })
      return
    }

    svgEl.style.opacity = '0'

    let raf = 0
    let disposed = false
    let engine: Matter.Engine | null = null

    const startDrop = () => {
      if (disposed || hasStartedRef.current) return
      hasStartedRef.current = true
      svgEl.style.opacity = '1'

      const CAT_MAIN = 0x0001
      const CAT_DESC = 0x0002
      const CAT_WALL = 0x0004
      const CAT_BASE_FLOOR = 0x0008
      const CAT_DESC_FLOOR = 0x0010

      engine = Matter.Engine.create({
        gravity: { x: 0, y: 2.1, scale: 0.001 },
      })

      const baseFloor = Matter.Bodies.rectangle(
        word.totalWidth * 0.5,
        word.baselineY + 40.5,
        word.totalWidth * 3,
        80,
        {
          isStatic: true,
          restitution: 0.36,
          friction: 0.5,
          collisionFilter: { category: CAT_BASE_FLOOR, mask: CAT_MAIN },
        },
      )

      const descFloorY = word.letters[0]?.box.y2 ?? word.baselineY + 25
      const descFloor = Matter.Bodies.rectangle(
        word.totalWidth * 0.5,
        descFloorY + 40,
        word.totalWidth * 3,
        80,
        {
          isStatic: true,
          restitution: 0.36,
          friction: 0.5,
          collisionFilter: { category: CAT_DESC_FLOOR, mask: CAT_DESC },
        },
      )

      const leftWall = Matter.Bodies.rectangle(-20, -150, 40, 1200, {
        isStatic: true,
        restitution: 0.25,
        collisionFilter: { category: CAT_WALL, mask: CAT_MAIN | CAT_DESC },
      })

      const rightWall = Matter.Bodies.rectangle(word.totalWidth + 20, -150, 40, 1200, {
        isStatic: true,
        restitution: 0.25,
        collisionFilter: { category: CAT_WALL, mask: CAT_MAIN | CAT_DESC },
      })

      type LetterSim = {
        homeCx: number
        homeCy: number
        body: Matter.Body
        settledToSpring: boolean
        sx: SpringValue
        sy: SpringValue
        sa: SpringValue
      }

      const sims: LetterSim[] = word.letters.map((letter, idx) => {
        const isDescender = letter.char === 'y'
        const startX = letter.box.cx + (idx % 2 === 0 ? -1.5 : 1.5)
        const startY = letter.box.cy - 98 - idx * 7
        const body = Matter.Bodies.rectangle(
          startX,
          startY,
          Math.max(8, letter.box.width * 0.8),
          Math.max(8, letter.box.height),
          {
            angle: (idx % 2 === 0 ? -1 : 1) * 0.055,
            restitution: 0.36,
            friction: 0.12,
            frictionAir: 0.014,
            density: 0.002,
            collisionFilter: {
              category: isDescender ? CAT_DESC : CAT_MAIN,
              mask:
                CAT_MAIN |
                CAT_DESC |
                CAT_WALL |
                (isDescender ? CAT_DESC_FLOOR : CAT_BASE_FLOOR),
            },
          },
        )
        return {
          homeCx: letter.box.cx,
          homeCy: letter.box.cy,
          body,
          settledToSpring: false,
          sx: createSpring('settle', 0),
          sy: createSpring('settle', 0),
          sa: createSpring('settle', 0),
        }
      })

      Matter.World.add(engine.world, [
        baseFloor,
        descFloor,
        leftWall,
        rightWall,
        ...sims.map(s => s.body),
      ])

      const startTs = performance.now()
      let lastTs = startTs

      const tick = (now: number) => {
        raf = 0
        if (disposed || !engine) return
        const dt = clamp((now - lastTs) / 1000, 0.001, 0.033)
        lastTs = now
        const elapsed = (now - startTs) / 1000

        const totalMs = dt * 1000
        const substeps = Math.max(1, Math.ceil(totalMs / 16.5))
        const subMs = totalMs / substeps
        for (let s = 0; s < substeps; s += 1) {
          Matter.Engine.update(engine, subMs)
        }

        let allDone = true

        for (let i = 0; i < sims.length; i += 1) {
          const sim = sims[i]
          const node = groupRefs.current[i]

          if (!sim.settledToSpring) {
            allDone = false
            const nearFloor = Math.abs(sim.body.position.y - sim.homeCy) < 10
            const slowEnough =
              sim.body.speed < 0.72 && Math.abs(sim.body.angularVelocity) < 0.025
            if ((elapsed > 0.55 && nearFloor && slowEnough) || elapsed > 1.35) {
              sim.settledToSpring = true
              const dx = clamp(sim.body.position.x - sim.homeCx, -16, 16)
              const dy = sim.body.position.y - sim.homeCy
              sim.sx.snap(dx)
              sim.sy.snap(dy)
              sim.sa.snap(sim.body.angle)
              sim.sx.setVelocity(sim.body.velocity.x * 35)
              sim.sy.setVelocity(sim.body.velocity.y * 35)
              sim.sa.setVelocity(sim.body.angularVelocity * 35)
              sim.sx.setTarget(0)
              sim.sy.setTarget(0)
              sim.sa.setTarget(0)
            }
          }

          if (sim.settledToSpring) {
            sim.sx.step(dt)
            sim.sy.step(dt)
            sim.sa.step(dt)
            const atHome =
              sim.sx.atRest(0.02) && sim.sy.atRest(0.02) && sim.sa.atRest(0.001)
            if (atHome) {
              sim.sx.snap(0)
              sim.sy.snap(0)
              sim.sa.snap(0)
              if (node) node.removeAttribute('transform')
            } else {
              allDone = false
              if (node) {
                const tx = sim.sx.value
                const ty = sim.sy.value
                const deg = (sim.sa.value * 180) / Math.PI
                node.setAttribute(
                  'transform',
                  `translate(${tx.toFixed(2)}, ${ty.toFixed(2)}) rotate(${deg.toFixed(2)}, ${sim.homeCx.toFixed(2)}, ${sim.homeCy.toFixed(2)})`,
                )
              }
            }
          } else if (node) {
            const tx = clamp(sim.body.position.x - sim.homeCx, -16, 16)
            const ty = sim.body.position.y - sim.homeCy
            const deg = (sim.body.angle * 180) / Math.PI
            node.setAttribute(
              'transform',
              `translate(${tx.toFixed(2)}, ${ty.toFixed(2)}) rotate(${deg.toFixed(2)}, ${sim.homeCx.toFixed(2)}, ${sim.homeCy.toFixed(2)})`,
            )
          }
        }

        if (!allDone) {
          raf = requestAnimationFrame(tick)
        } else {
          Matter.World.clear(engine.world, false)
          Matter.Engine.clear(engine)
          engine = null
        }
      }

      raf = requestAnimationFrame(tick)
    }

    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          observer.disconnect()
          startDrop()
        }
      },
      { threshold: 0.12 },
    )
    observer.observe(boxEl)

    const rect = boxEl.getBoundingClientRect()
    if (rect.top < window.innerHeight * 0.92 && rect.bottom > 0) {
      observer.disconnect()
      startDrop()
    }

    return () => {
      disposed = true
      observer.disconnect()
      if (raf) cancelAnimationFrame(raf)
      if (engine) {
        Matter.World.clear(engine.world, false)
        Matter.Engine.clear(engine)
      }
    }
  }, [word, reduced])

  const ratio = word ? `${word.totalWidth} / ${word.totalHeight}` : '418.17 / 105.21'

  return (
    <div
      ref={boxRef}
      className="belief__word-box belief__word-box--yours"
      style={{ aspectRatio: ratio }}
    >
      {word ? (
        <>
          <svg
            ref={svgRef}
            className="belief__svg belief__svg--yours"
            viewBox={word.viewBox}
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
          >
            {word.letters.map((letter, idx) => (
              <g
                key={`yours-${idx}-${letter.char}`}
                ref={node => {
                  groupRefs.current[idx] = node
                }}
              >
                <path d={letter.basePath} fill="#C48800" fillRule="nonzero" />
              </g>
            ))}
          </svg>
          <span className="kinetic-sr-only">yours.</span>
        </>
      ) : (
        <WordFallback text="yours." className="belief__fallback--yours" />
      )}
    </div>
  )
}

export default function BeliefSection({ reduced }: BeliefSectionProps) {
  const sectionRef = useRef<HTMLElement>(null)
  const [nearViewport, setNearViewport] = useState(false)
  const [font, setFont] = useState(() => getCachedKronaFont())

  useEffect(() => {
    if (nearViewport) return
    const el = sectionRef.current
    if (!el || typeof window === 'undefined') return

    let disposed = false
    let observer: IntersectionObserver | null = null

    const activate = () => {
      if (disposed) return
      setNearViewport(true)
      observer?.disconnect()
      window.removeEventListener('scroll', onScroll)
    }

    const checkPosition = () => {
      if (disposed) return
      const rect = el.getBoundingClientRect()
      const vh = window.innerHeight || 800
      if (
        (window.scrollY > 4 && rect.top < vh + 500 && rect.bottom > -200) ||
        (rect.top < vh * 0.92 && rect.bottom > 0)
      ) {
        activate()
      }
    }

    const onScroll = () => {
      checkPosition()
    }

    const rafId = requestAnimationFrame(() => {
      if (disposed) return
      checkPosition()
      observer = new IntersectionObserver(
        entries => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue
            const vh = window.innerHeight || 800
            if (window.scrollY > 4 || entry.boundingClientRect.top < vh * 0.92) {
              activate()
              break
            }
          }
        },
        { rootMargin: '450px 0px' },
      )
      observer.observe(el)
    })

    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      disposed = true
      cancelAnimationFrame(rafId)
      observer?.disconnect()
      window.removeEventListener('scroll', onScroll)
    }
  }, [nearViewport])

  useEffect(() => {
    if (!nearViewport || font) return
    let active = true
    loadKronaFont()
      .then(loaded => {
        if (active) setFont(loaded)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [nearViewport, font])

  const words = useMemo(() => {
    if (!font || !nearViewport) {
      return { soft: null, squeezable: null, yours: null }
    }
    return {
      soft: extractWordLetters(font, 'soft.', {
        fontSize: 100,
        paddingX: 8,
        paddingTop: 10,
        paddingBottom: 10,
      }),
      squeezable: extractWordLetters(font, 'squeezable.', {
        fontSize: 100,
        paddingX: 28,
        paddingTop: 10,
        paddingBottom: 10,
      }),
      yours: extractWordLetters(font, 'yours.', {
        fontSize: 100,
        paddingX: 18,
        paddingTop: 10,
        paddingBottom: 10,
      }),
    }
  }, [font, nearViewport])

  return (
    <section
      ref={sectionRef}
      id="belief"
      className="belief section"
      data-aura="#2FA4A8,#E46A8E"
      aria-label="soft. squeezable. yours."
    >
      <div className="belief__stage">
        <SoftWord word={words.soft} reduced={reduced} />
        <SqueezableWord word={words.squeezable} reduced={reduced} />
        <div className="belief__closing">
          <YoursWord word={words.yours} reduced={reduced} />
          <p className="belief__small">a lip jelly you'll keep squeezing.</p>
        </div>
      </div>
    </section>
  )
}
