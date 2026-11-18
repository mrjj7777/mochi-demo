import { useEffect, useState } from 'react'

export type MediaManifestEntry = {
  width: number
  height: number
  blurDataUrl?: string
  webp?: string
  avif?: string
}

type ManifestPayload = {
  photos?: Record<string, MediaManifestEntry>
  byPath?: Record<string, MediaManifestEntry>
}

const FALLBACK_DIMENSIONS: Record<string, { width: number; height: number }> = {
  '/media/hero-seq/poster.webp': { width: 1600, height: 900 },
  '/media/photos/mochi-all-pile.webp': { width: 1600, height: 900 },
  '/media/photos/mochi-all-row.webp': { width: 1600, height: 900 },
  '/media/photos/mochi-hero-wide.webp': { width: 1600, height: 900 },
  '/media/photos/mochi-blob-stand.webp': { width: 1122, height: 1402 },
  '/media/photos/mochi-peach-model.webp': { width: 1122, height: 1402 },
  '/media/photos/mochi-model-1.webp': { width: 1122, height: 1402 },
  '/media/photos/mochi-model-2.webp': { width: 1122, height: 1402 },
  '/media/photos/mochi-model-3.webp': { width: 1122, height: 1402 },
  '/media/photos/mochi-model-4.webp': { width: 1122, height: 1402 },
  '/media/photos/mochi-model-5.webp': { width: 1122, height: 1402 },
  '/media/photos/mochi-diptych-cherry.webp': { width: 1122, height: 1402 },
  '/media/photos/mochi-diptych-lychee.webp': { width: 1122, height: 1402 },
  '/media/cutouts/mochi-stand.webp': { width: 1122, height: 1402 },
}

let manifestPromise: Promise<ManifestPayload | null> | null = null
let cachedManifest: ManifestPayload | null = null

export function loadMediaManifest(): Promise<ManifestPayload | null> {
  if (cachedManifest) return Promise.resolve(cachedManifest)
  if (typeof window === 'undefined') return Promise.resolve(null)
  if (!manifestPromise) {
    manifestPromise = fetch('/media/manifest.json')
      .then(res => (res.ok ? res.json() : null))
      .then((data: ManifestPayload | null) => {
        cachedManifest = data
        return data
      })
      .catch(() => null)
  }
  return manifestPromise
}

function resolveEntry(manifest: ManifestPayload | null, src: string): MediaManifestEntry {
  const filename = src.split('/').pop() || src
  const found = manifest?.byPath?.[src] ?? manifest?.photos?.[filename]
  if (found && found.width > 0 && found.height > 0) return found
  const fallback = FALLBACK_DIMENSIONS[src]
  if (fallback) return fallback
  if (src.includes('/wallpapers/')) return { width: 1290, height: 2796 }
  if (src.includes('/cutouts/')) return { width: 1122, height: 1402 }
  return { width: 1122, height: 1402 }
}

export function useMediaMeta(src: string): MediaManifestEntry {
  const [entry, setEntry] = useState<MediaManifestEntry>(() => resolveEntry(cachedManifest, src))

  useEffect(() => {
    setEntry(resolveEntry(cachedManifest, src))
    if (cachedManifest) return
    let active = true
    loadMediaManifest().then(data => {
      if (active && data) setEntry(resolveEntry(data, src))
    })
    return () => {
      active = false
    }
  }, [src])

  return entry
}
