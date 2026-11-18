import { useEffect, useRef, useState } from 'react'
import { clamp, createSpring } from '../physics/spring'
import { canUseWebGL, getCappedDpr, useViewportActive } from './viewportUtils'

export type RefractiveLoupeProps = {
  imageSrc: string
  xPct: number
  yPct: number
  visible: boolean
  wobbleKey?: number
  reducedMotion?: boolean
  className?: string
}

const LOUPE_SIZE = 220
const LOUPE_ZOOM = 2.0

/**
 * 220x220px square WebGL refractive jelly lens (border-radius: 0, crop-mark corners, zero fill).
 * Renders imageSrc at 2.0x zoom aligned 1:1 with object-fit: cover beneath the pointer,
 * with curved jelly edge refraction and a one-shot jelly wobble triggered by wobbleKey.
 */
export default function RefractiveLoupe({
  imageSrc,
  xPct,
  yPct,
  visible,
  wobbleKey = 0,
  reducedMotion = false,
  className = '',
}: RefractiveLoupeProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isViewportActive = useViewportActive(rootRef, '120px')

  const [webglReady, setWebglReady] = useState(true)
  const posRef = useRef({ xPct, yPct, visible, reducedMotion })
  const activeRef = useRef(isViewportActive)
  const wobbleSpringRef = useRef(createSpring('jelly', 0))
  const wobbleTimeRef = useRef(0)
  const wakeRef = useRef<(() => void) | null>(null)
  const lastWobbleKeyRef = useRef(wobbleKey)

  useEffect(() => {
    activeRef.current = isViewportActive
    if (isViewportActive) wakeRef.current?.()
  }, [isViewportActive])

  useEffect(() => {
    posRef.current = { xPct, yPct, visible, reducedMotion }
    wakeRef.current?.()
  }, [xPct, yPct, visible, reducedMotion])

  useEffect(() => {
    if (wobbleKey !== lastWobbleKeyRef.current) {
      lastWobbleKeyRef.current = wobbleKey
      if (!reducedMotion && wobbleKey > 0) {
        wobbleTimeRef.current = 0
        wobbleSpringRef.current.addImpulse(3.6)
        wakeRef.current?.()
      }
    }
  }, [wobbleKey, reducedMotion])

  useEffect(() => {
    if (!canUseWebGL()) {
      setWebglReady(false)
      return
    }
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = canvas.getContext('webgl', {
      alpha: true,
      antialias: true,
      premultiplyAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    }) as WebGLRenderingContext | null
    if (!gl) {
      setWebglReady(false)
      return
    }
    if ('drawingBufferColorSpace' in gl) {
      ;(gl as WebGLRenderingContext & { drawingBufferColorSpace: string }).drawingBufferColorSpace = 'srgb'
    }

    const vsSrc = `
      attribute vec2 aPos;
      varying vec2 vUv;
      void main() {
        vUv = aPos * 0.5 + 0.5;
        gl_Position = vec4(aPos, 0.0, 1.0);
      }
    `

    const fsSrc = `
      precision highp float;
      uniform sampler2D uTex;
      uniform vec2 uCenterUv;
      uniform vec2 uSpanUv;
      uniform float uWobble;
      uniform float uWobbleTime;
      uniform float uReady;
      varying vec2 vUv;

      void main() {
        if (uReady < 0.5) {
          gl_FragColor = vec4(0.0);
          return;
        }

        // Map canvas coords so top of canvas corresponds to smaller V (image top, flipY=false)
        vec2 p = vec2(vUv.x - 0.5, 0.5 - vUv.y);
        float boxDist = max(abs(p.x * 2.0), abs(p.y * 2.0));
        float r = length(p * 2.0);
        float edgeMask = smoothstep(0.62, 1.05, boxDist);

        // Crisp 1:1 center with curved jelly edge refraction + one-shot wobble ripple on stop
        float ripple = sin(r * 10.0 - uWobbleTime * 16.0) * uWobble * 0.024;
        float barrel = (0.048 * pow(boxDist, 2.6) + ripple * smoothstep(0.25, 1.0, r)) * (edgeMask + abs(uWobble) * 0.6);
        vec2 refracted = p * (1.0 - barrel);

        // Subtle perimeter-only chromatic dispersion (zero blur/tint in the 2.0x core)
        vec2 caShift = normalize(p + vec2(1e-5)) * (0.0032 * edgeMask + abs(uWobble) * 0.0020);
        vec2 uvBase = uCenterUv + refracted * uSpanUv;
        vec2 uvR = clamp(uvBase + caShift * uSpanUv, 0.001, 0.999);
        vec2 uvG = clamp(uvBase, 0.001, 0.999);
        vec2 uvB = clamp(uvBase - caShift * uSpanUv, 0.001, 0.999);

        float red = texture2D(uTex, uvR).r;
        float green = texture2D(uTex, uvG).g;
        float blue = texture2D(uTex, uvB).b;
        vec3 col = vec3(red, green, blue);

        // Crisp 2px outer glass-jelly edge sheen only along top-left perimeter
        float rimGlint = smoothstep(0.94, 0.995, boxDist);
        float upperLeft = clamp((-p.x - p.y) * 0.85, 0.0, 1.0);
        col = mix(col, vec3(0.98, 0.969, 0.949), rimGlint * upperLeft * 0.16);

        gl_FragColor = vec4(col, 1.0);
      }
    `

    const compile = (type: number, src: string) => {
      const shader = gl.createShader(type)
      if (!shader) return null
      gl.shaderSource(shader, src)
      gl.compileShader(shader)
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader)
        return null
      }
      return shader
    }

    const vs = compile(gl.VERTEX_SHADER, vsSrc)
    const fs = compile(gl.FRAGMENT_SHADER, fsSrc)
    if (!vs || !fs) {
      if (vs) gl.deleteShader(vs)
      if (fs) gl.deleteShader(fs)
      setWebglReady(false)
      return
    }

    const program = gl.createProgram()
    if (!program) {
      gl.deleteShader(vs)
      gl.deleteShader(fs)
      setWebglReady(false)
      return
    }
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program)
      gl.deleteShader(vs)
      gl.deleteShader(fs)
      setWebglReady(false)
      return
    }
    gl.useProgram(program)

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)

    const aPos = gl.getAttribLocation(program, 'aPos')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

    const uTex = gl.getUniformLocation(program, 'uTex')
    const uCenterUv = gl.getUniformLocation(program, 'uCenterUv')
    const uSpanUv = gl.getUniformLocation(program, 'uSpanUv')
    const uWobble = gl.getUniformLocation(program, 'uWobble')
    const uWobbleTime = gl.getUniformLocation(program, 'uWobbleTime')
    const uReady = gl.getUniformLocation(program, 'uReady')

    const texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([242, 237, 228, 255]),
    )

    let disposed = false
    let texReady = false
    let imgW = 1
    let imgH = 1
    let rafId = 0
    let lastTime = performance.now()

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.decoding = 'async'
    img.onload = () => {
      if (disposed) return
      imgW = Math.max(1, img.naturalWidth)
      imgH = Math.max(1, img.naturalHeight)
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
      gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
      texReady = true
      wake()
    }
    const siblingImg = rootRef.current?.parentElement?.querySelector('img')
    const resolvedSrc =
      siblingImg?.complete && siblingImg.currentSrc ? siblingImg.currentSrc : imageSrc
    img.src = resolvedSrc

    const updateSize = () => {
      const dpr = getCappedDpr()
      const px = Math.round(LOUPE_SIZE * dpr)
      if (canvas.width !== px || canvas.height !== px) {
        canvas.width = px
        canvas.height = px
      }
      gl.viewport(0, 0, canvas.width, canvas.height)
    }

    const draw = (now: number) => {
      rafId = 0
      if (disposed || document.hidden || !activeRef.current) return

      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000))
      lastTime = now

      const state = posRef.current
      if (!state.visible) return

      if (state.reducedMotion) {
        wobbleSpringRef.current.snap(0)
      } else {
        wobbleSpringRef.current.step(dt)
        wobbleTimeRef.current += dt
      }

      updateSize()

      const parent = rootRef.current?.parentElement
      const rect = parent?.getBoundingClientRect()
      const pw = Math.max(LOUPE_SIZE, rect?.width ?? 1440)
      const ph = Math.max(LOUPE_SIZE, rect?.height ?? 900)

      let objPosX = 0.5
      let objPosY = 0.5
      const siblingImg = parent?.querySelector('img')
      if (siblingImg) {
        const objPos = window.getComputedStyle(siblingImg).objectPosition
        const parts = objPos.trim().split(/\s+/)
        const parsePos = (token: string | undefined, dim: number, fallback: number) => {
          if (!token) return fallback
          if (token.endsWith('%')) return clamp(parseFloat(token) / 100, 0, 1)
          if (token.endsWith('px')) return clamp(parseFloat(token) / Math.max(1, dim), 0, 1)
          if (token === 'left' || token === 'top') return 0
          if (token === 'right' || token === 'bottom') return 1
          return 0.5
        }
        objPosX = parsePos(parts[0], pw, 0.5)
        objPosY = parsePos(parts[1], ph, 0.5)
      }

      const imgAspect = imgW / imgH
      const parentAspect = pw / ph
      const renderedW = parentAspect > imgAspect ? pw : ph * imgAspect
      const renderedH = parentAspect > imgAspect ? pw / imgAspect : ph

      const offsetX = (pw - renderedW) * objPosX
      const offsetY = (ph - renderedH) * objPosY

      const cx = (clamp(state.xPct, 0, 100) / 100) * pw
      const cy = (clamp(state.yPct, 0, 100) / 100) * ph

      const centerU = (cx - offsetX) / renderedW
      const centerV = (cy - offsetY) / renderedH
      const spanU = LOUPE_SIZE / renderedW / LOUPE_ZOOM
      const spanV = LOUPE_SIZE / renderedH / LOUPE_ZOOM

      gl.uniform1i(uTex, 0)
      gl.uniform2f(uCenterUv, centerU, centerV)
      gl.uniform2f(uSpanUv, spanU, spanV)
      gl.uniform1f(uWobble, wobbleSpringRef.current.value)
      gl.uniform1f(uWobbleTime, wobbleTimeRef.current)
      gl.uniform1f(uReady, texReady ? 1 : 0)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

      if (!state.reducedMotion && !wobbleSpringRef.current.atRest(0.001)) {
        rafId = requestAnimationFrame(draw)
      }
    }

    const wake = () => {
      if (disposed || document.hidden || !activeRef.current) return
      if (!rafId) {
        lastTime = performance.now()
        rafId = requestAnimationFrame(draw)
      }
    }

    const onVisibility = () => {
      if (!document.hidden && activeRef.current) wake()
    }

    wakeRef.current = wake
    updateSize()
    wake()

    window.addEventListener('resize', wake, { passive: true })
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      disposed = true
      wakeRef.current = null
      if (rafId) cancelAnimationFrame(rafId)
      window.removeEventListener('resize', wake)
      document.removeEventListener('visibilitychange', onVisibility)
      gl.deleteTexture(texture)
      gl.deleteBuffer(buf)
      gl.deleteProgram(program)
      gl.deleteShader(vs)
      gl.deleteShader(fs)
    }
  }, [imageSrc])

  const cropCornerStyle = (pos: 'tl' | 'tr' | 'bl' | 'br'): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: 'absolute',
      width: 12,
      height: 12,
      pointerEvents: 'none',
      borderRadius: 0,
      zIndex: 2,
    }
    const border = '1px solid rgba(250, 247, 242, 0.92)'
    if (pos === 'tl') return { ...base, top: 0, left: 0, borderTop: border, borderLeft: border }
    if (pos === 'tr') return { ...base, top: 0, right: 0, borderTop: border, borderRight: border }
    if (pos === 'bl') return { ...base, bottom: 0, left: 0, borderBottom: border, borderLeft: border }
    return { ...base, bottom: 0, right: 0, borderBottom: border, borderRight: border }
  }

  return (
    <div
      ref={rootRef}
      className={`refractive-loupe ${className}`.trim()}
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: `${clamp(xPct, 0, 100)}%`,
        top: `${clamp(yPct, 0, 100)}%`,
        width: LOUPE_SIZE,
        height: LOUPE_SIZE,
        transform: 'translate(-50%, -50%)',
        borderRadius: 0,
        boxShadow: 'none',
        background: 'transparent',
        pointerEvents: 'none',
        overflow: 'hidden',
        opacity: visible ? 1 : 0,
        visibility: visible ? 'visible' : 'hidden',
        zIndex: 3,
      }}
    >
      {webglReady ? (
        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
            borderRadius: 0,
          }}
        />
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            backgroundImage: `url(${imageSrc})`,
            backgroundSize: '200%',
            backgroundPosition: `${clamp(xPct, 0, 100)}% ${clamp(yPct, 0, 100)}%`,
            backgroundRepeat: 'no-repeat',
            borderRadius: 0,
          }}
        />
      )}

      {/* Straight editorial crop-mark corners (no fill, no border-radius) */}
      <span style={cropCornerStyle('tl')} />
      <span style={cropCornerStyle('tr')} />
      <span style={cropCornerStyle('bl')} />
      <span style={cropCornerStyle('br')} />
    </div>
  )
}
