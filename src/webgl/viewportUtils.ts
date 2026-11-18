import { useEffect, useState, type RefObject } from 'react'
import type { DeviceTier } from '../types/mochi'

let cachedWebGLSupport: boolean | null = null

export function canUseWebGL(): boolean {
  if (cachedWebGLSupport !== null) return cachedWebGLSupport
  if (typeof document === 'undefined') {
    cachedWebGLSupport = false
    return false
  }
  try {
    const probe = document.createElement('canvas')
    const ctx =
      probe.getContext('webgl2', { failIfMajorPerformanceCaveat: false }) ||
      probe.getContext('webgl', { failIfMajorPerformanceCaveat: false })
    cachedWebGLSupport = Boolean(ctx)
  } catch {
    cachedWebGLSupport = false
  }
  return cachedWebGLSupport
}

export function isMobileViewport(): boolean {
  if (typeof window === 'undefined') return false
  return window.innerWidth <= 768 || window.matchMedia('(pointer: coarse)').matches
}

/** Cap DPR strictly at 1.5 (1.25 on mobile or low device tier). */
export function getCappedDpr(tier?: DeviceTier): number {
  if (typeof window === 'undefined') return 1
  const cap = tier === 'low' || isMobileViewport() ? 1.25 : 1.5
  return Math.min(window.devicePixelRatio || 1, cap)
}

/** Pauses rendering and physics whenever the host element is off-screen or the tab is hidden. */
export function useViewportActive(
  ref: RefObject<HTMLElement | null>,
  rootMargin = '140px',
): boolean {
  const [inView, setInView] = useState(true)
  const [docVisible, setDocVisible] = useState(() =>
    typeof document === 'undefined' ? true : !document.hidden,
  )

  useEffect(() => {
    const onVisibility = () => setDocVisible(!document.hidden)
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      entries => {
        const entry = entries[0]
        if (entry) setInView(entry.isIntersecting)
      },
      { rootMargin, threshold: 0.01 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref, rootMargin])

  return inView && docVisible
}
