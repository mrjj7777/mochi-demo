import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { flavours, wallpaperFileSize } from '../brand'
import './CampaignLoopGallery.css'

gsap.registerPlugin(ScrollTrigger, useGSAP)

export type GalleryItem = {
  id: string
  src: string
  downloadSrc: string
  alt: string
  title: string
  aspect: number
}

/**
 * 14 100%-unique, balanced full-spectrum visuals in ONE unified 3D Spiral Flux cylinder:
 * all 6 multi-colour MOCHI wallpapers (teal, sky blue, rose, amber, forest green, cobalt)
 * interleaved with rich studio & street campaign visuals (zero pink overload, zero repeats).
 */
const ARCHIVE_ITEMS: GalleryItem[] = [
  { id: 'a01', src: `/media/wallpapers/mochi-${flavours[0].asset}-${wallpaperFileSize}.png`, downloadSrc: `/media/wallpapers/mochi-${flavours[0].asset}-${wallpaperFileSize}.png`, alt: 'CHERRY MOCHI wallpaper', title: 'CHERRY', aspect: 0.56 },
  { id: 'a02', src: '/media/campaigns/gloss-gang.webp', downloadSrc: '/media/campaigns/gloss-gang.webp', alt: 'MOCHI Gloss Gang editorial', title: 'GLOSS GANG', aspect: 0.8 },
  { id: 'a03', src: `/media/wallpapers/mochi-${flavours[4].asset}-${wallpaperFileSize}.png`, downloadSrc: `/media/wallpapers/mochi-${flavours[4].asset}-${wallpaperFileSize}.png`, alt: 'MINT MOCHI wallpaper', title: 'MINT', aspect: 0.56 },
  { id: 'a04', src: '/media/campaigns/prism-shadow.webp', downloadSrc: '/media/campaigns/prism-shadow.webp', alt: 'MOCHI chromatic prism shadow', title: 'PRISM', aspect: 0.8 },
  { id: 'a05', src: `/media/wallpapers/mochi-${flavours[5].asset}-${wallpaperFileSize}.png`, downloadSrc: `/media/wallpapers/mochi-${flavours[5].asset}-${wallpaperFileSize}.png`, alt: 'MANGO MOCHI wallpaper', title: 'MANGO', aspect: 0.56 },
  { id: 'a06', src: '/media/photos/mochi-model-4.webp', downloadSrc: '/media/photos/mochi-model-4.webp', alt: 'MOCHI editorial portrait', title: 'EDITORIAL', aspect: 0.78 },
  { id: 'a07', src: `/media/wallpapers/mochi-${flavours[1].asset}-${wallpaperFileSize}.png`, downloadSrc: `/media/wallpapers/mochi-${flavours[1].asset}-${wallpaperFileSize}.png`, alt: 'PEACH MOCHI wallpaper', title: 'PEACH', aspect: 0.56 },
  { id: 'a08', src: '/media/campaigns/hand-squeeze.webp', downloadSrc: '/media/campaigns/hand-squeeze.webp', alt: 'MOCHI hand squeeze study', title: 'SQUEEZE', aspect: 0.8 },
  { id: 'a09', src: `/media/wallpapers/mochi-${flavours[3].asset}-${wallpaperFileSize}.png`, downloadSrc: `/media/wallpapers/mochi-${flavours[3].asset}-${wallpaperFileSize}.png`, alt: 'GRAPE MOCHI wallpaper', title: 'GRAPE', aspect: 0.56 },
  { id: 'a10', src: '/media/photos/mochi-all-row.webp', downloadSrc: '/media/photos/mochi-all-row.webp', alt: 'All six MOCHI shades in a row', title: 'LINEUP', aspect: 0.85 },
  { id: 'a11', src: '/media/campaigns/pink-noise.webp', downloadSrc: '/media/campaigns/pink-noise.webp', alt: 'MOCHI Pink Noise cover', title: 'PINK NOISE', aspect: 0.8 },
  { id: 'a12', src: `/media/wallpapers/mochi-${flavours[2].asset}-${wallpaperFileSize}.png`, downloadSrc: `/media/wallpapers/mochi-${flavours[2].asset}-${wallpaperFileSize}.png`, alt: 'LYCHEE MOCHI wallpaper', title: 'LYCHEE', aspect: 0.56 },
  { id: 'a13', src: '/media/campaigns/hold-this.webp', downloadSrc: '/media/campaigns/hold-this.webp', alt: 'MOCHI Hold This editorial', title: 'HOLD THIS', aspect: 0.8 },
  { id: 'a14', src: '/media/campaigns/squish-claw.webp', downloadSrc: '/media/campaigns/squish-claw.webp', alt: 'MOCHI silicone press study', title: 'SQUISH', aspect: 0.8 },
]

/**
 * Custom realistic 3D curved-gallery-print shader:
 * wraps directional studio light across the physical cylinder curvature,
 * subtly attenuates far-side prints into warm gallery depth, and sweeps
 * a tactile glossy specular sheen across hovered posters.
 */
const POSTER_VERTEX = `
  varying vec2 vUv;
  varying vec3 vNormalView;
  varying vec3 vViewDir;

  void main() {
    vUv = uv;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    vNormalView = normalize(normalMatrix * normal);
    vViewDir = normalize(-mvPos.xyz);
    gl_Position = projectionMatrix * mvPos;
  }
`

const POSTER_FRAGMENT = `
  uniform sampler2D uMap;
  uniform float uOpacity;
  uniform float uFrontFactor;
  uniform float uHover;
  uniform vec2 uPointer;

  varying vec2 vUv;
  varying vec3 vNormalView;
  varying vec3 vViewDir;

  void main() {
    vec4 tex = texture2D(uMap, vUv);
    vec3 N = gl_FrontFacing ? normalize(vNormalView) : -normalize(vNormalView);
    vec3 V = normalize(vViewDir);

    // Directional studio key light wrapping across the physical 3D cylinder curve
    vec3 keyLight = normalize(vec3(0.45 + uPointer.x * 0.5, 0.55 + uPointer.y * 0.4, 1.0));
    float diff = clamp(dot(N, keyLight), 0.0, 1.0);
    float curveLighting = 0.80 + 0.24 * diff;

    // Subtle coated art-paper gloss sheen across the curved highlight
    vec3 H = normalize(keyLight + V);
    float spec = pow(max(dot(N, H), 0.0), 36.0) * (0.07 + uHover * 0.14);

    // Warm gallery atmospheric veil on back-of-cylinder prints so front prints stay razor crisp
    vec3 creamFog = vec3(0.949, 0.929, 0.894);
    float depthMist = (1.0 - uFrontFactor) * 0.36;

    vec3 col = tex.rgb * curveLighting + vec3(1.0, 0.985, 0.97) * spec;
    col = mix(col, creamFog, depthMist * (1.0 - uHover * 0.7));

    gl_FragColor = vec4(col, tex.a * uOpacity);
  }
`

function wrapSlot(value: number, total: number) {
  let v = ((value % total) + total) % total
  if (v > total / 2) v -= total
  return v
}

function createCurvedPosterGeometry(radius: number, height: number, aspect: number) {
  const arcWidth = height * aspect
  const thetaLength = arcWidth / radius
  return new THREE.CylinderGeometry(
    radius,
    radius,
    height,
    28,
    1,
    true,
    -thetaLength / 2,
    thetaLength,
  )
}

export default function CampaignLoopGallery({
  reduced,
  onOpenItem,
}: {
  reduced: boolean
  onOpenItem: (items: GalleryItem[], index: number) => void
}) {
  const sectionRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasHostRef = useRef<HTMLDivElement>(null)

  const stateRef = useRef({
    spinPos: 0,
    scrollOffset: 0,
    dragOffset: 0,
    angularVel: 0,
    pointerX: 0,
    pointerY: 0,
    smoothPX: 0,
    smoothPY: 0,
    dragging: false,
    moved: false,
    hovering: false,
    startX: 0,
    lastX: 0,
  })

  useEffect(() => {
    const host = canvasHostRef.current
    const stage = stageRef.current
    if (!host || !stage) return

    let disposed = false
    let rafId = 0
    let visible = true

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.setClearColor(0x000000, 0)
    host.innerHTML = ''
    host.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60)
    camera.position.set(0, 0.12, 6.7)

    const spiralGroup = new THREE.Group()
    spiralGroup.position.y = -0.18
    scene.add(spiralGroup)

    const loader = new THREE.TextureLoader()
    const maxAniso = renderer.capabilities.getMaxAnisotropy()

    // Tighter sculptural 3D cylinder radius so posters sit closer & richer together
    const baseRadius = 2.66

    const cardEntries = ARCHIVE_ITEMS.map((item, idx) => {
      const texture = loader.load(item.src)
      texture.colorSpace = THREE.SRGBColorSpace
      texture.anisotropy = Math.min(8, maxAniso)
      texture.minFilter = THREE.LinearMipmapLinearFilter
      texture.magFilter = THREE.LinearFilter

      const cardH = item.aspect < 0.65 ? 2.04 : 1.84
      const geom = createCurvedPosterGeometry(baseRadius, cardH, item.aspect)

      const mat = new THREE.ShaderMaterial({
        vertexShader: POSTER_VERTEX,
        fragmentShader: POSTER_FRAGMENT,
        side: THREE.DoubleSide,
        transparent: true,
        uniforms: {
          uMap: { value: texture },
          uOpacity: { value: 1 },
          uFrontFactor: { value: 1 },
          uHover: { value: 0 },
          uPointer: { value: new THREE.Vector2(0, 0) },
        },
      })

      const pivot = new THREE.Group()
      const mesh = new THREE.Mesh(geom, mat)
      mesh.userData = { index: idx }
      pivot.add(mesh)
      spiralGroup.add(pivot)

      return {
        pivot,
        mesh,
        geom,
        mat,
        texture,
        hover: 0,
        index: idx,
      }
    })

    const raycaster = new THREE.Raycaster()
    const pointerNdc = new THREE.Vector2(-10, -10)
    let hoveredIdx = -1
    let currentCamZ = 6.7

    const resize = () => {
      if (disposed) return
      const w = host.clientWidth || window.innerWidth
      const h = host.clientHeight || window.innerHeight
      renderer.setSize(w, h, false)
      camera.aspect = w / Math.max(1, h)
      // Aspect-aware camera distance so narrow/split-pane & mobile screens frame the full 3D spiral cleanly
      currentCamZ = camera.aspect < 0.75 ? 9.4 : camera.aspect < 1.25 ? 7.6 : 6.45
      camera.position.z = currentCamZ
      camera.updateProjectionMatrix()
    }
    resize()

    const ro = new ResizeObserver(resize)
    ro.observe(host)

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry?.isIntersecting ?? true
        if (visible && !rafId) {
          lastNow = performance.now()
          rafId = requestAnimationFrame(tick)
        }
      },
      { threshold: 0 },
    )
    io.observe(stage)

    const onPointerMove = (event: PointerEvent) => {
      const rect = stage.getBoundingClientRect()
      if (rect.width < 1 || rect.height < 1) return
      const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1
      const ny = -(((event.clientY - rect.top) / rect.height) * 2 - 1)
      stateRef.current.pointerX = nx
      stateRef.current.pointerY = ny
      pointerNdc.set(nx, ny)

      if (stateRef.current.dragging) {
        const dx = event.clientX - stateRef.current.lastX
        stateRef.current.lastX = event.clientX
        if (Math.abs(event.clientX - stateRef.current.startX) > 6) {
          stateRef.current.moved = true
        }
        const delta = -dx / 145
        stateRef.current.dragOffset += delta
        stateRef.current.angularVel = delta * 24
      }
    }

    const onPointerDown = (event: PointerEvent) => {
      stateRef.current.dragging = true
      stateRef.current.moved = false
      stateRef.current.startX = event.clientX
      stateRef.current.lastX = event.clientX
      stateRef.current.angularVel = 0
    }

    const onPointerUp = () => {
      stateRef.current.dragging = false
    }

    const onPointerEnter = () => {
      stateRef.current.hovering = true
    }

    const onPointerLeave = () => {
      stateRef.current.hovering = false
      stateRef.current.dragging = false
      stateRef.current.pointerX = 0
      stateRef.current.pointerY = 0
      pointerNdc.set(-10, -10)
    }

    const onClick = () => {
      if (stateRef.current.moved) return
      if (hoveredIdx >= 0 && hoveredIdx < ARCHIVE_ITEMS.length) {
        onOpenItem(ARCHIVE_ITEMS, hoveredIdx)
      }
    }

    stage.addEventListener('pointermove', onPointerMove, { passive: true })
    stage.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointerup', onPointerUp)
    stage.addEventListener('pointerenter', onPointerEnter)
    stage.addEventListener('pointerleave', onPointerLeave)
    host.addEventListener('click', onClick)

    let lastNow = performance.now()
    const total = cardEntries.length
    const angleStep = (Math.PI * 2) / 9.2 // dense, cohesive 3D cylindrical ribbon
    const helixPitch = 0.42 // compact vertical helical pitch so prints stay close together

    const tick = (now: number) => {
      rafId = 0
      if (disposed || !visible || document.visibilityState === 'hidden') return

      const dt = Math.min(0.04, Math.max(0.001, (now - lastNow) / 1000))
      lastNow = now

      const st = stateRef.current

      if (!st.dragging && !reduced) {
        const autoDrift = st.hovering ? 0.06 : 0.24
        st.dragOffset += (autoDrift + st.angularVel) * dt
        st.angularVel *= Math.exp(-3.8 * dt)
        if (Math.abs(st.angularVel) < 0.002) st.angularVel = 0
      }

      const desiredSpin = st.scrollOffset + st.dragOffset
      st.spinPos += (desiredSpin - st.spinPos) * (reduced ? 1 : 1 - Math.exp(-9.5 * dt))

      // Smooth 3D mouse camera orbit & tilt
      st.smoothPX += (st.pointerX - st.smoothPX) * (1 - Math.exp(-6.5 * dt))
      st.smoothPY += (st.pointerY - st.smoothPY) * (1 - Math.exp(-6.5 * dt))

      camera.position.x = st.smoothPX * 0.95
      camera.position.y = 0.12 + st.smoothPY * 0.68
      camera.position.z = currentCamZ - Math.abs(st.smoothPX) * 0.22
      camera.lookAt(0, -0.14, 0)

      // Subtle architectural tilt reacting to pointer & velocity
      spiralGroup.rotation.z = -0.075 + st.smoothPX * 0.055
      spiralGroup.rotation.x = 0.06 - st.smoothPY * 0.07

      // 3D Raycast hover on curved cylinder posters
      raycaster.setFromCamera(pointerNdc, camera)
      const hits = raycaster.intersectObjects(
        cardEntries.map(c => c.mesh),
        false,
      )
      hoveredIdx = hits.length > 0 ? (hits[0].object.userData.index as number) : -1
      host.style.cursor = st.dragging ? 'grabbing' : hoveredIdx >= 0 ? 'pointer' : 'grab'

      for (let i = 0; i < total; i += 1) {
        const entry = cardEntries[i]
        const u = wrapSlot(i - st.spinPos, total)
        const absU = Math.abs(u)

        const targetHover = hoveredIdx === i ? 1 : 0
        entry.hover += (targetHover - entry.hover) * (1 - Math.exp(-10 * dt))

        const angle = u * angleStep
        const y = -u * helixPitch
        const radiusScale = 1 + entry.hover * 0.12

        entry.pivot.position.set(0, y, 0)
        entry.pivot.rotation.y = angle
        entry.pivot.scale.set(radiusScale, 1 + entry.hover * 0.05, radiusScale)

        const edgeFade = absU > 5.0 ? Math.max(0, 1 - (absU - 5.0) / 1.8) : 1
        const frontFactor = 0.5 + 0.5 * Math.cos(angle)
        const opacity = edgeFade * (0.44 + 0.56 * frontFactor)

        entry.mat.uniforms.uOpacity.value = opacity
        entry.mat.uniforms.uFrontFactor.value = frontFactor
        entry.mat.uniforms.uHover.value = entry.hover
        entry.mat.uniforms.uPointer.value.set(st.smoothPX, st.smoothPY)
        entry.mesh.visible = opacity > 0.03
      }

      renderer.render(scene, camera)
      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)

    return () => {
      disposed = true
      if (rafId) cancelAnimationFrame(rafId)
      ro.disconnect()
      io.disconnect()
      stage.removeEventListener('pointermove', onPointerMove)
      stage.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
      stage.removeEventListener('pointerenter', onPointerEnter)
      stage.removeEventListener('pointerleave', onPointerLeave)
      host.removeEventListener('click', onClick)
      cardEntries.forEach(c => {
        c.geom.dispose()
        c.texture.dispose()
        c.mat.dispose()
      })
      renderer.dispose()
    }
  }, [onOpenItem, reduced])

  useGSAP(
    () => {
      const section = sectionRef.current
      if (!section || reduced) return
      const isMobile = window.matchMedia('(max-width: 700px)').matches

      const trigger = ScrollTrigger.create({
        trigger: section,
        start: 'top top',
        end: () => `+=${Math.round(window.innerHeight * (isMobile ? 2.4 : 3.2))}`,
        pin: true,
        pinSpacing: true,
        anticipatePin: 1,
        scrub: true,
        invalidateOnRefresh: true,
        onUpdate: self => {
          stateRef.current.scrollOffset = self.progress * 11.5
        },
      })
      return () => trigger.kill()
    },
    { scope: sectionRef, dependencies: [reduced] },
  )

  return (
    <section id="wallpapers" ref={sectionRef} className="spiral-gallery section" data-aura="#2346B8,#F2EDE4">
      <div ref={stageRef} className="spiral-gallery__stage">
        <div className="spiral-gallery__header">
          <p className="display spiral-gallery__title">
            take the colour <em>home.</em>
          </p>
        </div>

        <div
          ref={canvasHostRef}
          className="spiral-gallery__canvas-host"
          aria-label="Interactive 3D helical spiral gallery of MOCHI campaigns, creators, and wallpapers"
        />
      </div>
    </section>
  )
}
