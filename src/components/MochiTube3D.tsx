import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

type UniformValue = { value: any }
type UniformMap = Record<string, UniformValue>

export type MochiTube3DProps = {
  colour: string
  className?: string
  reducedMotion?: boolean
  fallbackSrc?: string
  fallbackAlt?: string
  ariaLabel?: string
}

type Spring = { value: number; velocity: number; target: number }

const jellySpring = { stiffness: 120, damping: 9, mass: 1 }
const heavySpring = { stiffness: 90, damping: 20, mass: 2.5 }

function makeSpring(value: number): Spring {
  return { value, velocity: 0, target: value }
}

function stepSpring(spring: Spring, dt: number, config: typeof jellySpring) {
  const acceleration = ((spring.target - spring.value) * config.stiffness - spring.velocity * config.damping) / config.mass
  spring.velocity += acceleration * dt
  spring.value += spring.velocity * dt
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

function rubberBand(value: number, limit: number) {
  if (Math.abs(value) <= limit) return value
  const distance = Math.abs(value) - limit
  const offset = (1 - 1 / (distance * 0.55 / limit + 1)) * limit
  return Math.sign(value) * (limit + offset)
}

const bodyBase = -1.50
const bodyTop = 1.12
const bodyHeight = bodyTop - bodyBase
const openCherry = '#b3122e'

function makeBodyProfile() {
  const points = Array.from({ length: 161 }, (_, index) => {
    const t = index / 160
    const lowerWaist = Math.exp(-(((t - 0.24) / 0.14) ** 2))
    const upperWaist = Math.exp(-(((t - 0.69) / 0.15) ** 2))
    const shoulder = Math.exp(-(((t - 0.93) / 0.12) ** 2))
    const footRound = Math.sqrt(Math.max(0, 1 - (Math.min(1, Math.max(0, 1 - t / 0.035)) ** 2)))
    const lipRound = Math.sqrt(Math.max(0, 1 - (Math.min(1, Math.max(0, (t - 0.96) / 0.04)) ** 2)))
    const radius = 0.482 - 0.058 * lowerWaist - 0.036 * upperWaist
      + 0.024 * shoulder - 0.054 * t - 0.052 * (1 - footRound) - 0.074 * (1 - lipRound)
    return new THREE.Vector2(radius, bodyBase + bodyHeight * t)
  })
  return [new THREE.Vector2(0, bodyBase), ...points, new THREE.Vector2(0, bodyTop)]
}

function makeThreadProfile() {
  return Array.from({ length: 81 }, (_, index) => {
    const t = index / 80
    return new THREE.Vector2(0.316 - t * 0.105 + 0.008 * Math.cos(t * Math.PI * 16), 1.08 + 0.43 * t)
  })
}

function makeEmbossTexture() {
  const width = 1024
  const height = 1024
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return null
  context.translate(width / 2, height * 0.50)
  context.rotate(Math.PI / 2)
  context.filter = 'blur(2px)'
  context.fillStyle = '#fff'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.font = '400 105px "Krona One"'
  context.scale(1.14, 1.08)
  context.fillText('MOCHI', 0, 0)
  const heightMap = context.getImageData(0, 0, width, height).data
  const normals = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = 4 * (y * width + x)
      const xSlope = (heightMap[index - 4 + 3] || 0) - (heightMap[index + 4 + 3] || 0)
      const ySlope = (heightMap[index + width * 4 + 3] || 0) - (heightMap[index - width * 4 + 3] || 0)
      const length = Math.hypot(xSlope, ySlope, 68)
      normals[index] = 128 + 127 * xSlope / length
      normals[index + 1] = 128 + 127 * ySlope / length
      normals[index + 2] = 128 + 127 * 68 / length
      normals[index + 3] = 255
    }
  }
  const texture = new THREE.DataTexture(normals, width, height)
  texture.flipY = true
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.needsUpdate = true
  return texture
}

function studioReflection(renderer: THREE.WebGLRenderer) {
  const studio = new THREE.Scene()
  studio.background = new THREE.Color(0.42, 0.45, 0.48)
  const lamps: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>[] = []
  const panel = (x: number, y: number, z: number, w: number, h: number, intensity: number) => {
    const lamp = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(intensity, intensity, intensity) }))
    lamp.position.set(x, y, z)
    lamp.lookAt(0, 0, 0)
    lamps.push(lamp)
    studio.add(lamp)
  }
  panel(-4, 4, 2.8, 2.1, 5.2, 5.2)
  panel(-3.2, 1.2, 3.5, 0.68, 4.8, 2.6)
  panel(4, 2.3, -2, 2.2, 5.8, 2.9)
  panel(2.8, -0.3, 3.8, 1.2, 5, 0.06)
  const generator = new THREE.PMREMGenerator(renderer)
  const result = generator.fromScene(studio, 0.02, 0.1, 30, { size: 128 })
  generator.dispose()
  lamps.forEach(lamp => { lamp.geometry.dispose(); lamp.material.dispose() })
  return result
}

function softShadowTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const context = canvas.getContext('2d')!
  const falloff = context.createRadialGradient(64, 64, 0, 64, 64, 64)
  falloff.addColorStop(0, '#ffffffc0')
  falloff.addColorStop(0.48, '#ffffff60')
  falloff.addColorStop(1, '#ffffff00')
  context.fillStyle = falloff
  context.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(canvas)
}

function addJellyDeformation(material: THREE.MeshPhysicalMaterial, uniformRefs: UniformMap[]) {
  material.onBeforeCompile = shader => {
    shader.uniforms.uTime = { value: 0 }
    shader.uniforms.uSquash = { value: 1 }
    shader.uniforms.uDent = { value: 0 }
    shader.uniforms.uDentY = { value: 0.5 }
    shader.uniforms.uBend = { value: new THREE.Vector2() }
    shader.uniforms.uWobble = { value: 0 }
    uniformRefs.push(shader.uniforms)
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
uniform float uTime;
uniform float uSquash;
uniform float uDent;
uniform float uDentY;
uniform vec2 uBend;
uniform float uWobble;`,
    )
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `vec3 transformed = vec3(position);
float mochiHeight = clamp((position.y + 1.5) / 2.62, 0.0, 1.0);
float dentFalloff = exp(-pow((mochiHeight - uDentY) / 0.12, 2.0));
float squash = max(uSquash, 0.64);
float preserveVolume = inversesqrt(squash);
transformed.y = -1.5 + (transformed.y + 1.5) * squash;
transformed.xz *= preserveVolume;
transformed.xz *= 1.0 - dentFalloff * uDent * 0.22;
transformed.x += uBend.x * (mochiHeight - 0.5);
transformed.z += uBend.y * (mochiHeight - 0.5);
float wave = sin(uTime * 7.0 - mochiHeight * 22.0) * uWobble;
transformed.xz *= 1.0 + wave * 0.025;`,
    )
  }
  material.customProgramCacheKey = () => 'mochi-jelly-deformation-v1'
}

function createJellyMaterial(colour: string, uniformRefs: UniformMap[], inner: boolean, emboss: THREE.Texture | null) {
  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(colour).lerp(new THREE.Color('#ffffff'), inner ? 0 : 0.32),
    transmission: inner ? 0 : 1,
    thickness: inner ? 0 : 0.13,
    roughness: inner ? 0.34 : 0.14,
    ior: 1.38,
    clearcoat: inner ? 0 : 1,
    clearcoatRoughness: 0.06,
    attenuationColor: new THREE.Color(colour),
    attenuationDistance: 0.55,
    envMapIntensity: inner ? 0.8 : 0.73,
  })
  if (!inner && emboss) {
    material.normalMap = emboss
    material.normalScale.set(1.0, 1.0)
  }
  addJellyDeformation(material, uniformRefs)
  return material
}

export default function MochiTube3D({ colour, className = '', reducedMotion = false, fallbackSrc, fallbackAlt = 'MOCHI lip jelly tube', ariaLabel = 'Interactive MOCHI lip jelly tube' }: MochiTube3DProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' })
    } catch {
      setFailed(true)
      return
    }

    const scene = new THREE.Scene()
    const exposed = colour.toLowerCase() === openCherry
    const camera = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.1, 100)
    const centreX = exposed ? 0.31 : 0
    camera.position.set(centreX, 0.64, 8)
    camera.lookAt(centreX, 0.19, 0)
    const environment = studioReflection(renderer)
    scene.environment = environment.texture
    renderer.transmissionResolutionScale = 0.45
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.1
    renderer.setClearColor(0x000000, 0)

    const group = new THREE.Group()
    group.position.y = -0.02
    group.rotation.set(-0.035, -0.075, 0)
    scene.add(group)

    const uniformRefs: UniformMap[] = []
    const emboss = makeEmbossTexture()
    const bodyGeometry = new THREE.LatheGeometry(makeBodyProfile(), 128, -Math.PI)
    bodyGeometry.computeVertexNormals()
    const bodyMaterial = createJellyMaterial(colour, uniformRefs, false, emboss)
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial)
    body.scale.z = 0.82
    body.name = 'MOCHI silicone body'
    group.add(body)

    const innerMaterial = createJellyMaterial(`#${new THREE.Color(colour).multiplyScalar(0.83).getHexString()}`, uniformRefs, true, null)
    const inner = new THREE.Mesh(bodyGeometry.clone(), innerMaterial)
    inner.scale.set(0.958, 0.976, 0.785)
    inner.position.y = -0.01
    inner.name = 'MOCHI inner jelly'
    group.add(inner)

    const threadGeometry = new THREE.LatheGeometry(makeThreadProfile(), 96)
    const threadMaterial = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(colour).lerp(new THREE.Color('#f5fbfa'), 0.5), transmission: 0.72, thickness: 0.45, roughness: 0.18, ior: 1.34, transparent: true, opacity: 0.86 })
    const thread = new THREE.Mesh(threadGeometry, threadMaterial)
    thread.scale.z = 0.82
    thread.name = 'MOCHI threaded neck'
    group.add(thread)

    const beadMaterial = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(colour).lerp(new THREE.Color('#ffffff'), 0.28), transmission: 0.88, thickness: 0.5, roughness: 0.08, ior: 1.36, clearcoat: 1, clearcoatRoughness: 0.04, transparent: true, opacity: 0.95 })
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.207, 48, 32), beadMaterial)
    bead.position.set(0.026, 1.53, 0)
    bead.rotation.z = -0.49
    bead.visible = exposed
    bead.scale.set(1.08, 0.76, 0.88)
    bead.name = 'MOCHI jelly bead'
    group.add(bead)

    const capMaterial = new THREE.MeshPhysicalMaterial({ color: '#FAF7F2', roughness: 0.28, sheen: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.14 })
    const capProfile = [new THREE.Vector2(0, 0), new THREE.Vector2(0.388, 0),
      new THREE.Vector2(0.412, 0.018), new THREE.Vector2(0.42, 0.07)]
    for (let i = 0; i <= 48; i += 1) {
      const angle = (i / 48) * Math.PI / 2
      capProfile.push(new THREE.Vector2(0.42 * Math.cos(angle), 0.15 + 0.56 * Math.sin(angle)))
    }
    const cap = new THREE.Mesh(new THREE.LatheGeometry(capProfile, 96), capMaterial)
    cap.scale.z = 0.88
    cap.position.set(exposed ? 0.92 : 0, exposed ? bodyBase : 1.105, 0)
    cap.name = 'MOCHI milk cap'
    group.add(cap)

    const softShadow = softShadowTexture()
    const shadowMaterial = new THREE.MeshBasicMaterial({ color: '#735e66', map: softShadow,
      transparent: true, opacity: 0.38, depthWrite: false })
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.34), shadowMaterial)
    shadow.rotation.x = -0.33
    shadow.position.set(exposed ? 0.40 : 0.14, bodyBase - 0.03, -0.43)
    scene.add(shadow)

    scene.add(new THREE.HemisphereLight('#fffaf3', '#e6d3d7', 0.95))
    const key = new THREE.DirectionalLight('#fff8ee', 1.0)
    key.position.set(-3.5, 4.5, 5)
    scene.add(key)

    const squash = makeSpring(1)
    const dent = makeSpring(0)
    const dentY = makeSpring(0.5)
    const bendX = makeSpring(0)
    const bendZ = makeSpring(0)
    const wobble = makeSpring(0)
    const beadSize = makeSpring(1)
    const rotationX = makeSpring(-0.035)
    const rotationY = makeSpring(-0.075)
    const pointer = { down: false, startX: 0, startY: 0, lastX: 0, lastY: 0, lastTime: 0, velocityX: 0, velocityY: 0, startRotationX: 0, startRotationY: 0 }
    const raycaster = new THREE.Raycaster()
    const pointerNdc = new THREE.Vector2()
    const visible = { value: true }
    let frame = 0
    let elapsed = 0
    let scrollY = window.scrollY
    let scrollVelocity = 0

    const resize = () => {
      const bounds = container.getBoundingClientRect()
      const width = Math.max(bounds.width, 1)
      const height = Math.max(bounds.height, 1)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, reducedMotion ? 1.25 : 1.75))
      renderer.setSize(width, height, false)
      const halfHeight = Math.max(2.05, (exposed ? 1.16 : 0.68) * height / width)
      camera.top = halfHeight
      camera.bottom = -halfHeight
      camera.left = -halfHeight * width / height
      camera.right = -camera.left
      camera.updateProjectionMatrix()
    }
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(container)
    resize()

    const setDentHeight = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect()
      pointerNdc.set(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1)
      raycaster.setFromCamera(pointerNdc, camera)
      const hit = raycaster.intersectObject(body, false)[0]
      if (hit) {
        const localPoint = body.worldToLocal(hit.point.clone())
        dentY.target = clamp((localPoint.y - bodyBase) / bodyHeight, 0.08, 0.92)
      } else {
        dentY.target = clamp((event.clientY - bounds.top) / bounds.height, 0.08, 0.92)
      }
    }
    const onPointerDown = (event: PointerEvent) => {
      pointer.down = true
      pointer.startX = event.clientX
      pointer.startY = event.clientY
      pointer.lastX = event.clientX
      pointer.lastY = event.clientY
      pointer.lastTime = performance.now()
      pointer.velocityX = 0
      pointer.velocityY = 0
      pointer.startRotationX = rotationX.value
      pointer.startRotationY = rotationY.value
      setDentHeight(event)
      squash.target = 0.84
      dent.target = 0.8
      beadSize.target = 1.28
      canvas.setPointerCapture(event.pointerId)
    }
    const onPointerMove = (event: PointerEvent) => {
      if (!pointer.down) return
      const now = performance.now()
      const deltaTime = Math.max(now - pointer.lastTime, 1)
      pointer.velocityX = (event.clientX - pointer.lastX) / deltaTime
      pointer.velocityY = (event.clientY - pointer.lastY) / deltaTime
      pointer.lastX = event.clientX
      pointer.lastY = event.clientY
      pointer.lastTime = now
      rotationY.target = rubberBand(pointer.startRotationY + (event.clientX - pointer.startX) * 0.006, 0.61)
      rotationX.target = rubberBand(pointer.startRotationX + (event.clientY - pointer.startY) * 0.004, 0.28)
      setDentHeight(event)
    }
    const releasePointer = () => {
      if (!pointer.down) return
      pointer.down = false
      squash.target = 1
      dent.target = 0
      beadSize.target = 1
      rotationX.target = -0.035
      rotationY.target = -0.075
      wobble.velocity += clamp(pointer.velocityX * 0.12 + pointer.velocityY * 0.08, -3, 3)
    }
    const onPointerUp = (event: PointerEvent) => {
      releasePointer()
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
    }
    const onScroll = () => {
      const nextScrollY = window.scrollY
      scrollVelocity = (nextScrollY - scrollY) * 0.001
      scrollY = nextScrollY
    }
    const observer = new IntersectionObserver(entries => { visible.value = entries[0]?.isIntersecting ?? true }, { rootMargin: '120px' })
    observer.observe(container)
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', releasePointer)
    window.addEventListener('scroll', onScroll, { passive: true })

    let lastTime = performance.now()
    const render = () => {
      frame = window.requestAnimationFrame(render)
      const now = performance.now()
      const dt = Math.min((now - lastTime) / 1000, 0.033)
      lastTime = now
      if (!visible.value || document.hidden) return
      elapsed += dt
      scrollVelocity *= 0.86
      bendX.target = clamp(scrollVelocity * 2.8, -0.07, 0.07)
      bendZ.target = clamp(pointer.velocityX * 0.0005, -0.035, 0.035)
      pointer.velocityX *= 0.86
      pointer.velocityY *= 0.86
      if (reducedMotion) {
        squash.value = squash.target
        dent.value = dent.target
        bendX.value = 0
        bendZ.value = 0
        wobble.value = 0
        beadSize.value = beadSize.target
        rotationX.value = rotationX.target
        rotationY.value = rotationY.target
      } else {
        stepSpring(squash, dt, jellySpring)
        stepSpring(dent, dt, jellySpring)
        stepSpring(dentY, dt, jellySpring)
        stepSpring(bendX, dt, jellySpring)
        stepSpring(bendZ, dt, jellySpring)
        stepSpring(wobble, dt, jellySpring)
        stepSpring(beadSize, dt, jellySpring)
        stepSpring(rotationX, dt, heavySpring)
        stepSpring(rotationY, dt, heavySpring)
      }
      group.rotation.x = rotationX.value
      group.rotation.y = rotationY.value
      const nozzleShift = bodyHeight * (squash.value - 1)
      thread.position.y = nozzleShift
      if (!exposed) cap.position.y = 1.105 + nozzleShift
      bead.scale.set(0.93 * beadSize.value, 1.38 * beadSize.value, 0.90 * beadSize.value)
      bead.position.y = 1.53 + nozzleShift + (beadSize.value - 1) * 0.11
      shadow.scale.x = 1.25 + Math.abs(squash.value - 1) * 0.25
      shadowMaterial.opacity = 0.38 + (1 - squash.value) * 0.15
      uniformRefs.forEach(uniforms => {
        uniforms.uTime.value = elapsed
        uniforms.uSquash.value = squash.value
        uniforms.uDent.value = dent.value
        uniforms.uDentY.value = dentY.value
        ;(uniforms.uBend.value as THREE.Vector2).set(bendX.value, bendZ.value)
        uniforms.uWobble.value = wobble.value
      })
      renderer.render(scene, camera)
      canvas.dataset.rendered = 'true'
    }
    render()

    return () => {
      window.cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      observer.disconnect()
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', releasePointer)
      window.removeEventListener('scroll', onScroll)
      bodyGeometry.dispose()
      bodyMaterial.dispose()
      inner.geometry.dispose()
      innerMaterial.dispose()
      threadGeometry.dispose()
      threadMaterial.dispose()
      bead.geometry.dispose()
      beadMaterial.dispose()
      cap.geometry.dispose()
      capMaterial.dispose()
      shadow.geometry.dispose()
      shadowMaterial.dispose()
      environment.dispose()
      softShadow.dispose()
      emboss?.dispose()
      renderer.dispose()
    }
  }, [colour, reducedMotion])

  return <div ref={containerRef} className={`mochi-tube-3d ${className}`} role="img" aria-label={ariaLabel}>
    <canvas ref={canvasRef} aria-hidden="true" hidden={failed} style={failed ? { display: 'none' } : undefined} />
    {failed && fallbackSrc && <img className="mochi-tube-3d__fallback" src={fallbackSrc} alt={fallbackAlt} />}
  </div>
}
