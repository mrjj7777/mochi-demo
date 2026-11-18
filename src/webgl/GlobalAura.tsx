import { useEffect, useRef } from 'react'
import { clamp, hexToRgb, lerpRgb } from '../physics/spring'
import { getCappedDpr } from './viewportUtils'

export type GlobalAuraProps = {
  activeAura?: string
  activeGlow?: string
  sectionSelector?: string
  className?: string
}

type AuraPair = {
  ring: [number, number, number]
  glow: [number, number, number]
}

const CREAM_HEX = '#F2EDE4'
const DEFAULT_RING_HEX = '#F2EDE4'
const DEFAULT_GLOW_HEX = '#F6D3D6'

function safeHexToRgb(hex: string | undefined, fallbackHex: string): [number, number, number] {
  try {
    const rgb = hexToRgb(hex || fallbackHex)
    if (rgb.every(Number.isFinite)) return rgb
  } catch {
    // ignore malformed hex and fall back
  }
  return hexToRgb(fallbackHex)
}

function parsePair(value: string | undefined, overrideRing?: string, overrideGlow?: string): AuraPair {
  const parts = (value ?? '').split(',').map(part => part.trim()).filter(Boolean)
  const rawRing = parts[0]
  const rawGlow = parts[1]

  const ringHex = !rawRing || rawRing.toLowerCase() === 'active'
    ? (overrideRing || DEFAULT_RING_HEX)
    : rawRing
  const glowHex = !rawGlow || rawGlow.toLowerCase() === 'active'
    ? (overrideGlow || CREAM_HEX)
    : rawGlow

  return {
    ring: safeHexToRgb(ringHex, DEFAULT_RING_HEX),
    glow: safeHexToRgb(glowHex, DEFAULT_GLOW_HEX),
  }
}

function smoothstep01(t: number): number {
  const x = clamp(t, 0, 1)
  return x * x * (3 - 2 * x)
}

/**
 * Full-screen fixed WebGL aura canvas behind the page.
 * Renders warm cream #F2EDE4 + airbrushed radial blobs/ring + triangular dithering + 8fps grain.
 * Smoothly blends uRing & uGlow across >= 40vh of scroll between [data-aura] sections.
 */
export default function GlobalAura({
  activeAura,
  activeGlow,
  sectionSelector = '[data-aura]',
  className = '',
}: GlobalAuraProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overridesRef = useRef({ activeAura, activeGlow })
  const refreshRef = useRef<(() => void) | null>(null)
  const bootRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    overridesRef.current = { activeAura, activeGlow }
    if (refreshRef.current) {
      refreshRef.current()
    } else {
      bootRef.current?.()
    }
  }, [activeAura, activeGlow])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const vertexSource = `
      attribute vec2 aPos;
      void main() {
        gl_Position = vec4(aPos, 0.0, 1.0);
      }
    `

    const fragmentSource = `
      precision mediump float;
      uniform vec2 uResolution;
      uniform float uTime;
      uniform float uGrainTime;
      uniform vec3 uRing;
      uniform vec3 uGlow;
      uniform float uMotion;

      float hash12(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
      }

      float valueNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        float a = hash12(i);
        float b = hash12(i + vec2(1.0, 0.0));
        float c = hash12(i + vec2(0.0, 1.0));
        float d = hash12(i + vec2(1.0, 1.0));
        return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
      }

      float fbm(vec2 p) {
        float v = 0.0;
        v += 0.62 * valueNoise(p);
        v += 0.38 * valueNoise(p * 2.07 + vec2(13.1, 7.7));
        return v;
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / max(uResolution, vec2(1.0));
        float aspect = uResolution.x / max(uResolution.y, 1.0);
        vec2 p = uv - vec2(0.5);
        p.x *= aspect;

        float t = uTime * uMotion;

        // Soft organic airbrush drift
        float n1 = fbm(uv * 2.4 + vec2(t * 0.018, -t * 0.014));
        float n2 = fbm(uv * 3.8 + vec2(-t * 0.012, t * 0.021));
        float drift = (n1 - 0.5) * 0.10 + (n2 - 0.5) * 0.04;

        // Primary airbrushed aura ring + soft interior halo
        vec2 ringCenter = vec2(-0.03, 0.02) + vec2(sin(t * 0.14), cos(t * 0.11)) * 0.045;
        float distRing = length(p - ringCenter) + drift;
        float haloCore = exp(-pow(distRing * 2.15, 2.0));
        float softRing = exp(-pow((distRing - 0.34) * 3.1, 2.0));
        float ringWeight = clamp(softRing * 0.24 + haloCore * 0.12, 0.0, 0.34);

        // Secondary & tertiary airbrushed glow blobs
        vec2 blobACenter = vec2(0.32 * aspect * 0.55, 0.22) + vec2(cos(t * 0.12), sin(t * 0.16)) * 0.05;
        float blobA = exp(-pow(length(p - blobACenter + drift * 0.6) * 2.1, 2.0));

        vec2 blobBCenter = vec2(-0.34 * aspect * 0.55, -0.24) + vec2(sin(t * 0.09), -cos(t * 0.13)) * 0.05;
        float blobB = exp(-pow(length(p - blobBCenter - drift * 0.5) * 1.9, 2.0));

        // Base paper cream #F2EDE4 (never pure white)
        vec3 cream = vec3(0.94902, 0.92941, 0.89412);
        vec3 col = cream;
        col = mix(col, uRing, ringWeight);
        col = mix(col, uGlow, clamp(blobA * 0.20, 0.0, 0.24));
        col = mix(col, mix(uRing, uGlow, 0.55), clamp(blobB * 0.15, 0.0, 0.18));

        // Subtle 8fps film grain (tokens.json grain.opacity: 0.05)
        float grainSample = hash12(floor(gl_FragCoord.xy) + vec2(uGrainTime * 37.0, uGrainTime * 19.0));
        float grain = (grainSample - 0.5) * 0.036;

        // Triangular-PDF dithering (eliminates 8-bit gradient banding on #F2EDE4)
        float d1 = hash12(gl_FragCoord.xy + vec2(11.3, 27.9));
        float d2 = hash12(gl_FragCoord.xy + vec2(53.7, 71.1));
        float dither = (d1 + d2 - 1.0) / 255.0;

        vec3 finalRgb = clamp(col + grain + dither, vec3(0.0), vec3(0.980));
        gl_FragColor = vec4(finalRgb, 1.0);
      }
    `

    let rafId = 0
    let idleTimer = 0
    let bootTimer = 0
    let compileTimer = 0
    let linkTimer = 0
    let booted = false
    let disposed = false
    let cleanupWebGL: (() => void) | null = null

    const startWebGL = () => {
      if (booted || disposed) return
      booted = true
      if (bootTimer) {
        window.clearTimeout(bootTimer)
        bootTimer = 0
      }

      // Stage 1: context creation in its own macrotask (never during initial React mount)
      const gl = canvas.getContext('webgl', {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        preserveDrawingBuffer: false,
        powerPreference: 'low-power',
      }) as WebGLRenderingContext | null
      if (!gl) return

      // Stage 2: kick off async ANGLE shader compile & program link without querying status yet
      compileTimer = window.setTimeout(() => {
        if (disposed) return
        const createShader = (type: number, src: string) => {
          const s = gl.createShader(type)
          if (!s) return null
          gl.shaderSource(s, src)
          gl.compileShader(s)
          return s
        }

        const vs = createShader(gl.VERTEX_SHADER, vertexSource)
        const fs = createShader(gl.FRAGMENT_SHADER, fragmentSource)
        if (!vs || !fs) {
          if (vs) gl.deleteShader(vs)
          if (fs) gl.deleteShader(fs)
          return
        }

        const program = gl.createProgram()
        if (!program) {
          gl.deleteShader(vs)
          gl.deleteShader(fs)
          return
        }
        gl.attachShader(program, vs)
        gl.attachShader(program, fs)
        gl.linkProgram(program)

        // Stage 3: bind linked program after GPU worker finishes background compilation
        linkTimer = window.setTimeout(() => {
          if (disposed) {
            gl.deleteProgram(program)
            gl.deleteShader(vs)
            gl.deleteShader(fs)
            return
          }
          if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            gl.deleteProgram(program)
            gl.deleteShader(vs)
            gl.deleteShader(fs)
            return
          }
          gl.useProgram(program)

          const buffer = gl.createBuffer()
          gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
          gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)

          const aPos = gl.getAttribLocation(program, 'aPos')
          gl.enableVertexAttribArray(aPos)
          gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

          const uResolution = gl.getUniformLocation(program, 'uResolution')
          const uTime = gl.getUniformLocation(program, 'uTime')
          const uGrainTime = gl.getUniformLocation(program, 'uGrainTime')
          const uRing = gl.getUniformLocation(program, 'uRing')
          const uGlow = gl.getUniformLocation(program, 'uGlow')
          const uMotion = gl.getUniformLocation(program, 'uMotion')

          const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

          const resolveSectionPair = (el: HTMLElement | undefined): AuraPair => {
            const { activeAura: ovRing, activeGlow: ovGlow } = overridesRef.current
            if (!el) {
              return {
                ring: safeHexToRgb(ovRing, DEFAULT_RING_HEX),
                glow: safeHexToRgb(ovGlow, DEFAULT_GLOW_HEX),
              }
            }
            const isFlavourSection = el.id === 'flavours' || (el.dataset.aura ?? '').includes('active')
            if (isFlavourSection && ovRing) {
              const parsed = parsePair(el.dataset.aura, ovRing, ovGlow)
              return {
                ring: safeHexToRgb(ovRing, DEFAULT_RING_HEX),
                glow: ovGlow ? safeHexToRgb(ovGlow, CREAM_HEX) : parsed.glow,
              }
            }
            return parsePair(el.dataset.aura, ovRing, ovGlow)
          }

          let current: AuraPair = {
            ring: safeHexToRgb(overridesRef.current.activeAura, DEFAULT_RING_HEX),
            glow: safeHexToRgb(overridesRef.current.activeGlow, DEFAULT_GLOW_HEX),
          }
          let target: AuraPair = {
            ring: [...current.ring],
            glow: [...current.glow],
          }

          const updateTarget = () => {
            const sections = Array.from(document.querySelectorAll<HTMLElement>(sectionSelector))
            if (!sections.length) {
              target = resolveSectionPair(undefined)
              return
            }

            const focus = window.innerHeight * 0.5
            // Blend over at least 45vh across every section seam (>= 40vh rule)
            const blendSpan = Math.max(window.innerHeight * 0.45, 1)
            const rects = sections.map(section => section.getBoundingClientRect())

            let fromIdx = rects.findIndex(r => r.top <= focus && r.bottom >= focus)
            let toIdx = fromIdx
            let mix = 0

            for (let i = 0; i < rects.length - 1; i += 1) {
              const boundary = rects[i].bottom
              const start = boundary - blendSpan * 0.5
              if (focus >= start && focus <= start + blendSpan) {
                fromIdx = i
                toIdx = i + 1
                mix = smoothstep01((focus - start) / blendSpan)
                break
              }
            }

            if (fromIdx < 0) fromIdx = window.scrollY <= 8 ? 0 : sections.length - 1
            if (toIdx < 0) toIdx = fromIdx

            const first = resolveSectionPair(sections[fromIdx])
            const second = resolveSectionPair(sections[toIdx])

            target = {
              ring: lerpRgb(first.ring, second.ring, mix),
              glow: lerpRgb(first.glow, second.glow, mix),
            }
          }

          let lastNow = performance.now()
          let elapsedTime = 0
          let lastActivityAt = lastNow

          const renderFrame = (now: number) => {
            rafId = 0
            if (disposed || document.hidden) return

            const dt = Math.min(0.15, Math.max(0, (now - lastNow) / 1000))
            lastNow = now

            const isReduced = reducedMotionQuery.matches
            if (isReduced) {
              current = { ring: [...target.ring], glow: [...target.glow] }
            } else {
              const rate = Math.min(1, dt * 4.5)
              current = {
                ring: lerpRgb(current.ring, target.ring, rate),
                glow: lerpRgb(current.glow, target.glow, rate),
              }
              elapsedTime += dt
            }

            // Quantize film grain at 8 fps (tokens.json grain.fps = 8)
            const grainStep = isReduced ? 0 : Math.floor(elapsedTime * 8)

            gl.uniform2f(uResolution, canvas.width, canvas.height)
            gl.uniform1f(uTime, elapsedTime)
            gl.uniform1f(uGrainTime, grainStep)
            gl.uniform3fv(uRing, current.ring)
            gl.uniform3fv(uGlow, current.glow)
            gl.uniform1f(uMotion, isReduced ? 0.0 : 1.0)
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

            if (!isReduced) {
              const diff =
                Math.abs(current.ring[0] - target.ring[0]) +
                Math.abs(current.ring[1] - target.ring[1]) +
                Math.abs(current.ring[2] - target.ring[2]) +
                Math.abs(current.glow[0] - target.glow[0]) +
                Math.abs(current.glow[1] - target.glow[1]) +
                Math.abs(current.glow[2] - target.glow[2])
              if (diff > 0.002) {
                rafId = requestAnimationFrame(renderFrame)
              } else if (now - lastActivityAt < 1800) {
                idleTimer = window.setTimeout(wakeFrame, 125)
              }
            }
          }

          const wakeFrame = () => {
            if (disposed || document.hidden) return
            if (idleTimer) {
              window.clearTimeout(idleTimer)
              idleTimer = 0
            }
            if (!rafId) {
              lastNow = performance.now()
              rafId = requestAnimationFrame(renderFrame)
            }
          }

          const wake = () => {
            lastActivityAt = performance.now()
            wakeFrame()
          }

          const resize = () => {
            const dpr = getCappedDpr()
            const w = Math.max(1, Math.round(window.innerWidth * dpr))
            const h = Math.max(1, Math.round(window.innerHeight * dpr))
            if (canvas.width !== w || canvas.height !== h) {
              canvas.width = w
              canvas.height = h
            }
            gl.viewport(0, 0, canvas.width, canvas.height)
            updateTarget()
            wake()
          }

          const onScroll = () => {
            updateTarget()
            wake()
          }

          const onVisibility = () => {
            if (document.hidden) {
              if (rafId) {
                cancelAnimationFrame(rafId)
                rafId = 0
              }
              if (idleTimer) {
                window.clearTimeout(idleTimer)
                idleTimer = 0
              }
            } else {
              updateTarget()
              wake()
            }
          }

          const onMotionChange = () => {
            if (rafId) {
              cancelAnimationFrame(rafId)
              rafId = 0
            }
            if (idleTimer) {
              window.clearTimeout(idleTimer)
              idleTimer = 0
            }
            updateTarget()
            wake()
          }

          refreshRef.current = () => {
            updateTarget()
            wake()
          }

          resize()
          current = { ring: [...target.ring], glow: [...target.glow] }
          wake()

          window.addEventListener('resize', resize, { passive: true })
          window.addEventListener('scroll', onScroll, { passive: true })
          document.addEventListener('visibilitychange', onVisibility)
          reducedMotionQuery.addEventListener?.('change', onMotionChange)

          cleanupWebGL = () => {
            window.removeEventListener('resize', resize)
            window.removeEventListener('scroll', onScroll)
            document.removeEventListener('visibilitychange', onVisibility)
            reducedMotionQuery.removeEventListener?.('change', onMotionChange)
            gl.deleteBuffer(buffer)
            gl.deleteProgram(program)
            gl.deleteShader(vs)
            gl.deleteShader(fs)
          }
        }, 120)
      }, 60)
    }

    bootRef.current = startWebGL

    // Start immediately on first user/QA scroll or pointer interaction;
    // otherwise defer past initial FCP/LCP critical path (especially on mobile at scrollY=0).
    const onFirstInteraction = () => {
      startWebGL()
    }
    window.addEventListener('scroll', onFirstInteraction, { passive: true, once: true })
    window.addEventListener('pointermove', onFirstInteraction, { passive: true, once: true })
    window.addEventListener('touchstart', onFirstInteraction, { passive: true, once: true })

    if (window.scrollY > 4) {
      bootTimer = window.setTimeout(startWebGL, 40)
    } else {
      const isMobile = window.innerWidth <= 768
      bootTimer = window.setTimeout(startWebGL, isMobile ? 6500 : 320)
    }

    return () => {
      disposed = true
      refreshRef.current = null
      bootRef.current = null
      window.removeEventListener('scroll', onFirstInteraction)
      window.removeEventListener('pointermove', onFirstInteraction)
      window.removeEventListener('touchstart', onFirstInteraction)
      if (bootTimer) window.clearTimeout(bootTimer)
      if (compileTimer) window.clearTimeout(compileTimer)
      if (linkTimer) window.clearTimeout(linkTimer)
      if (idleTimer) window.clearTimeout(idleTimer)
      if (rafId) cancelAnimationFrame(rafId)
      cleanupWebGL?.()
    }
  }, [sectionSelector])

  return (
    <canvas
      ref={canvasRef}
      className={`global-aura ${className}`.trim()}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 0,
        pointerEvents: 'none',
        mixBlendMode: 'normal',
        backgroundColor: '#F2EDE4',
      }}
    />
  )
}
