import { useEffect, useRef } from 'react'
import { flavours, wallpaperFileSize, wallpaperSize } from '../brand'
import EditorialAction from './EditorialAction'

export type WallpaperProofProps = {
  index: number | null
  onClose: () => void
  onChange: (next: number) => void
}

export default function WallpaperProof({ index, onClose, onChange }: WallpaperProofProps) {
  const startXRef = useRef<number | null>(null)
  const closeWrapRef = useRef<HTMLDivElement>(null)
  const prevFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (index === null) return
    prevFocusRef.current = document.activeElement as HTMLElement | null
    const focusTimer = window.setTimeout(() => {
      closeWrapRef.current?.querySelector('button')?.focus()
    }, 20)

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        onChange((index + 1) % flavours.length)
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        onChange((index + flavours.length - 1) % flavours.length)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(focusTimer)
      window.removeEventListener('keydown', onKeyDown)
      prevFocusRef.current?.focus?.()
    }
  }, [index, onChange, onClose])

  if (index === null) return null
  const item = flavours[index] ?? flavours[0]
  const file = `/media/wallpapers/mochi-${item.asset}-${wallpaperFileSize}.png`

  return (
    <div
      className="wallpaper-proof"
      role="dialog"
      aria-modal="true"
      aria-label={`${item.name} wallpaper proof ${wallpaperSize}`}
      onClick={onClose}
      onPointerDown={event => {
        startXRef.current = event.clientX
      }}
      onPointerUp={event => {
        if (startXRef.current !== null) {
          const dx = event.clientX - startXRef.current
          if (Math.abs(dx) > 42) {
            onChange(dx < 0 ? (index + 1) % flavours.length : (index + flavours.length - 1) % flavours.length)
          }
        }
        startXRef.current = null
      }}
    >
      <div ref={closeWrapRef} className="wallpaper-proof__close" onClick={e => e.stopPropagation()}>
        <EditorialAction darkSurface onClick={onClose} ariaLabel="Close wallpaper proof">
          CLOSE
        </EditorialAction>
      </div>

      <button
        type="button"
        className="wallpaper-proof__arrow wallpaper-proof__arrow--prev"
        onClick={event => {
          event.stopPropagation()
          onChange((index + flavours.length - 1) % flavours.length)
        }}
        aria-label="Previous wallpaper"
      >
        ←
      </button>

      <div className="wallpaper-proof__sheet" onClick={e => e.stopPropagation()}>
        <span className="crop-mark crop-mark--light crop-mark--tl" aria-hidden="true" />
        <span className="crop-mark crop-mark--light crop-mark--tr" aria-hidden="true" />
        <span className="crop-mark crop-mark--light crop-mark--bl" aria-hidden="true" />
        <span className="crop-mark crop-mark--light crop-mark--br" aria-hidden="true" />
        <img
          src={file}
          width={1290}
          height={2796}
          alt={`${item.name} MOCHI wallpaper ${wallpaperSize}`}
          decoding="async"
        />
      </div>

      <button
        type="button"
        className="wallpaper-proof__arrow wallpaper-proof__arrow--next"
        onClick={event => {
          event.stopPropagation()
          onChange((index + 1) % flavours.length)
        }}
        aria-label="Next wallpaper"
      >
        →
      </button>

      <div className="wallpaper-proof__footer" onClick={e => e.stopPropagation()}>
        <span className="wallpaper-proof__label micro">
          {wallpaperSize} — {item.name} · {item.index} / 06
        </span>
        <EditorialAction as="a" darkSurface href={file} download>
          ↓ DOWNLOAD {wallpaperSize}
        </EditorialAction>
      </div>
    </div>
  )
}
