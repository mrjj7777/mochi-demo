import { useEffect, useState, type RefObject } from 'react'
import * as THREE from 'three'
import type { DeviceTier } from '../types/mochi'

let cachedWebGLSupport: boolean | null = null
let cachedSoftShadowTexture: THREE.DataTexture | null = null

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

/**
 * Radial feathered contact shadow texture generated directly as a DataTexture
 * with flipY=false and premultiplyAlpha=false to prevent any WebGL unpack warnings.
 */
export function getSoftShadowTexture(): THREE.DataTexture {
  if (cachedSoftShadowTexture) return cachedSoftShadowTexture
  const size = 128
  const data = new Uint8Array(size * size * 4)
  const invHalf = 2 / (size - 1)
  const edgeCutoff = Math.exp(-4.4)

  for (let y = 0; y < size; y += 1) {
    const ny = y * invHalf - 1
    for (let x = 0; x < size; x += 1) {
      const nx = x * invHalf - 1
      const r2 = nx * nx + ny * ny
      const raw = r2 >= 1 ? 0 : Math.max(0, (Math.exp(-4.4 * r2) - edgeCutoff) / (1 - edgeCutoff))
      const alpha = Math.round(Math.pow(raw, 1.35) * 255)
      const idx = (y * size + x) * 4
      data[idx] = 255
      data[idx + 1] = 255
      data[idx + 2] = 255
      data[idx + 3] = alpha
    }
  }

  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType)
  tex.flipY = false
  tex.premultiplyAlpha = false
  tex.unpackAlignment = 4
  tex.colorSpace = THREE.NoColorSpace
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearFilter
  tex.generateMipmaps = false
  tex.needsUpdate = true
  cachedSoftShadowTexture = tex
  return tex
}

/** Tints a warm charcoal shadow base with the local aura colour so shadows are never flat grey. */
export function auraShadowColor(auraHex: string, mixAura = 0.44): THREE.Color {
  const base = new THREE.Color('#2E2226')
  const aura = new THREE.Color(auraHex)
  return base.lerp(aura, mixAura)
}

/** Warm cream background colour subtly tinted by local aura for transmission sampling. */
export function auraTransmissionBg(auraHex = '#F2EDE4', mixAura = 0.16): THREE.Color {
  const cream = new THREE.Color('#F2EDE4')
  const aura = new THREE.Color(auraHex)
  return cream.lerp(aura, mixAura)
}
