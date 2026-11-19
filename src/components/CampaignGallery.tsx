import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import * as THREE from 'three'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { PointerHistory, clamp, createSpring, projectMomentum, rubberBand } from '../physics'
import './CampaignGallery.css'

gsap.registerPlugin(ScrollTrigger)

export type CampaignImage = {
  n: number
  id: string
  src: string
  src720: string
  w: number
  h: number
  title: string
  alt: string
  source?: string
}

/** Exact synchronous mirror of public/media/campaign/campaign.json (hydrated from JSON on mount). */
const FALLBACK_CAMPAIGN_IMAGES: CampaignImage[] = [
  { n: 1, id: 'mochi-campaign-01', src: '/media/campaign/mochi-campaign-01.webp', src720: '/media/campaign/mochi-campaign-01-720.webp', w: 1122, h: 1402, title: 'PINK NOISE', alt: 'MOCHI campaign — magazine cover, model with cherry jelly' },
  { n: 2, id: 'mochi-campaign-02', src: '/media/campaign/mochi-campaign-02.webp', src720: '/media/campaign/mochi-campaign-02-720.webp', w: 1122, h: 1402, title: 'MOCHI', alt: 'MOCHI campaign — cherry lip jelly tube, still life on pink' },
  { n: 3, id: 'mochi-campaign-03', src: '/media/campaign/mochi-campaign-03.webp', src720: '/media/campaign/mochi-campaign-03-720.webp', w: 1122, h: 1402, title: 'SHARE?', alt: 'MOCHI campaign — two friends sharing cherry lip jelly' },
  { n: 4, id: 'mochi-campaign-04', src: '/media/campaign/mochi-campaign-04.webp', src720: '/media/campaign/mochi-campaign-04-720.webp', w: 1122, h: 1402, title: 'COLOUR SHADOW', alt: 'MOCHI campaign — tube with chromatic rainbow shadow' },
  { n: 5, id: 'mochi-campaign-05', src: '/media/campaign/mochi-campaign-05.webp', src720: '/media/campaign/mochi-campaign-05-720.webp', w: 1122, h: 1402, title: 'POUT', alt: 'MOCHI campaign — model applying cherry lip jelly, Jaipur pink wall' },
  { n: 6, id: 'mochi-campaign-06', src: '/media/campaign/mochi-campaign-06.webp', src720: '/media/campaign/mochi-campaign-06-720.webp', w: 1122, h: 1402, title: 'SQUISH.', alt: 'MOCHI campaign — jelly squeezed from tube into a bowl' },
  { n: 7, id: 'mochi-campaign-07', src: '/media/campaign/mochi-campaign-07.webp', src720: '/media/campaign/mochi-campaign-07-720.webp', w: 1122, h: 1402, title: 'UNBOTHERED', alt: 'MOCHI campaign — man holding the tube, close portrait' },
  { n: 8, id: 'mochi-campaign-08', src: '/media/campaign/mochi-campaign-08.webp', src720: '/media/campaign/mochi-campaign-08-720.webp', w: 1122, h: 1402, title: 'ANATOMY', alt: 'MOCHI campaign — exploded view: cap, jelly, tube' },
  { n: 9, id: 'mochi-campaign-09', src: '/media/campaign/mochi-campaign-09.webp', src720: '/media/campaign/mochi-campaign-09-720.webp', w: 1122, h: 1402, title: 'CAUGHT GLOSSY', alt: 'MOCHI campaign — woman by a taxi, glossy lips' },
  { n: 10, id: 'mochi-campaign-10', src: '/media/campaign/mochi-campaign-10.webp', src720: '/media/campaign/mochi-campaign-10-720.webp', w: 1122, h: 1402, title: 'A LITTLE GLOSS', alt: 'MOCHI campaign — tube on pink satin' },
  { n: 11, id: 'mochi-campaign-11', src: '/media/campaign/mochi-campaign-11.webp', src720: '/media/campaign/mochi-campaign-11-720.webp', w: 1122, h: 1402, title: 'BOYS POUT TOO', alt: 'MOCHI campaign — man applying lip jelly' },
  { n: 12, id: 'mochi-campaign-12', src: '/media/campaign/mochi-campaign-12.webp', src720: '/media/campaign/mochi-campaign-12-720.webp', w: 1122, h: 1402, title: 'SQUISH CLUB', alt: 'MOCHI campaign — zine collage with the tube' },
  { n: 13, id: 'mochi-campaign-13', src: '/media/campaign/mochi-campaign-13.webp', src720: '/media/campaign/mochi-campaign-13-720.webp', w: 1122, h: 1402, title: 'QUIETLY GLOSSY', alt: 'MOCHI campaign — woman at a vanity mirror' },
  { n: 14, id: 'mochi-campaign-14', src: '/media/campaign/mochi-campaign-14.webp', src720: '/media/campaign/mochi-campaign-14-720.webp', w: 1122, h: 1402, title: 'BALANCE', alt: 'MOCHI campaign — tube balanced on a plaster dome' },
  { n: 15, id: 'mochi-campaign-15', src: '/media/campaign/mochi-campaign-15.webp', src720: '/media/campaign/mochi-campaign-15-720.webp', w: 1122, h: 1402, title: 'SPIN CYCLE', alt: 'MOCHI campaign — model in a pink laundromat' },
  { n: 16, id: 'mochi-campaign-16', src: '/media/campaign/mochi-campaign-16.webp', src720: '/media/campaign/mochi-campaign-16-720.webp', w: 1122, h: 1402, title: '1 OF 48', alt: 'MOCHI campaign — grid of 48 tubes, one open' },
  { n: 17, id: 'mochi-campaign-17', src: '/media/campaign/mochi-campaign-17.webp', src720: '/media/campaign/mochi-campaign-17-720.webp', w: 1122, h: 1402, title: 'GLOSS GANG', alt: 'MOCHI campaign — three friends with lip jelly' },
  { n: 18, id: 'mochi-campaign-18', src: '/media/campaign/mochi-campaign-18.webp', src720: '/media/campaign/mochi-campaign-18-720.webp', w: 1122, h: 1402, title: 'FOUR HANDS', alt: 'MOCHI campaign — four-frame hand sequence' },
  { n: 19, id: 'mochi-campaign-19', src: '/media/campaign/mochi-campaign-19.webp', src720: '/media/campaign/mochi-campaign-19-720.webp', w: 1122, h: 1402, title: 'THIS ONE', alt: 'MOCHI campaign — contact sheet of a model' },
  { n: 20, id: 'mochi-campaign-20', src: '/media/campaign/mochi-campaign-20.webp', src720: '/media/campaign/mochi-campaign-20-720.webp', w: 1122, h: 1402, title: 'SPOT THE MOCHI', alt: 'MOCHI campaign — tube among mochi sweets' },
  { n: 21, id: 'mochi-campaign-21', src: '/media/campaign/mochi-campaign-21.webp', src720: '/media/campaign/mochi-campaign-21-720.webp', w: 1122, h: 1402, title: 'SQUISH KARO', alt: 'MOCHI campaign — street stall moment' },
  { n: 22, id: 'mochi-campaign-22', src: '/media/campaign/mochi-campaign-22.webp', src720: '/media/campaign/mochi-campaign-22-720.webp', w: 1122, h: 1402, title: 'THE BOX', alt: 'MOCHI campaign — tube with its pink box' },
  { n: 23, id: 'mochi-campaign-23', src: '/media/campaign/mochi-campaign-23.webp', src720: '/media/campaign/mochi-campaign-23-720.webp', w: 1122, h: 1402, title: 'HOLD THIS', alt: 'MOCHI campaign — friends with a hand mirror' },
  { n: 24, id: 'mochi-campaign-24', src: '/media/campaign/mochi-campaign-24.webp', src720: '/media/campaign/mochi-campaign-24-720.webp', w: 1122, h: 1402, title: 'LEFT A NOTE', alt: 'MOCHI campaign — tube by a bathroom mirror' },
  { n: 25, id: 'mochi-campaign-25', src: '/media/campaign/mochi-campaign-25.webp', src720: '/media/campaign/mochi-campaign-25-720.webp', w: 1122, h: 1402, title: 'LIFT POUT', alt: 'MOCHI campaign — lift selfie with lip jelly' },
  { n: 26, id: 'mochi-campaign-26', src: '/media/campaign/mochi-campaign-26.webp', src720: '/media/campaign/mochi-campaign-26-720.webp', w: 1122, h: 1402, title: 'POCKET-SIZED SOFT', alt: 'MOCHI campaign — tube on white modernist architecture' },
  { n: 27, id: 'mochi-campaign-27', src: '/media/campaign/mochi-campaign-27.webp', src720: '/media/campaign/mochi-campaign-27-720.webp', w: 1122, h: 1402, title: 'GLOSS', alt: 'MOCHI campaign — lip close-up with the tube' },
  { n: 28, id: 'mochi-campaign-28', src: '/media/campaign/mochi-campaign-28.webp', src720: '/media/campaign/mochi-campaign-28-720.webp', w: 1122, h: 1402, title: 'SQUISH.', alt: 'MOCHI campaign — tube with a cherry claw clip' },
  { n: 29, id: 'mochi-campaign-29', src: '/media/campaign/mochi-campaign-29.webp', src720: '/media/campaign/mochi-campaign-29-720.webp', w: 1122, h: 1402, title: 'ONE POUT, SIX TIMES', alt: 'MOCHI campaign — prism-filter portrait' },
]

function formatCaption(item: CampaignImage) {
  return `(${String(item.n).padStart(2, '0')}) ${item.title}`
}

/**
 * Vertex shader for the REEL FLUX concave panoramic cinema-lens illusion.
 * Projects a continuous edge-to-edge filmstrip onto the inside of a giant cylinder
 * curving TOWARD the camera so left/right edges naturally flare outward vertically
 * while the centre frame sits flat, upright, and crisp — preserving 100% original sRGB colours.
 */
const REEL_VERTEX = `
  uniform float uOffset;
  uniform float uRadius;
  uniform float uVelocity;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    float arcX = worldPos.x + uOffset;

    // Concave cylinder curvature: edges sweep forward toward camera for true wide-lens flare
    float angle = clamp(arcX / uRadius, -1.32, 1.32);
    float curvedX = sin(angle) * uRadius;
    float curvedZ = (1.0 - cos(angle)) * uRadius * 1.18;

    // Gentle optical breathing depth when moving rapidly (zero skew)
    float edgeFactor = abs(angle);
    float velDepth = clamp(abs(uVelocity) * 0.04, 0.0, 0.14) * edgeFactor;

    vec3 finalPos = vec3(curvedX, worldPos.y, worldPos.z + curvedZ - velDepth);
    gl_Position = projectionMatrix * viewMatrix * vec4(finalPos, 1.0);
  }
`

const REEL_FRAGMENT = `
  uniform sampler2D uMap;
  uniform float uLoaded;
  varying vec2 vUv;

  void main() {
    if (uLoaded < 0.5) {
      gl_FragColor = vec4(0.92, 0.895, 0.855, 1.0);
      return;
    }
    // Pure untouched original sRGB pixels — zero filter, zero grading, zero tint
    vec4 tex = texture2D(uMap, vUv);
    gl_FragColor = vec4(tex.rgb, 1.0);
  }
`

function CampaignLightbox({
  items,
  index,
  onClose,
  onChange,
}: {
  items: CampaignImage[]
  index: number | null
  onClose: () => void
  onChange: (nextIndex: number) => void
}) {
  const startX = useRef<number | null>(null)
  const total = items.length

  useEffect(() => {
    if (index === null || !total) return
    const prevIdx = (index - 1 + total) % total
    const nextIdx = (index + 1) % total
    ;[items[prevIdx]?.src, items[nextIdx]?.src].forEach(src => {
      if (!src) return
      const img = new Image()
      img.decoding = 'async'
      img.src = src
    })
  }, [index, items, total])

  useEffect(() => {
    if (index === null) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowRight') onChange((index + 1) % total)
      if (event.key === 'ArrowLeft') onChange((index - 1 + total) % total)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [index, total, onClose, onChange])

  if (index === null) return null
  const item = items[index]
  if (!item) return null

  return createPortal(
    <div
      className="campaign-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={formatCaption(item)}
      onClick={onClose}
      onPointerDown={e => {
        startX.current = e.clientX
      }}
      onPointerUp={e => {
        if (startX.current !== null && Math.abs(e.clientX - startX.current) > 42) {
          e.stopPropagation()
          onChange(e.clientX < startX.current ? (index + 1) % total : (index - 1 + total) % total)
        }
        startX.current = null
      }}
    >
      <div className="campaign-lightbox__bar" onClick={e => e.stopPropagation()}>
        <span className="campaign-lightbox__counter">
          {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
        </span>
        <button type="button" className="campaign-lightbox__close" onClick={onClose}>
          CLOSE
        </button>
      </div>

      <button
        type="button"
        className="campaign-lightbox__arrow campaign-lightbox__arrow--prev"
        aria-label="Previous campaign image"
        onClick={e => {
          e.stopPropagation()
          onChange((index - 1 + total) % total)
        }}
      >
        ←
      </button>

      <figure className="campaign-lightbox__figure" onClick={e => e.stopPropagation()}>
        <img
          src={item.src}
          alt={item.alt}
          width={item.w}
          height={item.h}
          decoding="async"
          className="campaign-lightbox__img"
        />
        <figcaption className="campaign-lightbox__caption">{formatCaption(item)}</figcaption>
      </figure>

      <button
        type="button"
        className="campaign-lightbox__arrow campaign-lightbox__arrow--next"
        aria-label="Next campaign image"
        onClick={e => {
          e.stopPropagation()
          onChange((index + 1) % total)
        }}
      >
        →
      </button>
    </div>,
    document.body,
  )
}

export default function CampaignGallery({ reduced = false }: { reduced?: boolean }) {
  const [items, setItems] = useState<CampaignImage[]>(FALLBACK_CAMPAIGN_IMAGES)
  const [activeIndex, setActiveIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : false,
  )

  const sectionRef = useRef<HTMLElement>(null)
  const canvasHostRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<Array<HTMLElement | null>>([])

  useEffect(() => {
    let cancelled = false
    fetch('/media/campaign/campaign.json')
      .then(res => (res.ok ? res.json() : null))
      .then((data: { images?: CampaignImage[] } | null) => {
        if (!cancelled && data?.images?.length === 29) {
          setItems(data.images)
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const sync = () => setIsMobile(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  // Desktop (>= 768px): Three.js REEL FLUX concave panoramic cylinder illusion with all 29 campaign posters
  useEffect(() => {
    if (isMobile) return
    const section = sectionRef.current
    const host = canvasHostRef.current
    if (!section || !host) return

    let disposed = false
    let rafId = 0
    let activeInView = false
    let lastNow = performance.now()

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.NoToneMapping
    renderer.domElement.className = 'campaign-reel__canvas'
    renderer.domElement.setAttribute('aria-label', 'Interactive panoramic 3D curved gallery of 29 MOCHI campaign posters')
    host.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 40)
    camera.position.set(0, 0, 5.15)

    // True 4:5 cards packed closely with crisp narrow cream gutters (edge-to-edge REEL FLUX ribbon)
    const CARD_H = 2.48
    const CARD_W = CARD_H * 0.8 // exact 4:5 (1.984)
    const GAP = 0.085
    const STRIDE = CARD_W + GAP
    const RADIUS = 3.95
    const MAX_OFFSET = Math.max(0, (items.length - 1) * STRIDE)

    const geometry = new THREE.PlaneGeometry(CARD_W, CARD_H, 28, 4)
    const loader = new THREE.TextureLoader()
    const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy())

    const meshes: THREE.Mesh[] = []
    const materials: THREE.ShaderMaterial[] = []
    const textures: THREE.Texture[] = []

    items.forEach((item, idx) => {
      const mat = new THREE.ShaderMaterial({
        vertexShader: REEL_VERTEX,
        fragmentShader: REEL_FRAGMENT,
        uniforms: {
          uMap: { value: null },
          uLoaded: { value: 0 },
          uOffset: { value: 0 },
          uRadius: { value: RADIUS },
          uVelocity: { value: 0 },
        },
        side: THREE.FrontSide,
      })

      const mesh = new THREE.Mesh(geometry, mat)
      mesh.position.set(idx * STRIDE, 0, 0)
      mesh.frustumCulled = false
      mesh.userData = { index: idx }
      scene.add(mesh)
      meshes.push(mesh)
      materials.push(mat)

      // Load all 29 lightweight -720.webp posters immediately so scrubbing 01 -> 29 never shows blanks
      loader.load(item.src720, tex => {
        if (disposed) {
          tex.dispose()
          return
        }
        // Pass raw sRGB bytes untouched (NoColorSpace + NoToneMapping = 100% bit-exact original poster colours)
        tex.colorSpace = THREE.NoColorSpace
        tex.anisotropy = maxAniso
        tex.generateMipmaps = true
        tex.minFilter = THREE.LinearMipmapLinearFilter
        tex.magFilter = THREE.LinearFilter
        tex.needsUpdate = true
        textures.push(tex)
        mat.uniforms.uMap.value = tex
        mat.uniforms.uLoaded.value = 1
        wake()
      })
    })

    const resize = () => {
      const rect = host.getBoundingClientRect()
      const w = Math.max(1, rect.width)
      const h = Math.max(1, rect.height)
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      wake()
    }

    // Physics state: scroll + drag momentum + mouse 3D optical parallax
    let scrollOffset = 0
    let dragOffset = 0
    let isDragging = false
    let pointerCaptured = false
    let dragMoved = 0
    let dragStartX = 0
    let dragStartOffset = 0
    let pointerNormX = 0
    let pointerNormY = 0

    const pointerHistory = new PointerHistory(5)
    const offsetSpring = createSpring({ stiffness: 135, damping: 24, mass: 1 }, 0)
    const camXSpring = createSpring({ stiffness: 90, damping: 18, mass: 1 }, 0)
    const camYSpring = createSpring({ stiffness: 90, damping: 18, mass: 1 }, 0)
    const roomYawSpring = createSpring({ stiffness: 85, damping: 18, mass: 1 }, 0)
    const roomPitchSpring = createSpring({ stiffness: 85, damping: 18, mass: 1 }, 0)
    const raycaster = new THREE.Raycaster()
    const pointerNdc = new THREE.Vector2()

    const tick = (now: number) => {
      rafId = 0
      if (disposed || document.visibilityState === 'hidden') return

      const dt = Math.min(0.045, Math.max(0.001, (now - lastNow) / 1000))
      lastNow = now

      const combined = scrollOffset + dragOffset
      let bounded = combined
      if (isDragging) {
        if (combined < 0) bounded = rubberBand(combined, 1.1)
        else if (combined > MAX_OFFSET) bounded = MAX_OFFSET + rubberBand(combined - MAX_OFFSET, 1.1)
        offsetSpring.setTarget(bounded)
      } else {
        const clamped = clamp(combined, 0, MAX_OFFSET)
        dragOffset = clamped - scrollOffset
        offsetSpring.setTarget(clamped)
      }

      const currentOffset = reduced ? offsetSpring.target : offsetSpring.step(dt)
      const velocity = offsetSpring.velocity

      // True physical 3D room dolly camera:
      // Whichever side the cursor approaches recedes back into depth while the opposite side swings outward toward you.
      camXSpring.setTarget(reduced ? 0 : -pointerNormX * 1.95)
      camYSpring.setTarget(reduced ? 0 : pointerNormY * 0.78)
      roomYawSpring.setTarget(reduced ? 0 : Math.abs(pointerNormX) * 0.42)

      const cx = camXSpring.step(dt)
      const cy = camYSpring.step(dt)
      const pullZ = roomYawSpring.step(dt)

      camera.position.set(cx, cy, 5.15 - pullZ)
      camera.lookAt(0, 0, -1.65)
      scene.rotation.set(0, 0, 0)

      // Position meshes dynamically around x = 0 so frustum & raycasting stay exact across all 29 frames
      for (let i = 0; i < meshes.length; i += 1) {
        const arcX = i * STRIDE - currentOffset
        const visible = Math.abs(arcX) < RADIUS * 1.65
        meshes[i].visible = visible
        meshes[i].position.x = arcX
        if (visible) {
          materials[i].uniforms.uOffset.value = 0
          materials[i].uniforms.uVelocity.value = velocity
        }
      }

      renderer.render(scene, camera)

      const nextIdx = clamp(Math.round(currentOffset / STRIDE), 0, items.length - 1)
      const normProgress = MAX_OFFSET > 0 ? clamp(currentOffset / MAX_OFFSET, 0, 1) : 0
      setActiveIndex(prev => (prev === nextIdx ? prev : nextIdx))
      setProgress(prev => (Math.abs(prev - normProgress) < 0.0015 ? prev : normProgress))

      const moving =
        isDragging ||
        !offsetSpring.atRest(0.0008) ||
        !camXSpring.atRest(0.0005) ||
        !camYSpring.atRest(0.0005) ||
        !roomYawSpring.atRest(0.0005) ||
        !roomPitchSpring.atRest(0.0005)

      if (moving || activeInView) {
        rafId = requestAnimationFrame(tick)
      }
    }

    const wake = () => {
      if (disposed || document.visibilityState === 'hidden') return
      if (!rafId) {
        lastNow = performance.now()
        rafId = requestAnimationFrame(tick)
      }
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        activeInView = entry?.isIntersecting ?? false
        if (activeInView) wake()
      },
      { threshold: 0 },
    )
    observer.observe(section)

    const dom = renderer.domElement
    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      isDragging = true
      pointerCaptured = false
      dragMoved = 0
      dragStartX = e.clientX
      dragStartOffset = dragOffset
      pointerHistory.reset()
      pointerHistory.add(e.clientX, e.clientY)
      wake()
    }

    const onPointerMove = (e: PointerEvent) => {
      const rect = dom.getBoundingClientRect()
      pointerNormX = clamp(((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1, -1, 1)
      pointerNormY = clamp(((e.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1, -1, 1)

      if (isDragging) {
        const dx = e.clientX - dragStartX
        dragMoved = Math.max(dragMoved, Math.abs(dx))
        if (dragMoved > 6 && !pointerCaptured) {
          pointerCaptured = true
          dom.setPointerCapture(e.pointerId)
          dom.classList.add('is-dragging')
        }
        pointerHistory.add(e.clientX, e.clientY)
        const worldPerPx = (STRIDE * 2.2) / Math.max(1, rect.width)
        dragOffset = dragStartOffset - dx * worldPerPx
      }
      wake()
    }

    const onPointerUp = (e: PointerEvent) => {
      if (!isDragging) return
      isDragging = false
      dom.classList.remove('is-dragging')
      if (pointerCaptured && dom.hasPointerCapture(e.pointerId)) {
        dom.releasePointerCapture(e.pointerId)
      }
      pointerCaptured = false

      if (dragMoved <= 6) {
        // Click -> determine closest poster under cursor or centred poster and open full-screen lightbox
        const rect = dom.getBoundingClientRect()
        pointerNdc.x = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1
        pointerNdc.y = -((e.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1
        raycaster.setFromCamera(pointerNdc, camera)

        // Approximate clicked slot cleanly along the concave arc
        const estWorldX = pointerNdc.x * 2.65
        const clickedIndex = clamp(Math.round((offsetSpring.value + estWorldX) / STRIDE), 0, items.length - 1)
        setLightboxIndex(clickedIndex)
      } else {
        const rect = dom.getBoundingClientRect()
        const worldPerPx = (STRIDE * 2.2) / Math.max(1, rect.width)
        const vxWorld = -pointerHistory.velocity().x * worldPerPx
        const projected = clamp(projectMomentum(offsetSpring.value, vxWorld), 0, MAX_OFFSET)
        dragOffset = projected - scrollOffset
        offsetSpring.setVelocity(vxWorld)
        offsetSpring.setTarget(projected)
        wake()
      }
      pointerHistory.reset()
    }

    const onPointerLeave = () => {
      pointerNormX = 0
      pointerNormY = 0
      wake()
    }

    dom.addEventListener('pointerdown', onPointerDown)
    dom.addEventListener('pointermove', onPointerMove)
    dom.addEventListener('pointerup', onPointerUp)
    dom.addEventListener('pointercancel', onPointerUp)
    dom.addEventListener('pointerleave', onPointerLeave)

    let trigger: ScrollTrigger | null = null
    if (!reduced) {
      trigger = ScrollTrigger.create({
        trigger: section,
        start: 'top top',
        end: () => `+=${Math.round(window.innerHeight * 5.2)}`,
        pin: true,
        pinSpacing: true,
        anticipatePin: 1,
        scrub: true,
        invalidateOnRefresh: true,
        onUpdate: self => {
          scrollOffset = self.progress * MAX_OFFSET
          dragOffset *= 0.88
          wake()
        },
      })
    }

    resize()
    window.addEventListener('resize', resize, { passive: true })

    return () => {
      disposed = true
      trigger?.kill()
      observer.disconnect()
      dom.removeEventListener('pointerdown', onPointerDown)
      dom.removeEventListener('pointermove', onPointerMove)
      dom.removeEventListener('pointerup', onPointerUp)
      dom.removeEventListener('pointercancel', onPointerUp)
      dom.removeEventListener('pointerleave', onPointerLeave)
      window.removeEventListener('resize', resize)
      if (rafId) cancelAnimationFrame(rafId)
      textures.forEach(t => t.dispose())
      materials.forEach(m => m.dispose())
      geometry.dispose()
      renderer.dispose()
      if (dom.parentNode === host) host.removeChild(dom)
    }
  }, [isMobile, items, reduced])

  // Mobile (< 768px): 60fps native scroll-snap strip with real-time 3D perspective carousel tilt & depth scale
  useEffect(() => {
    if (!isMobile) return
    const viewport = viewportRef.current
    if (!viewport) return

    let rafId = 0

    const updateCards = () => {
      rafId = 0
      const vw = Math.max(1, viewport.clientWidth)
      const maxScroll = Math.max(1, viewport.scrollWidth - vw)
      const ratio = clamp(viewport.scrollLeft / maxScroll, 0, 1)
      setProgress(prev => (Math.abs(prev - ratio) < 0.002 ? prev : ratio))

      const viewCenter = viewport.scrollLeft + vw * 0.5
      let closestIdx = 0
      let closestDist = Number.POSITIVE_INFINITY

      cardRefs.current.forEach((el, idx) => {
        if (!el) return
        const center = el.offsetLeft + el.offsetWidth * 0.5
        const delta = center - viewCenter
        const absDist = Math.abs(delta)
        if (absDist < closestDist) {
          closestDist = absDist
          closestIdx = idx
        }

        // Only animate cards near the viewport for locked 60fps mobile GPU efficiency
        if (absDist < vw * 1.45) {
          const norm = clamp(delta / (vw * 0.88), -1.15, 1.15)
          const absNorm = Math.abs(norm)
          const rotY = -norm * 14
          const scale = 1 - absNorm * 0.1
          const liftY = absNorm * 10
          const opacity = clamp(1 - absNorm * 0.34, 0.58, 1)
          el.style.transform = `perspective(920px) translate3d(0, ${liftY.toFixed(1)}px, 0) rotateY(${rotY.toFixed(2)}deg) scale(${scale.toFixed(4)})`
          el.style.opacity = opacity.toFixed(3)
        }
      })

      setActiveIndex(prev => (prev === closestIdx ? prev : closestIdx))
    }

    const onScroll = () => {
      if (!rafId) rafId = requestAnimationFrame(updateCards)
    }

    updateCards()
    viewport.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      viewport.removeEventListener('scroll', onScroll)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [isMobile, items.length])

  const openLightbox = useCallback((idx: number) => {
    setLightboxIndex(idx)
  }, [])

  const activeItem = items[activeIndex] ?? items[0]

  return (
    <section
      id="lookbook"
      ref={sectionRef}
      className="campaign-gallery section"
      data-aura="#F6D3D6,#E46A8E"
      aria-label="MOCHI campaign gallery — worn by everyone."
    >
      <div className="campaign-gallery__head">
        <h2 className="campaign-gallery__title">
          worn by <em>everyone.</em>
        </h2>
        <span className="campaign-gallery__spec">CAMPAIGN ARCHIVE — 29 FRAMES</span>
      </div>

      {/* Desktop: Edge-to-edge REEL FLUX concave panoramic optical-illusion strip */}
      {!isMobile && (
        <div ref={canvasHostRef} className="campaign-reel__host">
          {/* Accessible hidden list of all 29 original-colour posters for SEO/screen readers & quick keyboard open */}
          <div className="campaign-reel__sr" aria-hidden="false">
            {items.map((item, idx) => (
              <figure key={item.id} className="campaign-strip__item">
                <button
                  type="button"
                  className="campaign-strip__btn"
                  onClick={() => openLightbox(idx)}
                  aria-label={`View ${formatCaption(item)}`}
                >
                  <img
                    src={item.src720}
                    alt={item.alt}
                    width={item.w}
                    height={item.h}
                    loading={idx < 4 ? 'eager' : 'lazy'}
                    decoding="async"
                    className="campaign-strip__img"
                  />
                </button>
                <figcaption className="campaign-strip__caption">{formatCaption(item)}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      )}

      {/* Mobile (< 768px): Native horizontal scroll-snap strip, 84vw 4:5 cards */}
      {isMobile && (
        <div ref={viewportRef} className="campaign-gallery__viewport">
          <div className="campaign-gallery__track">
            {items.map((item, idx) => (
              <figure
                key={item.id}
                ref={el => {
                  cardRefs.current[idx] = el
                }}
                className="campaign-strip__item"
              >
                <button
                  type="button"
                  className="campaign-strip__btn"
                  onClick={() => openLightbox(idx)}
                  aria-label={`View ${formatCaption(item)}`}
                >
                  <img
                    src={item.src720}
                    alt={item.alt}
                    width={item.w}
                    height={item.h}
                    loading={idx < 4 ? 'eager' : 'lazy'}
                    decoding="async"
                    draggable={false}
                    className="campaign-strip__img"
                  />
                </button>
                <figcaption className="campaign-strip__caption">{formatCaption(item)}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      )}

      <div className="campaign-gallery__footer" aria-live="polite">
        <span className="campaign-gallery__active-caption">{activeItem ? formatCaption(activeItem) : ''}</span>
        <span className="campaign-gallery__counter">
          {String(activeIndex + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}
        </span>
        <div className="campaign-gallery__rail" aria-hidden="true">
          <span
            className="campaign-gallery__rail-fill"
            style={{ transform: `scaleX(${Math.max(1 / Math.max(1, items.length), progress)})` }}
          />
        </div>
        <button
          type="button"
          className="campaign-gallery__inspect"
          onClick={() => openLightbox(activeIndex)}
        >
          VIEW FULL ↗
        </button>
      </div>

      <CampaignLightbox
        items={items}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onChange={next => setLightboxIndex(next)}
      />
    </section>
  )
}
