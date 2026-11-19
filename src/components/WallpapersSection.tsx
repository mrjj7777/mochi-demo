import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { flavours } from '../brand'
import './WallpapersSection.css'

type WallpaperItem = {
  key: string
  name: string
  src: string
  thumbSrc: string
  label: string
  alt: string
}

const WALLPAPERS: WallpaperItem[] = flavours.map(item => ({
  key: item.key,
  name: item.name,
  src: `/media/wallpapers/mochi-${item.asset}-1290x2796.png`,
  thumbSrc: `/media/wallpapers/thumbs/mochi-${item.asset}-540.webp`,
  label: `1290 × 2796 — ${item.name}`,
  alt: `MOCHI ${item.name.toLowerCase()} phone wallpaper (1290 × 2796)`,
}))

function WallpaperProofModal({
  index,
  onClose,
  onChange,
}: {
  index: number | null
  onClose: () => void
  onChange: (nextIndex: number) => void
}) {
  const startX = useRef<number | null>(null)
  const total = WALLPAPERS.length

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
  const item = WALLPAPERS[index]
  if (!item) return null

  return createPortal(
    <div
      className="wp-proof"
      role="dialog"
      aria-modal="true"
      aria-label={item.label}
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
      <div className="wp-proof__bar" onClick={e => e.stopPropagation()}>
        <span className="wp-proof__label">{item.label}</span>
        <button type="button" className="wp-proof__close" onClick={onClose}>
          CLOSE
        </button>
      </div>

      <button
        type="button"
        className="wp-proof__arrow wp-proof__arrow--prev"
        aria-label="Previous wallpaper"
        onClick={e => {
          e.stopPropagation()
          onChange((index - 1 + total) % total)
        }}
      >
        ←
      </button>

      <div className="wp-proof__stage" onClick={e => e.stopPropagation()}>
        <div className="wp-proof__frame">
          <img src={item.src} alt={item.alt} width={1290} height={2796} decoding="async" className="wp-proof__img" />
        </div>
        <a
          className="wp-proof__download"
          href={item.src}
          download={`mochi-${item.key}-1290x2796.png`}
          onClick={e => e.stopPropagation()}
        >
          ↓ DOWNLOAD 1290 × 2796
        </a>
      </div>

      <button
        type="button"
        className="wp-proof__arrow wp-proof__arrow--next"
        aria-label="Next wallpaper"
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

export default function WallpapersSection() {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)

  return (
    <section
      id="wallpapers"
      className="wp-section section"
      data-aura="#F2EDE4,#E46A8E"
      aria-label="MOCHI phone wallpapers — take the colour home."
    >
      <div className="wp-section__head">
        <h2 className="wp-section__title">
          take the colour <em>home.</em>
        </h2>
      </div>

      <div className="wp-grid">
        {WALLPAPERS.map((item, idx) => (
          <article key={item.key} className="wp-item">
            <button
              type="button"
              className="wp-item__frame"
              onClick={() => setPreviewIndex(idx)}
              aria-label={`Preview ${item.label}`}
            >
              <img
                src={item.thumbSrc}
                alt={item.alt}
                width={540}
                height={1170}
                loading="lazy"
                decoding="async"
                className="wp-item__img"
              />
            </button>
            <div className="wp-item__meta">
              <span className="wp-item__label">{item.label}</span>
              <a
                className="wp-item__download"
                href={item.src}
                download={`mochi-${item.key}-1290x2796.png`}
              >
                ↓ DOWNLOAD 1290 × 2796
              </a>
            </div>
          </article>
        ))}
      </div>

      <WallpaperProofModal
        index={previewIndex}
        onClose={() => setPreviewIndex(null)}
        onChange={next => setPreviewIndex(next)}
      />
    </section>
  )
}
