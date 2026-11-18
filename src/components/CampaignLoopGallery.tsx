import { useEffect, useMemo, useRef, useState } from 'react'
import { flavours, wallpaperFileSize } from '../brand'
import './CampaignLoopGallery.css'

export type GalleryItem = {
  id: string
  src: string
  downloadSrc: string
  alt: string
  title: string
  kind: 'campaign' | 'wallpaper'
}

const CAMPAIGN_ITEMS: GalleryItem[] = [
  { id: 'c1', src: '/media/campaigns/pink-noise.webp', downloadSrc: '/media/campaigns/pink-noise.webp', alt: 'MOCHI Pink Noise magazine cover', title: 'PINK NOISE', kind: 'campaign' },
  { id: 'c2', src: '/media/campaigns/prism-shadow.webp', downloadSrc: '/media/campaigns/prism-shadow.webp', alt: 'MOCHI chromatic prism shadow', title: 'PRISM', kind: 'campaign' },
  { id: 'c3', src: '/media/campaigns/gloss-gang.webp', downloadSrc: '/media/campaigns/gloss-gang.webp', alt: 'MOCHI Gloss Gang editorial', title: 'GLOSS GANG', kind: 'campaign' },
  { id: 'c4', src: '/media/campaigns/squish-claw.webp', downloadSrc: '/media/campaigns/squish-claw.webp', alt: 'MOCHI silicone squish study', title: 'SQUISH', kind: 'campaign' },
  { id: 'c5', src: '/media/campaigns/one-of-48.webp', downloadSrc: '/media/campaigns/one-of-48.webp', alt: 'MOCHI 1 of 48 campaign poster', title: '1 OF 48', kind: 'campaign' },
  { id: 'c6', src: '/media/campaigns/pout-jaipur.webp', downloadSrc: '/media/campaigns/pout-jaipur.webp', alt: 'MOCHI Pout Jaipur campaign', title: 'POUT', kind: 'campaign' },
  { id: 'c7', src: '/media/campaigns/satin-gloss.webp', downloadSrc: '/media/campaigns/satin-gloss.webp', alt: 'MOCHI satin gloss campaign', title: 'SATIN', kind: 'campaign' },
  { id: 'c8', src: '/media/campaigns/hold-this.webp', downloadSrc: '/media/campaigns/hold-this.webp', alt: 'MOCHI Hold This campaign', title: 'HOLD THIS', kind: 'campaign' },
  { id: 'c9', src: '/media/campaigns/squish-club.webp', downloadSrc: '/media/campaigns/squish-club.webp', alt: 'MOCHI Squish Club zine', title: 'SQUISH CLUB', kind: 'campaign' },
  { id: 'c10', src: '/media/campaigns/boys-pout.webp', downloadSrc: '/media/campaigns/boys-pout.webp', alt: 'MOCHI Boys Pout Too campaign', title: 'BOYS POUT TOO', kind: 'campaign' },
  { id: 'c11', src: '/media/campaigns/hand-squeeze.webp', downloadSrc: '/media/campaigns/hand-squeeze.webp', alt: 'MOCHI hand squeeze sequence', title: 'SQUEEZE', kind: 'campaign' },
  { id: 'c12', src: '/media/campaigns/one-pout-six.webp', downloadSrc: '/media/campaigns/one-pout-six.webp', alt: 'MOCHI One Pout Six Times poster', title: 'ONE POUT', kind: 'campaign' },
  { id: 'c13', src: '/media/campaigns/left-a-note.webp', downloadSrc: '/media/campaigns/left-a-note.webp', alt: 'MOCHI Left a Note campaign', title: 'LEFT A NOTE', kind: 'campaign' },
  { id: 'c14', src: '/media/campaigns/spin-cycle.webp', downloadSrc: '/media/campaigns/spin-cycle.webp', alt: 'MOCHI Spin Cycle campaign', title: 'SPIN CYCLE', kind: 'campaign' },
]

const WALLPAPER_ITEMS: GalleryItem[] = flavours.map(item => ({
  id: `wp-${item.key}`,
  src: `/media/wallpapers/mochi-${item.asset}-${wallpaperFileSize}.png`,
  downloadSrc: `/media/wallpapers/mochi-${item.asset}-${wallpaperFileSize}.png`,
  alt: `${item.name} MOCHI phone wallpaper`,
  title: item.name,
  kind: 'wallpaper',
}))

type LayoutMode = 'diagonal' | 'spiral'
type CollectionTab = 'campaigns' | 'wallpapers'

function wrapSlot(value: number, total: number) {
  let v = ((value % total) + total) % total
  if (v > total / 2) v -= total
  return v
}

export default function CampaignLoopGallery({
  reduced,
  onOpenItem,
}: {
  reduced: boolean
  onOpenItem: (items: GalleryItem[], index: number) => void
}) {
  const [layout, setLayout] = useState<LayoutMode>('diagonal')
  const [tab, setTab] = useState<CollectionTab>('campaigns')

  const items = useMemo(
    () => (tab === 'campaigns' ? CAMPAIGN_ITEMS : WALLPAPER_ITEMS),
    [tab],
  )

  const stageRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<Array<HTMLButtonElement | null>>([])
  const offsetRef = useRef(0)
  const velocityRef = useRef(0)
  const morphRef = useRef(0) // 0 = diagonal, 1 = spiral
  const targetMorphRef = useRef(0)
  const hoverRef = useRef(false)
  const dragRef = useRef({ active: false, startX: 0, lastX: 0, moved: false })

  useEffect(() => {
    targetMorphRef.current = layout === 'spiral' ? 1 : 0
  }, [layout])

  useEffect(() => {
    offsetRef.current = 0
    velocityRef.current = 0
  }, [tab])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return

    let disposed = false
    let rafId = 0
    let visible = true
    let lastNow = performance.now()

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry?.isIntersecting ?? true
        if (visible && !rafId) {
          lastNow = performance.now()
          rafId = requestAnimationFrame(tick)
        }
      },
      { threshold: 0 },
    )
    observer.observe(stage)

    const tick = (now: number) => {
      rafId = 0
      if (disposed || !visible || document.visibilityState === 'hidden') return

      const dt = Math.min(0.05, Math.max(0.001, (now - lastNow) / 1000))
      lastNow = now

      // Smooth morph between Diagonal Cascade (0) and 3D Spiral Flux (1)
      const morphTarget = targetMorphRef.current
      morphRef.current += (morphTarget - morphRef.current) * (1 - Math.exp(-6.5 * dt))
      const m = morphRef.current

      // Continuous infinite loop drift + viscous drag momentum
      if (!dragRef.current.active && !reduced) {
        const baseSpeed = hoverRef.current ? 0.08 : 0.34
        offsetRef.current += (baseSpeed + velocityRef.current) * dt
        velocityRef.current *= Math.exp(-4.2 * dt)
        if (Math.abs(velocityRef.current) < 0.005) velocityRef.current = 0
      }

      const total = items.length
      const width = stage.clientWidth || window.innerWidth
      const isMobile = width <= 700

      // Diagonal cascade geometry (Reference Image 1)
      const diagStepX = isMobile ? 168 : Math.min(285, width * 0.195)
      const diagStepY = isMobile ? 48 : 82

      // 3D Spiral Flux cylinder geometry (Reference Image 2)
      const spiralRadiusX = isMobile ? width * 0.44 : Math.min(470, width * 0.34)
      const spiralRadiusZ = isMobile ? 200 : 340
      const spiralPitchY = isMobile ? 36 : 46
      const ringDensity = Math.min(total, isMobile ? 7 : 9)

      for (let i = 0; i < total; i += 1) {
        const el = cardRefs.current[i]
        if (!el) continue

        const u = wrapSlot(i - offsetRef.current, total)
        const absU = Math.abs(u)

        // --- Geometry A: Diagonal Cascading 3D Perspective ---
        const dX = u * diagStepX
        const dY = u * diagStepY
        const dZ = -absU * 115 + Math.max(0, 1 - absU / 2.2) * 90
        const dRotZ = u * (isMobile ? 6.5 : 8.5)
        const dRotY = -u * (isMobile ? 11 : 14.5)
        const dScale = Math.max(0.58, 1.06 - absU * 0.085)
        const dOpacity = absU > (isMobile ? 2.8 : 4.2) ? 0 : Math.max(0, 1 - Math.max(0, absU - 2.3) * 0.55)

        // --- Geometry B: 3D Helical Spiral Cylinder ---
        const angle = (u / ringDensity) * Math.PI * 2
        const cosA = Math.cos(angle)
        const sinA = Math.sin(angle)
        const sX = sinA * spiralRadiusX
        const sZ = cosA * spiralRadiusZ - spiralRadiusZ * 0.35
        const sY = u * spiralPitchY
        const sRotY = (angle * 180) / Math.PI * 0.78
        const sRotZ = sinA * 4.5
        const sScale = 0.78 + ((cosA + 1) * 0.5) * 0.3
        const sOpacity = absU > ringDensity * 0.52 ? 0 : Math.max(0.08, 0.22 + ((cosA + 1) * 0.5) * 0.78)

        // Blend cleanly between Diagonal (m=0) and Spiral (m=1)
        const x = dX + (sX - dX) * m
        const y = dY + (sY - dY) * m
        const z = dZ + (sZ - dZ) * m
        const rotY = dRotY + (sRotY - dRotY) * m
        const rotZ = dRotZ + (sRotZ - dRotZ) * m
        const scale = dScale + (sScale - dScale) * m
        const opacity = dOpacity + (sOpacity - dOpacity) * m

        el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, ${z.toFixed(2)}px) rotateY(${rotY.toFixed(2)}deg) rotateZ(${rotZ.toFixed(2)}deg) scale(${scale.toFixed(4)})`
        el.style.opacity = opacity.toFixed(3)
        el.style.zIndex = String(Math.round(500 + z))
        el.style.pointerEvents = opacity > 0.28 ? 'auto' : 'none'
      }

      if (!reduced || Math.abs(morphTarget - morphRef.current) > 0.002) {
        rafId = requestAnimationFrame(tick)
      }
    }

    rafId = requestAnimationFrame(tick)

    return () => {
      disposed = true
      observer.disconnect()
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [items, reduced])

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = { active: true, startX: event.clientX, lastX: event.clientX, moved: false }
    velocityRef.current = 0
  }

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.active) return
    const dx = event.clientX - dragRef.current.lastX
    dragRef.current.lastX = event.clientX
    if (Math.abs(event.clientX - dragRef.current.startX) > 7) {
      dragRef.current.moved = true
    }
    const deltaSlots = -dx / 210
    offsetRef.current += deltaSlots
    velocityRef.current = deltaSlots * 26
  }

  const onPointerUp = () => {
    dragRef.current.active = false
  }

  return (
    <section id="wallpapers" className="campaign-loop section" data-aura="#2346B8,#F2EDE4">
      <div className="campaign-loop__header">
        <p className="display campaign-loop__title">
          take the colour <em>home.</em>
        </p>

        <div className="campaign-loop__controls">
          <div className="campaign-loop__group" role="tablist" aria-label="Gallery collection">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'campaigns'}
              className={tab === 'campaigns' ? 'is-active' : ''}
              onClick={() => setTab('campaigns')}
            >
              CAMPAIGNS
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'wallpapers'}
              className={tab === 'wallpapers' ? 'is-active' : ''}
              onClick={() => setTab('wallpapers')}
            >
              WALLPAPERS
            </button>
          </div>

          <span className="campaign-loop__sep" aria-hidden="true">
            /
          </span>

          <div className="campaign-loop__group" role="tablist" aria-label="3D gallery layout">
            <button
              type="button"
              role="tab"
              aria-selected={layout === 'diagonal'}
              className={layout === 'diagonal' ? 'is-active' : ''}
              onClick={() => setLayout('diagonal')}
            >
              DIAGONAL
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={layout === 'spiral'}
              className={layout === 'spiral' ? 'is-active' : ''}
              onClick={() => setLayout('spiral')}
            >
              SPIRAL
            </button>
          </div>
        </div>
      </div>

      <div
        ref={stageRef}
        className={`campaign-loop__stage ${tab === 'wallpapers' ? 'is-wallpapers' : ''}`}
        onPointerEnter={() => {
          hoverRef.current = true
        }}
        onPointerLeave={() => {
          hoverRef.current = false
          dragRef.current.active = false
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="campaign-loop__track">
          {items.map((item, idx) => (
            <button
              type="button"
              key={item.id}
              ref={el => {
                cardRefs.current[idx] = el
              }}
              className={`campaign-loop__card ${item.kind === 'wallpaper' ? 'campaign-loop__card--tall' : ''}`}
              onClick={() => {
                if (dragRef.current.moved) return
                onOpenItem(items, idx)
              }}
              aria-label={`Open ${item.title}`}
            >
              <img src={item.src} alt={item.alt} loading="lazy" decoding="async" draggable={false} />
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
