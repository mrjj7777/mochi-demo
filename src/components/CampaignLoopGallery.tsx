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
 * 14 curated, authentic, non-repeating MOCHI visuals (zero pink overload, zero promo-mockup clutter):
 * all 6 full-spectrum MOCHI wallpapers interleaved with original studio & editorial photography.
 */
const ARCHIVE_ITEMS: GalleryItem[] = [
  { id: 'a01', src: `/media/wallpapers/mochi-${flavours[0].asset}-${wallpaperFileSize}.png`, downloadSrc: `/media/wallpapers/mochi-${flavours[0].asset}-${wallpaperFileSize}.png`, alt: 'CHERRY MOCHI wallpaper', title: 'CHERRY', aspect: 0.56 },
  { id: 'a02', src: '/media/photos/mochi-all-row.webp', downloadSrc: '/media/photos/mochi-all-row.webp', alt: 'All six MOCHI lip jelly shades', title: 'LINEUP', aspect: 1.25 },
  { id: 'a03', src: `/media/wallpapers/mochi-${flavours[4].asset}-${wallpaperFileSize}.png`, downloadSrc: `/media/wallpapers/mochi-${flavours[4].asset}-${wallpaperFileSize}.png`, alt: 'MINT MOCHI wallpaper', title: 'MINT', aspect: 0.56 },
  { id: 'a04', src: '/media/campaigns/gloss-gang.webp', downloadSrc: '/media/campaigns/gloss-gang.webp', alt: 'MOCHI street editorial', title: 'CHIMBAI', aspect: 0.8 },
  { id: 'a05', src: `/media/wallpapers/mochi-${flavours[5].asset}-${wallpaperFileSize}.png`, downloadSrc: `/media/wallpapers/mochi-${flavours[5].asset}-${wallpaperFileSize}.png`, alt: 'MANGO MOCHI wallpaper', title: 'MANGO', aspect: 0.56 },
  { id: 'a06', src: '/media/photos/mochi-model-4.webp', downloadSrc: '/media/photos/mochi-model-4.webp', alt: 'MOCHI editorial study', title: 'LOOK 04', aspect: 0.78 },
  { id: 'a07', src: `/media/wallpapers/mochi-${flavours[1].asset}-${wallpaperFileSize}.png`, downloadSrc: `/media/wallpapers/mochi-${flavours[1].asset}-${wallpaperFileSize}.png`, alt: 'PEACH MOCHI wallpaper', title: 'PEACH', aspect: 0.56 },
  { id: 'a08', src: '/media/campaigns/hand-squeeze.webp', downloadSrc: '/media/campaigns/hand-squeeze.webp', alt: 'MOCHI tactile squeeze sequence', title: 'SQUEEZE', aspect: 0.8 },
  { id: 'a09', src: `/media/wallpapers/mochi-${flavours[3].asset}-${wallpaperFileSize}.png`, downloadSrc: `/media/wallpapers/mochi-${flavours[3].asset}-${wallpaperFileSize}.png`, alt: 'GRAPE MOCHI wallpaper', title: 'GRAPE', aspect: 0.56 },
  { id: 'a10', src: '/media/photos/mochi-hero-wide.webp', downloadSrc: '/media/photos/mochi-hero-wide.webp', alt: 'MOCHI wide studio composition', title: 'STUDIO', aspect: 1.32 },
  { id: 'a11', src: `/media/wallpapers/mochi-${flavours[2].asset}-${wallpaperFileSize}.png`, downloadSrc: `/media/wallpapers/mochi-${flavours[2].asset}-${wallpaperFileSize}.png`, alt: 'LYCHEE MOCHI wallpaper', title: 'LYCHEE', aspect: 0.56 },
  { id: 'a12', src: '/media/campaigns/prism-shadow.webp', downloadSrc: '/media/campaigns/prism-shadow.webp', alt: 'MOCHI prism light study', title: 'PRISM', aspect: 0.8 },
  { id: 'a13', src: '/media/photos/mochi-diptych-cherry.webp', downloadSrc: '/media/photos/mochi-diptych-cherry.webp', alt: 'MOCHI cherry editorial diptych', title: 'CHERRY STUDY', aspect: 0.8 },
  { id: 'a14', src: '/media/photos/mochi-diptych-lychee.webp', downloadSrc: '/media/photos/mochi-diptych-lychee.webp', alt: 'MOCHI lychee editorial diptych', title: 'LYCHEE STUDY', aspect: 0.8 },
]

/**
 * Industrial-grade true-colour 3D curved-sheet shader:
 * preserves 100% original photography colours (zero pink/warm wash),
 * adds crisp directional lighting across the real curved cylinder geometry,
 * subtle specular edge reflection on mouse hover, and subtle velocity shear.
 */
const POSTER_VERTEX = `
  uniform float uVelocity;
  uniform float uHover;
  varying vec2 vUv;
  varying vec3 vNormalView;
  varying vec3 vViewDir;

  void main() {
    vUv = uv;
    vec3 p = position;
    // Real physical aerodynamic flex along vertical axis under rotational speed
    float flex = sin(uv.y * 3.14159265) * clamp(uVelocity, -2.5, 2.5) * 0.045;
    p.z += flex + sin(uv.x * 3.14159265) * uHover * 0.06;

    vec4 mvPos = modelViewMatrix * vec4(p, 1.0);
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

    // Clean neutral studio key light wrapping realistically across the 3D cylinder curve
    vec3 keyLight = normalize(vec3(0.4 + uPointer.x * 0.55, 0.45 + uPointer.y * 0.45, 1.0));
    float diff = clamp(dot(N, keyLight), 0.0, 1.0);
    float light = 0.86 + 0.16 * diff;

    // Subtle crisp museum-glass specular highlight
    vec3 H = normalize(keyLight + V);
    float spec = pow(max(dot(N, H), 0.0), 48.0) * (0.045 + uHover * 0.12);

    // Subtle neutral depth falloff on rear of cylinder (keeps original colours intact)
    vec3 bgNeutral = vec3(0.949, 0.929, 0.894);
    float rearVeil = (1.0 - uFrontFactor) * 0.28 * (1.0 - uHover * 0.8);

    vec3 col = tex.rgb * light + vec3(1.0) * spec;
    col = mix(col, bgNeutral, rearVeil);

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
    30,
    8,
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
    spinVel: 0,
    scrollTarget: 0,
    lastScrollTarget: 0,
    dragOffset: 0,
    dragVel: 0,
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
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60)
    camera.position.set(0, 0.1, 8.2)

    const spiralGroup = new THREE.Group()
    spiralGroup.position.y = -0.14
    scene.add(spiralGroup)

    const loader = new THREE.TextureLoader()
    const maxAniso = renderer.capabilities.getMaxAnisotropy()

    // Refined industrial-design scale: compact sculptural helix with generous gallery whitespace
    const baseRadius = 2.38

    const cardEntries = ARCHIVE_ITEMS.map((item, idx) => {
      const texture = loader.load(item.src)
      texture.colorSpace = THREE.SRGBColorSpace
      texture.anisotropy = Math.min(8, maxAniso)
      texture.minFilter = THREE.LinearMipmapLinearFilter
      texture.magFilter = THREE.LinearFilter

      const cardH = item.aspect < 0.65 ? 1.48 : item.aspect > 1.1 ? 1.02 : 1.32
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
          uVelocity: { value: 0 },
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
        hoverVal: 0,
        hoverVel: 0,
        repelVal: 0,
        index: idx,
      }
    })

    const raycaster = new THREE.Raycaster()
    const pointerNdc = new THREE.Vector2(-10, -10)
    let hoveredIdx = -1
    let currentCamR = 8.2

    const resize = () => {
      if (disposed) return
      const w = host.clientWidth || window.innerWidth
      const h = host.clientHeight || window.innerHeight
      renderer.setSize(w, h, false)
      camera.aspect = w / Math.max(1, h)
      currentCamR = camera.aspect < 0.72 ? 10.6 : camera.aspect < 1.2 ? 8.8 : 7.8
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
        const delta = -dx / 155
        stateRef.current.dragOffset += delta
        stateRef.current.dragVel = delta * 28
      }
    }

    const onPointerDown = (event: PointerEvent) => {
      stateRef.current.dragging = true
      stateRef.current.moved = false
      stateRef.current.startX = event.clientX
      stateRef.current.lastX = event.clientX
      stateRef.current.dragVel = 0
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
    const angleStep = (Math.PI * 2) / 9.4
    const baseHelixPitch = 0.34

    const tick = (now: number) => {
      rafId = 0
      if (disposed || !visible || document.visibilityState === 'hidden') return

      const dt = Math.min(0.04, Math.max(0.001, (now - lastNow) / 1000))
      lastNow = now

      const st = stateRef.current

      // Real flywheel + spring-damper physics on scroll & drag throw
      if (!st.dragging && !reduced) {
        const idleDrift = st.hovering ? 0.04 : 0.2
        st.dragOffset += (idleDrift + st.dragVel) * dt
        st.dragVel *= Math.exp(-3.1 * dt)
        if (Math.abs(st.dragVel) < 0.002) st.dragVel = 0
      }

      const targetPos = st.scrollTarget + st.dragOffset
      if (reduced) {
        st.spinPos = targetPos
        st.spinVel = 0
      } else {
        // Weighted second-order rotational spring (tactile inertial mass)
        const stiffness = st.dragging ? 220 : 88
        const damping = st.dragging ? 24 : 15.5
        const force = (targetPos - st.spinPos) * stiffness
        st.spinVel += (force - st.spinVel * damping) * dt
        st.spinPos += st.spinVel * dt
      }

      // True spherical 3D camera orbit reacting smoothly to mouse cursor
      st.smoothPX += (st.pointerX - st.smoothPX) * (1 - Math.exp(-5.8 * dt))
      st.smoothPY += (st.pointerY - st.smoothPY) * (1 - Math.exp(-5.8 * dt))

      const azimuth = st.smoothPX * 0.24
      const elevation = 0.04 + st.smoothPY * 0.16
      camera.position.x = Math.sin(azimuth) * currentCamR
      camera.position.z = Math.cos(azimuth) * currentCamR
      camera.position.y = Math.sin(elevation) * currentCamR * 0.65
      camera.lookAt(0, -0.1, 0)

      // Centrifugal expansion & aerodynamic lean proportional to real physical spin velocity
      const speedMag = Math.min(1.8, Math.abs(st.spinVel) * 0.28)
      const dynamicPitch = baseHelixPitch * (1 + speedMag * 0.18)
      spiralGroup.rotation.z = -0.065 + st.smoothPX * 0.045 - Math.max(-0.08, Math.min(0.08, st.spinVel * 0.015))
      spiralGroup.rotation.x = 0.05 - st.smoothPY * 0.06

      // 3D Raycast hover on curved cylinder sheets
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

        // Second-order spring on hover pull-out (real tactile lift, zero robotic linear tween)
        const hTarget = hoveredIdx === i ? 1 : 0
        const hForce = (hTarget - entry.hoverVal) * 210
        entry.hoverVel += (hForce - entry.hoverVel * 18) * dt
        entry.hoverVal += entry.hoverVel * dt

        // Neighboring cards subtly yield away in angle when adjacent card is hovered
        let repelTarget = 0
        if (hoveredIdx >= 0 && hoveredIdx !== i) {
          const diffSlot = wrapSlot(i - hoveredIdx, total)
          if (Math.abs(diffSlot) <= 1.5) {
            repelTarget = Math.sign(diffSlot) * 0.055
          }
        }
        entry.repelVal += (repelTarget - entry.repelVal) * (1 - Math.exp(-9 * dt))

        const angle = u * angleStep + entry.repelVal
        const y = -u * dynamicPitch
        const centrifugalRadius = 1 + speedMag * 0.045 + entry.hoverVal * 0.14

        entry.pivot.position.set(0, y, 0)
        entry.pivot.rotation.y = angle
        // Subtle individual card pitch into cursor when hovered
        entry.pivot.rotation.x = entry.hoverVal * (-st.smoothPY * 0.08)
        entry.pivot.scale.set(centrifugalRadius, 1 + entry.hoverVal * 0.05, centrifugalRadius)

        const edgeFade = absU > 5.0 ? Math.max(0, 1 - (absU - 5.0) / 1.8) : 1
        const frontFactor = 0.5 + 0.5 * Math.cos(angle)
        const opacity = edgeFade * (0.48 + 0.52 * frontFactor)

        entry.mat.uniforms.uOpacity.value = opacity
        entry.mat.uniforms.uFrontFactor.value = frontFactor
        entry.mat.uniforms.uHover.value = Math.max(0, entry.hoverVal)
        entry.mat.uniforms.uVelocity.value = st.spinVel
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
          const next = self.progress * 11.2
          const delta = next - stateRef.current.lastScrollTarget
          stateRef.current.lastScrollTarget = next
          stateRef.current.scrollTarget = next
          // Inject gentle scroll-impulse torque into flywheel for real inertial feel
          stateRef.current.spinVel += delta * 2.4
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
          aria-label="Interactive 3D helical spiral gallery of MOCHI studio visuals and wallpapers"
        />
      </div>
    </section>
  )
}
