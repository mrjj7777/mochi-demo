import { useEffect, useRef, useState } from 'react'
import { clamp, hexToRgb, lerpRgb } from '../physics'

type AuraPair = { ring: [number, number, number]; glow: [number, number, number] }
type GlobalAuraProps = { activeAura?: string; activeGlow?: string; sectionSelector?: string; className?: string }

const fallback: AuraPair = { ring: hexToRgb('#2FA4A8'), glow: hexToRgb('#E46A8E') }

function parsePair(value: string | undefined): AuraPair {
  const [ring, glow] = (value ?? '').split(',').map(part => part.trim()).filter(Boolean)
  try {
    const parsed = { ring: hexToRgb(ring || '#2FA4A8'), glow: hexToRgb(glow || '#E46A8E') }
    return parsed.ring.concat(parsed.glow).every(Number.isFinite) ? parsed : fallback
  } catch { return fallback }
}

/**
 * Low-cost ambient aura behind the page.
 * Desktop: lightweight WebGL shader with idle sleep.
 * Mobile / touch: zero-WebGL pure CSS hardware radial glow for locked 60fps mobile performance.
 */
export default function GlobalAura({ activeAura, activeGlow, sectionSelector = '[data-aura]', className = '' }: GlobalAuraProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const activeRef = useRef({ ring: hexToRgb(activeAura ?? '#2FA4A8'), glow: hexToRgb(activeGlow ?? '#E46A8E') })
  const [isMobileAura, setIsMobileAura] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(max-width: 767px), (hover: none) and (pointer: coarse)').matches
      : false,
  )

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px), (hover: none) and (pointer: coarse)')
    const sync = () => setIsMobileAura(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    activeRef.current = { ring: hexToRgb(activeAura ?? '#2FA4A8'), glow: hexToRgb(activeGlow ?? '#E46A8E') }
  }, [activeAura, activeGlow])

  useEffect(() => {
    if (isMobileAura) return
    const canvas = canvasRef.current
    if (!canvas) return
    const gl = canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: true })
    if (!gl) return
    gl.clearColor(0, 0, 0, 0)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

    const vertex = gl.createShader(gl.VERTEX_SHADER)
    const fragment = gl.createShader(gl.FRAGMENT_SHADER)
    if (!vertex || !fragment) return
    gl.shaderSource(vertex, 'attribute vec2 p; void main(){gl_Position=vec4(p,0.0,1.0);}')
    gl.shaderSource(fragment, `precision mediump float;
      uniform vec2 uResolution; uniform float uTime; uniform vec3 uRing; uniform vec3 uGlow; uniform float uBlend;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),f.x),f.y);}
      void main(){vec2 uv=gl_FragCoord.xy/uResolution; vec2 p=uv-vec2(.5,.5); p.x*=uResolution.x/uResolution.y;
        float drift=noise(uv*2.6+uTime*.018)*.08; vec2 ringPos=vec2(-.04,.02)+vec2(sin(uTime*.07),cos(uTime*.09))*.035;
        float radius=length(p-ringPos); float ring=exp(-pow((radius-.34-drift)*6.0,2.0));
        float blob=exp(-length((p-vec2(.24,.2))*1.8))*0.6+exp(-length((p+vec2(.3,.3))*1.5))*0.4;
        vec3 color=mix(uRing,uGlow,clamp(.5+.5*sin(uTime*.06)+uBlend*.08,0.0,1.0)); float grain=(hash(gl_FragCoord.xy+uTime)-.5)*.025;
        float alpha=clamp(ring*.22+blob*.075+grain*.08,0.0,.34); gl_FragColor=vec4(color+grain,alpha);
      }`)
    gl.compileShader(vertex); gl.compileShader(fragment)
    const program = gl.createProgram()
    if (!program) return
    gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program); gl.useProgram(program)
    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const position = gl.getAttribLocation(program, 'p'); gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
    const resolution = gl.getUniformLocation(program, 'uResolution'); const time = gl.getUniformLocation(program, 'uTime'); const ringUniform = gl.getUniformLocation(program, 'uRing'); const glowUniform = gl.getUniformLocation(program, 'uGlow'); const blendUniform = gl.getUniformLocation(program, 'uBlend')
    let frame = 0
    let disposed = false
    let sleeping = false
    let last = performance.now()
    let lastActivity = last
    let current = activeRef.current
    let target = current
    let blend = 0
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const idleDelay = 2200
    const sections = () => Array.from(document.querySelectorAll<HTMLElement>(sectionSelector))
    const updateTarget = () => {
      const list = sections()
      if (!list.length) {
        target = activeRef.current
        blend = 0
        return
      }

      const focus = window.innerHeight * .5
      const distance = Math.max(window.innerHeight * .4, 1)
      const rects = list.map(section => section.getBoundingClientRect())
      let fromIndex = rects.findIndex(rect => rect.top <= focus && rect.bottom >= focus)
      let toIndex = fromIndex
      let mix = 0

      for (let index = 0; index < rects.length - 1; index += 1) {
        const boundary = rects[index].bottom
        const start = boundary - distance * .5
        if (focus >= start && focus <= start + distance) {
          fromIndex = index
          toIndex = index + 1
          mix = clamp((focus - start) / distance, 0, 1)
          break
        }
      }

      if (fromIndex < 0) fromIndex = window.scrollY < 4 ? 0 : list.length - 1
      if (toIndex < 0) toIndex = fromIndex
      const first = parsePair(list[fromIndex]?.dataset.aura)
      const second = parsePair(list[toIndex]?.dataset.aura)
      target = { ring: lerpRgb(first.ring, second.ring, mix), glow: lerpRgb(first.glow, second.glow, mix) }
      blend = mix
    }
    const coloursSettled = () => {
      const distance = current.ring.reduce((sum, value, index) => sum + Math.abs(value - target.ring[index]), 0)
      const glowDistance = current.glow.reduce((sum, value, index) => sum + Math.abs(value - target.glow[index]), 0)
      return distance + glowDistance < .003
    }
    const wake = () => {
      lastActivity = performance.now()
      sleeping = false
      if (!frame && !disposed) frame = requestAnimationFrame(draw)
    }
    const resize = () => { const dpr = Math.min(window.devicePixelRatio || 1, 2); canvas.width = Math.max(1, Math.round(innerWidth * dpr)); canvas.height = Math.max(1, Math.round(innerHeight * dpr)); canvas.style.width = `${innerWidth}px`; canvas.style.height = `${innerHeight}px`; gl.viewport(0, 0, canvas.width, canvas.height); wake() }
    const draw = (now: number) => {
      frame = 0
      if (disposed || sleeping) return
      const elapsed = Math.min(.05, (now - last) / 1000); last = now
      current = { ring: lerpRgb(current.ring, target.ring, Math.min(1, elapsed * 4)), glow: lerpRgb(current.glow, target.glow, Math.min(1, elapsed * 4)) }
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.uniform2f(resolution, canvas.width, canvas.height); gl.uniform1f(time, now / 1000); gl.uniform3fv(ringUniform, current.ring); gl.uniform3fv(glowUniform, current.glow); gl.uniform1f(blendUniform, blend); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      if (reducedMotion.matches) {
        sleeping = true
        return
      }
      frame = requestAnimationFrame(draw)
      if (!reducedMotion.matches && now - lastActivity > idleDelay && coloursSettled()) {
        sleeping = true
        cancelAnimationFrame(frame)
        frame = 0
      }
    }
    const onScroll = () => { updateTarget(); wake() }
    const onPointer = () => wake()
    const onMotionPreference = () => wake()
    resize(); updateTarget(); window.addEventListener('resize', resize); window.addEventListener('scroll', onScroll, { passive: true }); window.addEventListener('pointermove', onPointer, { passive: true }); reducedMotion.addEventListener?.('change', onMotionPreference); wake()
    return () => { disposed = true; if (frame) cancelAnimationFrame(frame); window.removeEventListener('resize', resize); window.removeEventListener('scroll', onScroll); window.removeEventListener('pointermove', onPointer); reducedMotion.removeEventListener?.('change', onMotionPreference); gl.deleteProgram(program); gl.deleteShader(vertex); gl.deleteShader(fragment); gl.deleteBuffer(buffer) }
  }, [sectionSelector, isMobileAura])

  if (isMobileAura) {
    return (
      <div
        className={`global-aura global-aura--mobile ${className}`}
        aria-hidden="true"
        style={
          {
            '--mob-aura': activeAura ?? '#F6D3D6',
            '--mob-glow': activeGlow ?? '#B3122E',
          } as React.CSSProperties
        }
      />
    )
  }

  return <canvas ref={canvasRef} className={`global-aura ${className}`} aria-hidden="true" />
}
