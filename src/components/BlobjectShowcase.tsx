import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import './BlobjectShowcase.css'

gsap.registerPlugin(ScrollTrigger, useGSAP)

type FormSlide = {
  num: string
  title: string
  wingTint: string
  archTint: string
  image: string
  alt: string
}

const SLIDES: FormSlide[] = [
  {
    num: '01',
    title: 'form.',
    wingTint: 'rgba(246, 211, 214, 0.54)',
    archTint: 'rgba(244, 198, 206, 0.42)',
    image: '/media/campaigns/blobject-form.webp',
    alt: 'MOCHI sculptural form study',
  },
  {
    num: '02',
    title: 'prism.',
    wingTint: 'rgba(143, 195, 230, 0.44)',
    archTint: 'rgba(246, 211, 214, 0.36)',
    image: '/media/campaigns/prism-shadow.webp',
    alt: 'MOCHI chromatic prism shadow',
  },
  {
    num: '03',
    title: 'press.',
    wingTint: 'rgba(244, 162, 126, 0.46)',
    archTint: 'rgba(242, 182, 50, 0.28)',
    image: '/media/campaigns/squish-claw.webp',
    alt: 'MOCHI tactile press study',
  },
  {
    num: '04',
    title: 'satin.',
    wingTint: 'rgba(218, 196, 238, 0.46)',
    archTint: 'rgba(246, 211, 214, 0.4)',
    image: '/media/campaigns/satin-gloss.webp',
    alt: 'MOCHI satin gloss study',
  },
  {
    num: '05',
    title: 'slab.',
    wingTint: 'rgba(143, 217, 182, 0.4)',
    archTint: 'rgba(143, 195, 230, 0.32)',
    image: '/media/campaigns/blobject-slab.webp',
    alt: 'MOCHI sculpted silicone pedestal',
  },
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

    // World horizontal position of this vertex relative to screen center
    float worldX = pos.x + uOffset;

    // True 3D concave optical barrel curve: edges bend forward/back into curved glass space
    float distSq = worldX * worldX;
    pos.z -= distSq * uCurve;

    // Physical elastic shear + convex bow driven by real horizontal scroll/drag velocity
    float bend = sin(uv.y * 3.14159265) * uVelocity * 0.24;
    pos.x -= bend;
    pos.z += sin(uv.x * 3.14159265) * uHover * 0.16;

    // Subtle concave optical vertical pinch toward outer wings (Reference Image 2 lens illusion)
    float edgePinch = 1.0 - min(0.24, distSq * 0.022);
    pos.y *= edgePinch;

    vDepthShade = clamp(1.0 - distSq * 0.048, 0.42, 1.0);

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
    // Subtle chromatic refraction at fast velocity / edge curvature
    vec4 tex = texture2D(uTexture, vUv);
    vec3 col = tex.rgb * (0.86 + 0.14 * vDepthShade);

    // Glossy optical glass specular reflection gliding with mouse pointer
    vec2 glossCenter = vec2(0.5 + uPointer.x * 0.35, 0.5 - uPointer.y * 0.35);
    float d = distance(vUv, glossCenter);
    float sheen = smoothstep(0.55, 0.0, d) * (0.06 + uHover * 0.12);
    col += vec3(1.0, 0.98, 0.96) * sheen;

    gl_FragColor = vec4(col, tex.a * uAlpha);
  }
`

export default function BlobjectShowcase({
  reduced,
  onOpen,
}: {
  reduced: boolean
  onOpen: (src: string, title: string) => void
}) {
  const sectionRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasHostRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<ScrollTrigger | null>(null)

  const [activeIndex, setActiveIndex] = useState(0)
  const activeIndexRef = useRef(0)

  // Real physical horizontal spring state shared between ScrollTrigger & Mouse Drag
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
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50)
    camera.position.set(0, 0, 5.4)

    const loader = new THREE.TextureLoader()
    const maxAniso = renderer.capabilities.getMaxAnisotropy()

    const cardWidth = 2.25
    const cardHeight = 2.82
    const spacing = 2.75
    const geometry = new THREE.PlaneGeometry(cardWidth, cardHeight, 36, 24)

    const meshes: Array<{
      mesh: THREE.Mesh
      material: THREE.ShaderMaterial
      hover: number
      index: number
    }> = SLIDES.map((slide, idx) => {
      const texture = loader.load(slide.image)
      texture.colorSpace = THREE.SRGBColorSpace
      texture.anisotropy = Math.min(8, maxAniso)
      texture.minFilter = THREE.LinearMipmapLinearFilter
      texture.magFilter = THREE.LinearFilter

      const material = new THREE.ShaderMaterial({
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        transparent: true,
        uniforms: {
          uTexture: { value: texture },
          uVelocity: { value: 0 },
          uOffset: { value: idx * spacing },
          uCurve: { value: 0.175 },
          uHover: { value: 0 },
          uAlpha: { value: 1 },
          uPointer: { value: new THREE.Vector2(0, 0) },
        },
      })

      const mesh = new THREE.Mesh(geometry, material)
      mesh.userData = { index: idx }
      scene.add(mesh)
      return { mesh, material, hover: 0, index: idx }
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
      camera.position.z = camera.aspect < 0.8 ? 7.1 : camera.aspect < 1.32 ? 6.15 : 5.25
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
        const slideDelta = -dx / (rect.width * 0.34)
        physRef.current.dragOffset += slideDelta
        physRef.current.target = Math.max(
          -0.25,
          Math.min(SLIDES.length - 0.75, physRef.current.scrollPos + physRef.current.dragOffset),
        )
        physRef.current.vel = slideDelta * 22
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
      // Magnetic snap to nearest slide after drag flick
      const projected = physRef.current.pos + physRef.current.vel * 0.14
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
        if (hoveredIdx === activeIndexRef.current) {
          onOpen(SLIDES[hoveredIdx].image, SLIDES[hoveredIdx].title)
        } else {
          physRef.current.dragOffset = hoveredIdx - physRef.current.scrollPos
          physRef.current.target = hoveredIdx
        }
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
        // Critically-damped heavy physical slide spring
        const stiffness = st.dragging ? 260 : 120
        const damping = st.dragging ? 28 : 19
        const force = (st.target - st.pos) * stiffness
        const accel = force - st.vel * damping
        st.vel += accel * dt
        st.pos += st.vel * dt
      }

      // Smooth 3D mouse camera parallax
      st.smoothPX += (st.pointerX - st.smoothPX) * (1 - Math.exp(-7 * dt))
      st.smoothPY += (st.pointerY - st.smoothPY) * (1 - Math.exp(-7 * dt))

      camera.position.x = st.smoothPX * 0.42
      camera.position.y = st.smoothPY * 0.24
      camera.lookAt(0, 0, 0)

      // Mirror smooth mouse tilt onto CSS curved optical arches & side wings
      stage.style.setProperty('--bx', `${(50 + st.smoothPX * 26).toFixed(2)}%`)
      stage.style.setProperty('--by', `${(50 - st.smoothPY * 22).toFixed(2)}%`)
      stage.style.setProperty('--btilt-x', `${(st.smoothPX * 16).toFixed(2)}px`)
      stage.style.setProperty('--btilt-y', `${(-st.smoothPY * 12).toFixed(2)}px`)

      // Sync active slide index cleanly
      const nearest = Math.max(0, Math.min(SLIDES.length - 1, Math.round(st.pos)))
      if (nearest !== activeIndexRef.current) {
        activeIndexRef.current = nearest
        setActiveIndex(nearest)
      }

      // Raycast hover in 3D space
      raycaster.setFromCamera(pointerNdc, camera)
      const hits = raycaster.intersectObjects(meshes.map(m => m.mesh), false)
      hoveredIdx = hits.length > 0 ? (hits[0].object.userData.index as number) : -1
      host.style.cursor = st.dragging ? 'grabbing' : hoveredIdx >= 0 ? 'pointer' : 'grab'

      const clampedVel = Math.max(-2.6, Math.min(2.6, st.vel))

      for (let i = 0; i < meshes.length; i += 1) {
        const item = meshes[i]
        const rel = i - st.pos
        const worldX = rel * spacing

        const targetHover = hoveredIdx === i ? 1 : 0
        item.hover += (targetHover - item.hover) * (1 - Math.exp(-9 * dt))

        // Place each card along the concave optical-illusion horizontal arc
        item.mesh.position.x = worldX
        item.mesh.position.y = Math.sin(rel * 0.6) * 0.04 + item.hover * 0.06
        item.mesh.position.z = -Math.abs(rel) * 0.34 + item.hover * 0.22
        item.mesh.rotation.y = -rel * 0.36 + st.smoothPX * 0.08
        item.mesh.rotation.x = -st.smoothPY * 0.06
        const focusScale = 1 + Math.max(0, 1 - Math.abs(rel)) * 0.08 + item.hover * 0.03
        item.mesh.scale.setScalar(focusScale)

        item.material.uniforms.uVelocity.value = clampedVel
        item.material.uniforms.uOffset.value = worldX
        item.material.uniforms.uHover.value = item.hover
        item.material.uniforms.uAlpha.value = Math.max(0.18, 1 - Math.max(0, Math.abs(rel) - 0.85) * 0.55)
        item.material.uniforms.uPointer.value.set(st.smoothPX, st.smoothPY)
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
      geometry.dispose()
      meshes.forEach(m => {
        const tex = m.material.uniforms.uTexture.value as THREE.Texture
        tex?.dispose()
        m.material.dispose()
      })
      renderer.dispose()
    }
  }, [onOpen, reduced])

  useGSAP(
    () => {
      const section = sectionRef.current
      if (!section || reduced) return
      const isMobile = window.matchMedia('(max-width: 700px)').matches

      const trigger = ScrollTrigger.create({
        trigger: section,
        start: 'top top',
        end: () => `+=${Math.round(window.innerHeight * (isMobile ? 2.0 : 2.8))}`,
        pin: true,
        pinSpacing: true,
        anticipatePin: 1,
        scrub: true,
        invalidateOnRefresh: true,
        onUpdate: self => {
          const scrollSlide = self.progress * (SLIDES.length - 1)
          physRef.current.scrollPos = scrollSlide
          if (!physRef.current.dragging) {
            // Smoothly decay any previous manual drag offset back into natural scroll flow
            physRef.current.dragOffset *= 0.92
            physRef.current.target = Math.max(0, Math.min(SLIDES.length - 1, scrollSlide + physRef.current.dragOffset))
          }
        },
      })
      triggerRef.current = trigger
      return () => {
        triggerRef.current = null
        trigger.kill()
      }
    },
    { scope: sectionRef, dependencies: [reduced] },
  )

  const slide = SLIDES[activeIndex]

  const jumpToSlide = (idx: number) => {
    const clamped = Math.max(0, Math.min(SLIDES.length - 1, idx))
    physRef.current.dragOffset = 0
    physRef.current.target = clamped
    activeIndexRef.current = clamped
    setActiveIndex(clamped)
    const st = triggerRef.current
    if (st) {
      const targetY = st.start + (clamped / Math.max(1, SLIDES.length - 1)) * (st.end - st.start)
      window.scrollTo({ top: targetY, behavior: 'smooth' })
    }
  }

  return (
    <section
      id="blobject"
      ref={sectionRef}
      className="blobject section"
      data-aura="#F6D3D6,#8FC3E6"
      style={
        {
          '--wing-tint': slide.wingTint,
          '--arch-tint': slide.archTint,
        } as React.CSSProperties
      }
    >
      <div ref={stageRef} className="blobject__stage">
        {/* True 3D Concave Optical-Illusion WebGL Carousel Canvas */}
        <div ref={canvasHostRef} className="blobject__canvas-host" aria-label="3D curved form gallery" />

        {/* Sculpted Concave Optical Lens Top & Bottom Arches (Reference Image 2 Illusion) */}
        <div className="blobject__arch blobject__arch--top" aria-hidden="true" />
        <div className="blobject__arch blobject__arch--bottom" aria-hidden="true" />

        {/* Left & Right Curved Optical Wings Flanking the 3D Stage */}
        <button
          type="button"
          className="blobject__wing blobject__wing--left"
          onClick={() => jumpToSlide((activeIndex + SLIDES.length - 1) % SLIDES.length)}
          aria-label="Previous study"
        >
          <span className="blobject__sheen" aria-hidden="true" />
          <span key={`num-${slide.num}`} className="blobject__number">
            {slide.num}
          </span>
        </button>

        <button
          type="button"
          className="blobject__wing blobject__wing--right"
          onClick={() => jumpToSlide((activeIndex + 1) % SLIDES.length)}
          aria-label="Next study"
        >
          <span className="blobject__sheen" aria-hidden="true" />
          <span key={`title-${slide.num}`} className="blobject__title">
            <em>{slide.title}</em>
          </span>
        </button>

        {/* Minimal Chapter Indicator */}
        <div className="blobject__nav" role="tablist" aria-label="Form studies">
          {SLIDES.map((item, idx) => (
            <button
              type="button"
              key={item.num}
              role="tab"
              aria-selected={idx === activeIndex}
              className={`blobject__tab ${idx === activeIndex ? 'is-active' : ''}`}
              onClick={() => jumpToSlide(idx)}
            >
              {item.num}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
