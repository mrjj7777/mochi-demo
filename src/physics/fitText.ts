import { useEffect, useLayoutEffect, useState } from 'react'
import type React from 'react'

export interface UseFitTextOptions {
  /** Maximum fraction of container/viewport width the text may occupy (default 0.90). */
  maxWidthRatio?: number
  /** Minimum computed font size in px (clamped >= 11px for legibility). */
  minPx?: number
  /** Maximum computed font size in px (default 240). */
  maxPx?: number
}

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect

/**
 * Measures an inline/heading element against its container and viewport width
 * using ResizeObserver and font-load callbacks so fitted typography never exceeds
 * `maxWidthRatio` (default 90%) of available width.
 */
export function useFitText(
  ref: React.RefObject<HTMLElement | null>,
  opts?: UseFitTextOptions,
): number {
  const maxWidthRatio = opts?.maxWidthRatio ?? 0.9
  const minPx = Math.max(11, opts?.minPx ?? 11)
  const maxPx = Math.max(minPx, opts?.maxPx ?? 240)
  const [fontSize, setFontSize] = useState<number>(minPx)

  useIsomorphicLayoutEffect(() => {
    const el = ref.current
    if (!el || typeof window === 'undefined') return

    let disposed = false

    const fit = () => {
      if (disposed || !ref.current) return
      const targetEl = ref.current
      const parent = targetEl.parentElement ?? document.documentElement
      const parentRect = parent.getBoundingClientRect()
      const parentStyle = window.getComputedStyle(parent)
      const padX =
        (Number.parseFloat(parentStyle.paddingLeft) || 0) +
        (Number.parseFloat(parentStyle.paddingRight) || 0)
      const containerWidth = Math.max(0, parentRect.width - padX)
      const viewportWidth = document.documentElement.clientWidth || window.innerWidth
      const availableWidth =
        containerWidth > 0 ? Math.min(containerWidth, viewportWidth) : viewportWidth
      const targetMaxWidth = Math.max(1, availableWidth * maxWidthRatio)

      const prevWhiteSpace = targetEl.style.whiteSpace
      const prevWidth = targetEl.style.width
      const prevMaxWidth = targetEl.style.maxWidth
      const prevDisplay = targetEl.style.display
      const prevFontSize = targetEl.style.fontSize

      const computedDisplay = window.getComputedStyle(targetEl).display
      if (computedDisplay === 'inline') {
        targetEl.style.display = 'inline-block'
      }
      targetEl.style.whiteSpace = 'nowrap'
      targetEl.style.width = 'max-content'
      targetEl.style.maxWidth = 'none'
      targetEl.style.fontSize = '100px'

      const widthAt100 = targetEl.getBoundingClientRect().width
      if (widthAt100 <= 0) {
        targetEl.style.whiteSpace = prevWhiteSpace
        targetEl.style.width = prevWidth
        targetEl.style.maxWidth = prevMaxWidth
        targetEl.style.display = prevDisplay
        targetEl.style.fontSize = prevFontSize
        return
      }

      let nextPx = Math.min(
        maxPx,
        Math.max(minPx, Math.floor(((targetMaxWidth / widthAt100) * 100) * 10) / 10),
      )

      targetEl.style.fontSize = `${nextPx}px`
      const actualWidth = targetEl.getBoundingClientRect().width
      if (actualWidth > targetMaxWidth && nextPx > minPx) {
        nextPx = Math.max(
          minPx,
          Math.floor((nextPx * (targetMaxWidth / actualWidth)) * 10) / 10,
        )
        targetEl.style.fontSize = `${nextPx}px`
      }

      targetEl.style.whiteSpace = prevWhiteSpace
      targetEl.style.width = prevWidth
      targetEl.style.maxWidth = prevMaxWidth
      targetEl.style.display = prevDisplay

      setFontSize(prev => (Math.abs(prev - nextPx) > 0.05 ? nextPx : prev))
    }

    fit()

    const observer =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => fit()) : null
    if (observer) {
      if (el.parentElement) observer.observe(el.parentElement)
      observer.observe(document.documentElement)
    }

    window.addEventListener('resize', fit, { passive: true })
    const fonts = document.fonts
    fonts?.ready.then(() => {
      if (!disposed) fit()
    })
    fonts?.addEventListener?.('loadingdone', fit)

    return () => {
      disposed = true
      observer?.disconnect()
      window.removeEventListener('resize', fit)
      fonts?.removeEventListener?.('loadingdone', fit)
    }
  }, [ref, maxWidthRatio, minPx, maxPx])

  return fontSize
}
