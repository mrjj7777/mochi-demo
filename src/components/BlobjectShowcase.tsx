import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import './BlobjectShowcase.css'

gsap.registerPlugin(ScrollTrigger, useGSAP)

type Chapter = {
  num: string
  title: string
  accent: string
  wingTint: string
  archTint: string
  image: string
  alt: string
}

const CHAPTERS: Chapter[] = [
  {
    num: '01',
    title: 'soft form.',
    accent: '#E46A8E',
    wingTint: 'rgba(246, 211, 214, 0.56)',
    archTint: 'rgba(244, 198, 206, 0.38)',
    image: '/media/campaigns/blobject-form.webp',
    alt: 'MOCHI sculptural silicone tube on blush slab',
  },
  {
    num: '02',
    title: 'prism light.',
    accent: '#2FA4A8',
    wingTint: 'rgba(143, 195, 230, 0.42)',
    archTint: 'rgba(246, 211, 214, 0.34)',
    image: '/media/campaigns/prism-shadow.webp',
    alt: 'MOCHI tube casting chromatic prism shadows',
  },
  {
    num: '03',
    title: 'silicone press.',
    accent: '#B3122E',
    wingTint: 'rgba(244, 162, 126, 0.44)',
    archTint: 'rgba(242, 182, 50, 0.24)',
    image: '/media/campaigns/squish-claw.webp',
    alt: 'MOCHI silicone tube pressed with glossy claw clip',
  },
  {
    num: '04',
    title: 'pure gloss.',
    accent: '#8E5BC4',
    wingTint: 'rgba(218, 196, 238, 0.44)',
    archTint: 'rgba(246, 211, 214, 0.38)',
    image: '/media/campaigns/satin-gloss.webp',
    alt: 'MOCHI lip jelly on silk satin surface',
  },
]

export default function BlobjectShowcase({
  reduced,
  onOpen,
}: {
  reduced: boolean
  onOpen: (src: string, title: string) => void
}) {
  const sectionRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<ScrollTrigger | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const lastIndexRef = useRef(0)

  // Smooth damped pointer sheen on the sculpted Blobject wings & arches
  useEffect(() => {
    const stage = stageRef.current
    if (!stage || reduced) return
    let tx = 50
    let ty = 45
    let cx = 50
    let cy = 45
    let raf = 0
    let running = false

    const tick = () => {
      raf = 0
      cx += (tx - cx) * 0.09
      cy += (ty - cy) * 0.09
      stage.style.setProperty('--bx', `${cx.toFixed(2)}%`)
      stage.style.setProperty('--by', `${cy.toFixed(2)}%`)
      stage.style.setProperty('--btilt-x', `${((cx - 50) * 0.14).toFixed(2)}px`)
      stage.style.setProperty('--btilt-y', `${((cy - 50) * 0.12).toFixed(2)}px`)
      if (Math.abs(tx - cx) > 0.08 || Math.abs(ty - cy) > 0.08) {
        raf = requestAnimationFrame(tick)
      } else {
        running = false
      }
    }

    const onMove = (event: PointerEvent) => {
      const rect = stage.getBoundingClientRect()
      if (rect.width < 1 || rect.height < 1) return
      tx = ((event.clientX - rect.left) / rect.width) * 100
      ty = ((event.clientY - rect.top) / rect.height) * 100
      if (!running) {
        running = true
        raf = requestAnimationFrame(tick)
      }
    }

    const onLeave = () => {
      tx = 50
      ty = 45
      if (!running) {
        running = true
        raf = requestAnimationFrame(tick)
      }
    }

    stage.addEventListener('pointermove', onMove, { passive: true })
    stage.addEventListener('pointerleave', onLeave)
    return () => {
      stage.removeEventListener('pointermove', onMove)
      stage.removeEventListener('pointerleave', onLeave)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [reduced])

  useGSAP(
    () => {
      const section = sectionRef.current
      if (!section || reduced) return
      const isMobile = window.matchMedia('(max-width: 700px)').matches
      if (isMobile) return

      const trigger = ScrollTrigger.create({
        trigger: section,
        start: 'top top',
        end: () => `+=${Math.round(window.innerHeight * 2.2)}`,
        pin: true,
        pinSpacing: true,
        anticipatePin: 1,
        scrub: true,
        invalidateOnRefresh: true,
        onUpdate: self => {
          const idx = Math.min(CHAPTERS.length - 1, Math.floor(self.progress * CHAPTERS.length * 0.999))
          if (idx !== lastIndexRef.current) {
            lastIndexRef.current = idx
            setActiveIndex(idx)
          }
          section.style.setProperty('--blobject-progress', self.progress.toFixed(4))
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

  const chapter = CHAPTERS[activeIndex]

  const jumpToChapter = (idx: number) => {
    lastIndexRef.current = idx
    setActiveIndex(idx)
    const st = triggerRef.current
    if (st) {
      const targetY = st.start + ((idx + 0.18) / CHAPTERS.length) * (st.end - st.start)
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
          '--wing-tint': chapter.wingTint,
          '--arch-tint': chapter.archTint,
          '--chapter-accent': chapter.accent,
        } as React.CSSProperties
      }
    >
      <div ref={stageRef} className="blobject__stage">
        {/* Top & Bottom Sculpted Organic Blobject Arches */}
        <div className="blobject__arch blobject__arch--top" aria-hidden="true" />
        <div className="blobject__arch blobject__arch--bottom" aria-hidden="true" />

        {/* 3-Column Blobject Architectural Aperture: [Number] | [Image] | [Title] */}
        <div className="blobject__aperture">
          {/* Left Sculpted Wing: Monumental Chapter Number */}
          <button
            type="button"
            className="blobject__wing blobject__wing--left"
            onClick={() => jumpToChapter((activeIndex + CHAPTERS.length - 1) % CHAPTERS.length)}
            aria-label="Previous form chapter"
          >
            <span className="blobject__sheen" aria-hidden="true" />
            <span key={`num-${chapter.num}`} className="blobject__number">
              {chapter.num}
            </span>
          </button>

          {/* Center Crisp Editorial Frame */}
          <button
            type="button"
            className="blobject__center"
            onClick={() => onOpen(chapter.image, chapter.title)}
            aria-label={`Inspect ${chapter.title}`}
          >
            {CHAPTERS.map((item, idx) => (
              <img
                key={item.image}
                src={item.image}
                alt={item.alt}
                loading="eager"
                decoding="async"
                className={`blobject__photo ${idx === activeIndex ? 'is-active' : ''}`}
              />
            ))}
          </button>

          {/* Right Sculpted Wing: Poetic Brand Pillar Title */}
          <button
            type="button"
            className="blobject__wing blobject__wing--right"
            onClick={() => jumpToChapter((activeIndex + 1) % CHAPTERS.length)}
            aria-label="Next form chapter"
          >
            <span className="blobject__sheen" aria-hidden="true" />
            <span key={`title-${chapter.num}`} className="blobject__title">
              <em>{chapter.title}</em>
            </span>
          </button>
        </div>

        {/* Minimal Chapter Indicator Bar */}
        <div className="blobject__nav" role="tablist" aria-label="Form studies">
          {CHAPTERS.map((item, idx) => (
            <button
              type="button"
              key={item.num}
              role="tab"
              aria-selected={idx === activeIndex}
              className={`blobject__tab ${idx === activeIndex ? 'is-active' : ''}`}
              onClick={() => jumpToChapter(idx)}
            >
              {item.num}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
