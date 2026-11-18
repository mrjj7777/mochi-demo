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
  aspect: number // width / height
}

/**
 * 16 100%-unique visuals (10 MOCHI campaigns + 6 downloadable MOCHI wallpapers).
 * Zero image overlap with Hero, Flavours, Texture, BlobjectShowcase, Lookbook, or Stand.
 */
const ARCHIVE_ITEMS: GalleryItem[] = [
  { id: 'a01', src: '/media/campaigns/pink-noise.webp', downloadSrc: '/media/campaigns/pink-noise.webp', alt: 'MOCHI Pink Noise cover', title: 'PINK NOISE', aspect: 0.8 },
  { id: 'a02', src: `/media/wallpapers/mochi-${flavours[0].asset}-${wallpaperFileSize}.png`, downloadSrc: `/media/wallpapers/mochi-${flavours[0].asset}-${wallpaperFileSize}.png`, alt: 'CHERRY MOCHI wallpaper', title: 'CHERRY', aspect: 0.56 },
  { id: 'a03', src: '/media/campaigns/gloss-gang.webp', downloadSrc: '/media/campaigns/gloss-gang.webp', alt: 'MOCHI Gloss Gang editorial', title: 'GLOSS GANG', aspect: 0.8 },
  { id: 'a04', src: '/media/campaigns/one-of-48.webp', downloadSrc: '/media/campaigns/one-of-48.webp', alt: 'MOCHI 1 of 48 poster', title: '1 OF 48', aspect: 0.8 },
  { id: 'a05', src: `/media/wallpapers/mochi-${flavours[1].asset}-${wallpaperFileSize}.png`, downloadSrc: `/media/wallpapers/mochi-${flavours[1].asset}-${wallpaperFileSize}.png`, alt: 'PEACH MOCHI wallpaper', title: 'PEACH', aspect: 0.56 },
  { id: 'a06', src: '/media/campaigns/pout-jaipur.webp', downloadSrc: '/media/campaigns/pout-jaipur.webp', alt: 'MOCHI Pout Jaipur campaign', title: 'POUT', aspect: 0.8 },
  { id: 'a07', src: '/media/campaigns/hold-this.webp', downloadSrc: '/media/campaigns/hold-this.webp', alt: 'MOCHI Hold This campaign', title: 'HOLD THIS', aspect: 0.8 },
  { id: 'a08', src: `/media/wallpapers/mochi-${flavours[2].asset}-${wallpaperFileSize}.png`, downloadSrc: `/media/wallpapers/mochi-${flavours[2].asset}-${wallpaperFileSize}.png`, alt: 'LYCHEE MOCHI wallpaper', title: 'LYCHEE', aspect: 0.56 },
  { id: 'a09', src: '/media/campaigns/squish-club.webp', downloadSrc: '/media/campaigns/squish-club.webp', alt: 'MOCHI Squish Club zine', title: 'SQUISH CLUB', aspect: 0.8 },
  { id: 'a10', src: '/media/campaigns/boys-pout.webp', downloadSrc: '/media/campaigns/boys-pout.webp', alt: 'MOCHI Boys Pout Too campaign', title: 'BOYS POUT TOO', aspect: 0.8 },
  { id: 'a11', src: `/media/wallpapers/mochi-${flavours[3].asset}-${wallpaperFileSize}.png`, downloadSrc: `/media/wallpapers/mochi-${flavours[3].asset}-${wallpaperFileSize}.png`, alt: 'GRAPE MOCHI wallpaper', title: 'GRAPE', aspect: 0.56 },
  { id: 'a12', src: '/media/campaigns/hand-squeeze.webp', downloadSrc: '/media/campaigns/hand-squeeze.webp', alt: 'MOCHI hand squeeze study', title: 'SQUEEZE', aspect: 0.8 },
  { id: 'a13', src: '/media/campaigns/one-pout-six.webp', downloadSrc: '/media/campaigns/one-pout-six.webp', alt: 'MOCHI One Pout Six Times poster', title: 'ONE POUT', aspect: 0.8 },
  { id: 'a14', src: `/media/wallpapers/mochi-${flavours[4].asset}-${wallpaperFileSize}.png`, downloadSrc: `/media/wallpapers/mochi-${flavours[4].asset}-${wallpaperFileSize}.png`, alt: 'MINT MOCHI wallpaper', title: 'MINT', aspect: 0.56 },
  { id: 'a15', src: '/media/campaigns/spin-cycle.webp', downloadSrc: '/media/campaigns/spin-cycle.webp', alt: 'MOCHI Spin Cycle campaign', title: 'SPIN CYCLE', aspect: 0.8 },
  { id: 'a16', src: `/media/wallpapers/mochi-${flavours[5].asset}-${wallpaperFileSize}.png`, downloadSrc: `/media/wallpapers/mochi-${flavours[5].asset}-${wallpaperFileSize}.png`, alt: 'MANGO MOCHI wallpaper', title: 'MANGO', aspect: 0.56 },
]

const ORB_VERTEX = `
  uniform float uTime;
  uniform float uPulse;
  uniform vec2 uPointer;
  varying vec3 vNormal;
  varying vec3 vViewPos;
  varying vec3 vWorldPos;

  void main() {
    vec3 p = position;
    // Organic Blobject liquid-silicone ripples driven by time, spin velocity, and mouse
    float w1 = sin(p.x * 2.4 + uTime * 1.1 + uPointer.x * 1.4) * cos(p.y * 2.2 - uTime * 0.85);
    float w2 = sin(p.z * 2.8 - uTime * 0.95 + uPointer.y * 1.3);
    float disp = (w1 * 0.065 + w2 * 0.045) * (1.0 + uPulse * 1.15);
    p += normal * disp;

    vec4 mvPos = modelViewMatrix * vec4(p, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vViewPos = -mvPos.xyz;
    vWorldPos = (modelMatrix * vec4(p, 1.0)).xyz;
    gl_Position = projectionMatrix * mvPos;
  }
`

const ORB_FRAGMENT = `
  uniform float uTime;
  uniform vec2 uPointer;
  varying vec3 vNormal;
  varying vec3 vViewPos;
  varying vec3 vWorldPos;

  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(vViewPos);
    float ndotv = clamp(abs(dot(N, V)), 0.0, 1.0);
    float fresnel = pow(1.0 - ndotv, 2.2);

    // Translucent couture MOCHI jelly-glass Blobject droplet with internal caustic sheen
    vec3 blushCore = vec3(0.95, 0.78, 0.82);
    vec3 cherryTint = vec3(0.84, 0.22, 0.38);
    vec3 skyIridescence = vec3(0.56, 0.80, 0.94);
    vec3 purePearl = vec3(1.0, 0.98, 0.96);

    float caustic = 0.5 + 0.5 * sin(vWorldPos.y * 3.1 - vWorldPos.x * 2.2 + uTime * 1.15);
    float band = pow(caustic, 2.0);
    vec3 interior = mix(blushCore, mix(cherryTint, skyIridescence, caustic), 0.34 + band * 0.28);

    // Crisp studio glass key & rim lights
    vec3 L1 = normalize(vec3(0.55 + uPointer.x * 0.9, 0.85 + uPointer.y * 0.7, 1.15));
    vec3 L2 = normalize(vec3(-0.9, -0.35, 0.85));
    vec3 H1 = normalize(L1 + V);
    vec3 H2 = normalize(L2 + V);
    float spec1 = pow(max(dot(N, H1), 0.0), 92.0);
    float spec2 = pow(max(dot(N, H2), 0.0), 34.0) * 0.42;

    vec3 col = mix(interior, purePearl, fresnel * 0.68) + purePearl * (spec1 * 1.15 + spec2 * 0.55);
    float alpha = clamp(0.46 + fresnel * 0.46 + spec1 * 0.5, 0.0, 0.96);
    gl_FragColor = vec4(col, alpha);
  }
`

function wrapSlot(value: number, total: number) {
  let v = ((value % total) + total) % total
  if (v > total / 2) v -= total
  return v
}

/** Creates a true physically curved cylindrical arc mesh facing radially outward. */
function createCurvedPosterGeometry(radius: number, height: number, aspect: number) {
  const arcWidth = height * aspect
  const thetaLength = arcWidth / radius
  const geom = new THREE.CylinderGeometry(
    radius,
    radius,
    height,
    26,
    1,
    true,
    -thetaLength / 2,
    thetaLength,
  )
  // Rotate so the center of the arc sits on +Z facing the camera cleanly
  geom.rotateY(0)
  return geom
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
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 60)
    camera.position.set(0, 0.15, 7.6)

    const spiralGroup = new THREE.Group()
    scene.add(spiralGroup)

    // Central Sculptural Glossy 3D Blobject Jelly-Glass Droplet
    const orbGeo = new THREE.IcosahedronGeometry(0.92, 52)
    const orbMat = new THREE.ShaderMaterial({
      vertexShader: ORB_VERTEX,
      fragmentShader: ORB_FRAGMENT,
      transparent: true,
      uniforms: {
        uTime: { value: 0 },
        uPulse: { value: 0 },
        uPointer: { value: new THREE.Vector2(0, 0) },
      },
    })
    const orbMesh = new THREE.Mesh(orbGeo, orbMat)
    scene.add(orbMesh)

    // 16 Physically Curved 3D Cylindrical Poster Meshes
    const loader = new THREE.TextureLoader()
    const maxAniso = renderer.capabilities.getMaxAnisotropy()
    const baseRadius = 3.25

    const cardEntries = ARCHIVE_ITEMS.map((item, idx) => {
      const texture = loader.load(item.src)
      texture.colorSpace = THREE.SRGBColorSpace
      texture.anisotropy = Math.min(8, maxAniso)
      texture.minFilter = THREE.LinearMipmapLinearFilter
      texture.magFilter = THREE.LinearFilter

      const cardH = item.aspect < 0.65 ? 2.15 : 1.92
      const geom = createCurvedPosterGeometry(baseRadius, cardH, item.aspect)

      const mat = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 1,
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

    const resize = () => {
      if (disposed) return
      const w = host.clientWidth || window.innerWidth
      const h = host.clientHeight || window.innerHeight
      renderer.setSize(w, h, false)
      camera.aspect = w / Math.max(1, h)
      const isNarrow = w < 720
      camera.position.z = isNarrow ? 9.6 : 7.35
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
        const delta = -dx / 150
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
    let elapsed = 0
    const total = cardEntries.length
    const angleStep = (Math.PI * 2) / 8.4 // ~8.4 curved posters per 360° helical turn
    const helixPitch = 0.58 // vertical helical rise per slot

    const tick = (now: number) => {
      rafId = 0
      if (disposed || !visible || document.visibilityState === 'hidden') return

      const dt = Math.min(0.04, Math.max(0.001, (now - lastNow) / 1000))
      lastNow = now
      elapsed += dt

      const st = stateRef.current

      // Continuous silky helical drift + real angular throw momentum + scroll coupling
      if (!st.dragging && !reduced) {
        const autoDrift = st.hovering ? 0.08 : 0.28
        st.dragOffset += (autoDrift + st.angularVel) * dt
        st.angularVel *= Math.exp(-3.6 * dt)
        if (Math.abs(st.angularVel) < 0.002) st.angularVel = 0
      }

      const desiredSpin = st.scrollOffset + st.dragOffset
      st.spinPos += (desiredSpin - st.spinPos) * (reduced ? 1 : 1 - Math.exp(-9.5 * dt))

      // Smooth 3D mouse camera orbit & tilt
      st.smoothPX += (st.pointerX - st.smoothPX) * (1 - Math.exp(-6.5 * dt))
      st.smoothPY += (st.pointerY - st.smoothPY) * (1 - Math.exp(-6.5 * dt))

      const baseCamZ = (host.clientWidth || window.innerWidth) < 720 ? 9.6 : 7.35
      camera.position.x = st.smoothPX * 1.15
      camera.position.y = 0.15 + st.smoothPY * 0.85
      camera.position.z = baseCamZ - Math.abs(st.smoothPX) * 0.25
      camera.lookAt(0, 0, 0)

      // Subtle architectural tilt on the whole spiral cylinder responding to pointer + spin velocity
      spiralGroup.rotation.z = -0.09 + st.smoothPX * 0.06
      spiralGroup.rotation.x = 0.08 - st.smoothPY * 0.08

      // Animate central glossy Blobject orb
      const spinSpeed = Math.min(1.6, Math.abs(st.angularVel) * 0.3 + Math.abs(desiredSpin - st.spinPos) * 0.45)
      orbMat.uniforms.uTime.value = elapsed
      orbMat.uniforms.uPulse.value = spinSpeed
      orbMat.uniforms.uPointer.value.set(st.smoothPX, st.smoothPY)
      orbMesh.rotation.y = elapsed * 0.28 + st.spinPos * 0.35
      orbMesh.rotation.x = Math.sin(elapsed * 0.45) * 0.18 + st.smoothPY * 0.35

      // 3D Raycast hover on curved cylinder posters
      raycaster.setFromCamera(pointerNdc, camera)
      const hits = raycaster.intersectObjects(
        cardEntries.map(c => c.mesh),
        false,
      )
      hoveredIdx = hits.length > 0 ? (hits[0].object.userData.index as number) : -1
      host.style.cursor = st.dragging ? 'grabbing' : hoveredIdx >= 0 ? 'pointer' : 'grab'

      // Position all 16 physically curved posters along the infinite 3D helical spiral
      for (let i = 0; i < total; i += 1) {
        const entry = cardEntries[i]
        const u = wrapSlot(i - st.spinPos, total)
        const absU = Math.abs(u)

        const targetHover = hoveredIdx === i ? 1 : 0
        entry.hover += (targetHover - entry.hover) * (1 - Math.exp(-10 * dt))

        const angle = u * angleStep
        const y = -u * helixPitch
        const radiusScale = 1 + entry.hover * 0.11

        entry.pivot.position.set(0, y, 0)
        entry.pivot.rotation.y = angle
        entry.pivot.scale.set(radiusScale, 1 + entry.hover * 0.05, radiusScale)

        // Seamless helical fade at far top/bottom ends + realistic 3D depth shading
        const edgeFade = absU > 5.8 ? Math.max(0, 1 - (absU - 5.8) / 1.8) : 1
        const frontFactor = 0.5 + 0.5 * Math.cos(angle) // 1 at front, 0 at back of cylinder
        const shade = 0.62 + 0.38 * frontFactor + entry.hover * 0.12
        entry.mat.color.setRGB(Math.min(1.08, shade), Math.min(1.08, shade), Math.min(1.08, shade))
        entry.mat.opacity = edgeFade * (0.48 + 0.52 * frontFactor)
        entry.mesh.visible = entry.mat.opacity > 0.03
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
      orbGeo.dispose()
      orbMat.dispose()
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
          stateRef.current.scrollOffset = self.progress * 10.5
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

        {/* ONE Unified Real 3D WebGL Curved Helical Spiral + Blobject Glass Orb */}
        <div
          ref={canvasHostRef}
          className="spiral-gallery__canvas-host"
          aria-label="Interactive 3D helical spiral gallery of MOCHI campaigns and wallpapers"
        />
      </div>
    </section>
  )
}
