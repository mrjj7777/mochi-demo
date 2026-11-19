import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { flavours, wallpaperFileSize } from '../brand'
import './BlobjectShowcase.css'

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
 * 14 100%-unique, balanced full-spectrum MOCHI visuals (editorial portraits,
 * studio studies, and all 6 downloadable phone wallpapers) in ONE unified
 * Three.js 3D Concave Curved Optical-Illusion Scroll & Mouse Gallery.
 */
const SLIDES: GalleryItem[] = [
  { id: 's01', src: '/media/photos/mochi-model-1.webp', downloadSrc: '/media/photos/mochi-model-1.webp', alt: 'MOCHI Cherry editorial portrait', title: 'CHERRY LOOK', aspect: 0.8 },
  { id: 's02', src: `/media/wallpapers/mochi-${flavours[0].asset}-${wallpaperFileSize}.png`, downloadSrc: `/media/wallpapers/mochi-${flavours[0].asset}-${wallpaperFileSize}.png`, alt: 'CHERRY MOCHI wallpaper', title: 'CHERRY', aspect: 0.56 },
  { id: 's03', src: '/media/photos/mochi-all-pile.webp', downloadSrc: '/media/photos/mochi-all-pile.webp', alt: 'All six MOCHI lip jelly shades', title: 'ALL SIX', aspect: 0.85 },
  { id: 's04', src: `/media/wallpapers/mochi-${flavours[1].asset}-${wallpaperFileSize}.png`, downloadSrc: `/media/wallpapers/mochi-${flavours[1].asset}-${wallpaperFileSize}.png`, alt: 'PEACH MOCHI wallpaper', title: 'PEACH', aspect: 0.56 },
  { id: 's05', src: '/media/photos/mochi-model-2.webp', downloadSrc: '/media/photos/mochi-model-2.webp', alt: 'MOCHI Mint editorial portrait', title: 'MINT LOOK', aspect: 0.8 },
  { id: 's06', src: `/media/wallpapers/mochi-${flavours[4].asset}-${wallpaperFileSize}.png`, downloadSrc: `/media/wallpapers/mochi-${flavours[4].asset}-${wallpaperFileSize}.png`, alt: 'MINT MOCHI wallpaper', title: 'MINT', aspect: 0.56 },
  { id: 's07', src: '/media/photos/mochi-model-3.webp', downloadSrc: '/media/photos/mochi-model-3.webp', alt: 'MOCHI Grape editorial portrait', title: 'GRAPE LOOK', aspect: 0.8 },
  { id: 's08', src: `/media/wallpapers/mochi-${flavours[3].asset}-${wallpaperFileSize}.png`, downloadSrc: `/media/wallpapers/mochi-${flavours[3].asset}-${wallpaperFileSize}.png`, alt: 'GRAPE MOCHI wallpaper', title: 'GRAPE', aspect: 0.56 },
  { id: 's09', src: '/media/photos/mochi-model-5.webp', downloadSrc: '/media/photos/mochi-model-5.webp', alt: 'MOCHI Mango editorial portrait', title: 'MANGO LOOK', aspect: 0.8 },
  { id: 's10', src: `/media/wallpapers/mochi-${flavours[5].asset}-${wallpaperFileSize}.png`, downloadSrc: `/media/wallpapers/mochi-${flavours[5].asset}-${wallpaperFileSize}.png`, alt: 'MANGO MOCHI wallpaper', title: 'MANGO', aspect: 0.56 },
  { id: 's11', src: '/media/photos/mochi-model-4.webp', downloadSrc: '/media/photos/mochi-model-4.webp', alt: 'MOCHI Lychee editorial portrait', title: 'LYCHEE LOOK', aspect: 0.8 },
  { id: 's12', src: `/media/wallpapers/mochi-${flavours[2].asset}-${wallpaperFileSize}.png`, downloadSrc: `/media/wallpapers/mochi-${flavours[2].asset}-${wallpaperFileSize}.png`, alt: 'LYCHEE MOCHI wallpaper', title: 'LYCHEE', aspect: 0.56 },
  { id: 's13', src: '/media/photos/mochi-all-row.webp', downloadSrc: '/media/photos/mochi-all-row.webp', alt: 'All six MOCHI shades in a row', title: 'LINEUP', aspect: 1.05 },
  { id: 's14', src: '/media/campaigns/gloss-gang.webp', downloadSrc: '/media/campaigns/gloss-gang.webp', alt: 'MOCHI Chimbai street editorial', title: 'CHIMBAI', aspect: 0.8 },
]

const VERTEX_SHADER = `
  uniform float uVelocity;
  uniform float uOffset;
  uniform float uCurve;
  uniform float uHover;
  varying vec2 vUv;
  varying float vDepthShade;

  void main() {
    vUv = uv;
    vec3 pos = position;

    // World horizontal position relative to screen center
    float worldX = pos.x + uOffset;
    float distSq = worldX * worldX;

    // True 3D concave optical barrel curve across the open screen
    pos.z -= distSq * uCurve;

    // Elastic shear & bow driven smoothly by live scroll/drag velocity
    float bend = sin(uv.y * 3.14159265) * uVelocity * 0.2;
    pos.x -= bend;
    pos.z += sin(uv.x * 3.14159265) * uHover * 0.16;

    // Optical concave lens pinch toward outer horizontal edges
    float edgePinch = 1.0 - min(0.22, distSq * 0.018);
    pos.y *= edgePinch;

    vDepthShade = clamp(1.0 - distSq * 0.036, 0.52, 1.0);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`

const FRAGMENT_SHADER = `
  uniform sampler2D uTexture;
  uniform float uAlpha;
  uniform float uHover;
  uniform vec2 uPointer;
  varying vec2 vUv;
  varying float vDepthShade;

  void main() {
    vec4 tex = texture2D(uTexture, vUv);
    vec3 col = tex.rgb * (0.89 + 0.11 * vDepthShade);

    // Subtle crisp specular sheen gliding with mouse pointer
    vec2 glossCenter = vec2(0.5 + uPointer.x * 0.35, 0.5 - uPointer.y * 0.35);
    float d = distance(vUv, glossCenter);
    float sheen = smoothstep(0.55, 0.0, d) * (0.04 + uHover * 0.11);
    col += vec3(1.0) * sheen;

    gl_FragColor = vec4(col, tex.a * uAlpha);
  }
`

export default function BlobjectShowcase({
  reduced,
  onOpenItem,
}: {
  reduced: boolean
  onOpenItem: (items: GalleryItem[], index: number) => void
}) {
  const sectionRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasHostRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const activeIndexRef = useRef(0)

  const physRef = useRef({
    pos: 0,
    target: 0,
    vel: 0,
    dragOffset: 0,
    scrollPos: 0,
    pointerX: 0,
    pointerY: 0,
    smoothPX: 0,
    smoothPY: 0,
    dragging: false,
    moved: false,
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
    const camera = new THREE.PerspectiveCamera(37, 1, 0.1, 50)
    camera.position.set(0, -0.04, 5.5)

    const loader = new THREE.TextureLoader()
    const maxAniso = renderer.capabilities.getMaxAnisotropy()

    const cardHeight = 2.34
    const spacing = 2.28

    const meshes = SLIDES.map((slide, idx) => {
      const texture = loader.load(slide.src)
      texture.colorSpace = THREE.SRGBColorSpace
      texture.anisotropy = Math.min(8, maxAniso)
      texture.minFilter = THREE.LinearMipmapLinearFilter
      texture.magFilter = THREE.LinearFilter

      const cardWidth = cardHeight * slide.aspect
      const geom = new THREE.PlaneGeometry(cardWidth, cardHeight, 34, 22)

      const material = new THREE.ShaderMaterial({
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        transparent: true,
        uniforms: {
          uTexture: { value: texture },
          uVelocity: { value: 0 },
          uOffset: { value: idx * spacing },
          uCurve: { value: 0.155 },
          uHover: { value: 0 },
          uAlpha: { value: 1 },
          uPointer: { value: new THREE.Vector2(0, 0) },
        },
      })

      const mesh = new THREE.Mesh(geom, material)
      mesh.userData = { index: idx }
      scene.add(mesh)
      return { mesh, geom, material, texture, hover: 0, hoverVel: 0, index: idx }
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
      camera.position.z = camera.aspect < 0.78 ? 6.6 : camera.aspect < 1.25 ? 5.95 : 5.45
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
      physRef.current.pointerX = nx
      physRef.current.pointerY = ny
      pointerNdc.set(nx, ny)

      if (physRef.current.dragging) {
        const dx = event.clientX - physRef.current.lastX
        physRef.current.lastX = event.clientX
        if (Math.abs(event.clientX - physRef.current.startX) > 6) {
          physRef.current.moved = true
        }
        const slideDelta = -dx / (rect.width * 0.24)
        physRef.current.dragOffset += slideDelta
        physRef.current.target = Math.max(
          -0.3,
          Math.min(SLIDES.length - 0.7, physRef.current.scrollPos + physRef.current.dragOffset),
        )
        physRef.current.vel = slideDelta * 24
      }
    }

    const onPointerDown = (event: PointerEvent) => {
      physRef.current.dragging = true
      physRef.current.moved = false
      physRef.current.startX = event.clientX
      physRef.current.lastX = event.clientX
    }

    const onPointerUp = () => {
      if (!physRef.current.dragging) return
      physRef.current.dragging = false
      const projected = physRef.current.pos + physRef.current.vel * 0.16
      const snapped = Math.max(0, Math.min(SLIDES.length - 1, Math.round(projected)))
      physRef.current.dragOffset = snapped - physRef.current.scrollPos
      physRef.current.target = snapped
    }

    const onPointerLeave = () => {
      physRef.current.pointerX = 0
      physRef.current.pointerY = 0
      pointerNdc.set(-10, -10)
      if (physRef.current.dragging) onPointerUp()
    }

    const onClick = () => {
      if (physRef.current.moved) return
      if (hoveredIdx >= 0 && hoveredIdx < SLIDES.length) {
        onOpenItem(SLIDES, hoveredIdx)
      }
    }

    stage.addEventListener('pointermove', onPointerMove, { passive: true })
    stage.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointerup', onPointerUp)
    stage.addEventListener('pointerleave', onPointerLeave)
    host.addEventListener('click', onClick)

    let lastNow = performance.now()

    const tick = (now: number) => {
      rafId = 0
      if (disposed || !visible || document.visibilityState === 'hidden') return

      const dt = Math.min(0.04, Math.max(0.001, (now - lastNow) / 1000))
      lastNow = now

      const st = physRef.current
      if (reduced) {
        st.pos = st.target
        st.vel = 0
      } else {
        const stiffness = st.dragging ? 250 : 115
        const damping = st.dragging ? 26 : 18.5
        const force = (st.target - st.pos) * stiffness
        st.vel += (force - st.vel * damping) * dt
        st.pos += st.vel * dt
      }

      st.smoothPX += (st.pointerX - st.smoothPX) * (1 - Math.exp(-6.5 * dt))
      st.smoothPY += (st.pointerY - st.smoothPY) * (1 - Math.exp(-6.5 * dt))

      camera.position.x = st.smoothPX * 0.45
      camera.position.y = -0.06 + st.smoothPY * 0.26
      camera.lookAt(0, -0.06, 0)

      const nearest = Math.max(0, Math.min(SLIDES.length - 1, Math.round(st.pos)))
      if (nearest !== activeIndexRef.current) {
        activeIndexRef.current = nearest
        setActiveIndex(nearest)
      }

      raycaster.setFromCamera(pointerNdc, camera)
      const hits = raycaster.intersectObjects(
        meshes.map(m => m.mesh),
        false,
      )
      hoveredIdx = hits.length > 0 ? (hits[0].object.userData.index as number) : -1
      host.style.cursor = st.dragging ? 'grabbing' : hoveredIdx >= 0 ? 'pointer' : 'grab'

      const clampedVel = Math.max(-2.6, Math.min(2.6, st.vel))

      for (let i = 0; i < meshes.length; i += 1) {
        const item = meshes[i]
        const rel = i - st.pos
        const absRel = Math.abs(rel)
        const worldX = rel * spacing

        // Second-order tactile hover spring
        const hTarget = hoveredIdx === i ? 1 : 0
        const hForce = (hTarget - item.hover) * 190
        item.hoverVel += (hForce - item.hoverVel * 17) * dt
        item.hover += item.hoverVel * dt

        item.mesh.position.x = worldX
        item.mesh.position.y = -0.06 + Math.sin(rel * 0.55) * 0.04 + item.hover * 0.08
        item.mesh.position.z = -absRel * 0.34 + item.hover * 0.24
        item.mesh.rotation.y = -rel * 0.35 + st.smoothPX * 0.08
        item.mesh.rotation.x = -st.smoothPY * 0.06
        const focusScale = 1 + Math.max(0, 1 - absRel) * 0.08 + item.hover * 0.035
        item.mesh.scale.setScalar(focusScale)

        const alpha = absRel > 3.2 ? 0 : Math.max(0, 1 - Math.max(0, absRel - 1.45) * 0.58)
        item.material.uniforms.uVelocity.value = clampedVel
        item.material.uniforms.uOffset.value = worldX
        item.material.uniforms.uHover.value = Math.max(0, item.hover)
        item.material.uniforms.uAlpha.value = alpha
        item.material.uniforms.uPointer.value.set(st.smoothPX, st.smoothPY)
        item.mesh.visible = alpha > 0.02
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
      stage.removeEventListener('pointerleave', onPointerLeave)
      host.removeEventListener('click', onClick)
      meshes.forEach(m => {
        m.geom.dispose()
        m.texture.dispose()
        m.material.dispose()
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
        end: () => `+=${Math.round(window.innerHeight * (isMobile ? 3.2 : 4.4))}`,
        pin: true,
        pinSpacing: true,
        anticipatePin: 1,
        scrub: true,
        invalidateOnRefresh: true,
        onUpdate: self => {
          const scrollSlide = self.progress * (SLIDES.length - 1)
          physRef.current.scrollPos = scrollSlide
          if (!physRef.current.dragging) {
            physRef.current.dragOffset *= 0.92
            physRef.current.target = Math.max(0, Math.min(SLIDES.length - 1, scrollSlide + physRef.current.dragOffset))
          }
        },
      })
      return () => trigger.kill()
    },
    { scope: sectionRef, dependencies: [reduced] },
  )

  const progress = SLIDES.length > 1 ? activeIndex / (SLIDES.length - 1) : 0

  return (
    <section id="wallpapers" ref={sectionRef} className="blobject section" data-aura="#2346B8,#F2EDE4">
      <div ref={stageRef} className="blobject__stage">
        <div className="blobject__header">
          <p className="display blobject__heading">
            take the colour <em>home.</em>
          </p>
        </div>

        <div
          ref={canvasHostRef}
          className="blobject__canvas-host"
          aria-label="Interactive 3D curved gallery of MOCHI editorial portraits and wallpapers"
        />

        <div className="blobject__progress" aria-hidden="true">
          <span className="blobject__count micro">
            {String(activeIndex + 1).padStart(2, '0')} / {String(SLIDES.length).padStart(2, '0')}
          </span>
          <span className="blobject__rail">
            <span className="blobject__rail-fill" style={{ transform: `scaleX(${Math.max(0.05, progress)})` }} />
          </span>
        </div>
      </div>
    </section>
  )
}
