import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { Flavour, SharedSectionProps } from '../types/mochi'
import { useMediaMeta } from './media'

const StandScene3D = lazy(() => import('../webgl/StandScene3D'))

const STAND_CUTOUT = '/media/cutouts/mochi-stand.webp'
const STAND_PHOTO = '/media/photos/mochi-blob-stand.webp'

export default function StandSection({ reduced, tier }: SharedSectionProps) {
  const sectionRef = useRef<HTMLElement>(null)
  const [inView, setInView] = useState(false)
  const [hoveredFlavour, setHoveredFlavour] = useState<Flavour | null>(null)
  const [fallbackSrc, setFallbackSrc] = useState(STAND_CUTOUT)
  const meta = useMediaMeta(fallbackSrc)

  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const io = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) {
          setInView(true)
          io.disconnect()
        }
      },
      { rootMargin: '220px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const use3D = inView && !reduced && tier !== 'low'
  const usingPhotoFallback = fallbackSrc === STAND_PHOTO

  const fallbackView = (
    <div className={`stand__fallback ${usingPhotoFallback ? 'stand__fallback--masked' : ''}`}>
      <img
        className="stand__image"
        src={fallbackSrc}
        width={meta.width}
        height={meta.height}
        alt="MOCHI milk-ceramic blob stand holding all six lip jelly shades"
        loading="lazy"
        decoding="async"
        onError={() => {
          if (fallbackSrc !== STAND_PHOTO) setFallbackSrc(STAND_PHOTO)
        }}
      />
    </div>
  )

  return (
    <section
      id="stand"
      ref={sectionRef}
      className="stand section"
      data-aura="#8FC3E6,#F2EDE4"
    >
      <div className="stand__layout mochi-grid">
        {/* Vertical mono running up left edge */}
        <p className="stand__vertical micro">A SOFT HOME FOR ALL SIX</p>

        {/* Display heading sitting deliberately clear behind/above the 3D stand */}
        <div className="stand__header">
          <h2 className="display stand__title">the stand.</h2>
          <p className="stand__hovered micro" aria-live="polite">
            {hoveredFlavour ? `${hoveredFlavour.name} — ${hoveredFlavour.mood}` : '\u00A0'}
          </p>
        </div>

        {/* 3D Stand Stage or Cutout Fallback */}
        <div className="stand__stage">
          {use3D ? (
            <Suspense fallback={fallbackView}>
              <StandScene3D
                active={inView}
                reducedMotion={reduced}
                tier={tier}
                onHoverFlavour={setHoveredFlavour}
              />
            </Suspense>
          ) : (
            fallbackView
          )}
        </div>
      </div>
    </section>
  )
}
