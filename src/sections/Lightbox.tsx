import { useEffect, useRef } from 'react'
import type { Flavour } from '../types/mochi'
import EditorialAction from './EditorialAction'
import { useMediaMeta } from './media'

export type LightboxProps = {
  data: { src: string; flavour: Flavour; caption?: string } | null
  onClose: () => void
}

export default function Lightbox({ data, onClose }: LightboxProps) {
  const closeBtnRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const meta = useMediaMeta(data?.src ?? '')

  useEffect(() => {
    if (!data) return
    previousFocusRef.current = document.activeElement as HTMLElement | null
    const focusTimer = window.setTimeout(() => {
      closeBtnRef.current?.querySelector('button')?.focus()
    }, 20)

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(focusTimer)
      window.removeEventListener('keydown', onKeyDown)
      previousFocusRef.current?.focus?.()
    }
  }, [data, onClose])

  if (!data) return null

  const label = data.caption ?? `${data.flavour.name} — ${data.flavour.mood.toUpperCase()}`

  return (
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`${data.flavour.name} lookbook portrait`}
      style={{ '--lightbox-aura': data.flavour.aura } as React.CSSProperties}
      onClick={onClose}
    >
      <div className="lightbox__bar" onClick={e => e.stopPropagation()}>
        <div ref={closeBtnRef}>
          <EditorialAction onClick={onClose} ariaLabel="Close lookbook preview">
            CLOSE
          </EditorialAction>
        </div>
        <span className="lightbox__caption micro">{label}</span>
      </div>

      <figure className="lightbox__figure" onClick={e => e.stopPropagation()}>
        <picture>
          {meta.avif && <source srcSet={meta.avif} type="image/avif" />}
          <img
            src={data.src}
            width={meta.width}
            height={meta.height}
            alt={`${data.flavour.name} lookbook portrait`}
            decoding="async"
          />
        </picture>
      </figure>
    </div>
  )
}
