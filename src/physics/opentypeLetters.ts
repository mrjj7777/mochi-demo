import { parse, type Font, type Path, type RenderOptions } from 'opentype.js'

export type Vec2 = {
  x: number
  y: number
}

export type LetterContour = {
  /** Base vertices in shared word SVG coordinates (y-down). */
  points: Vec2[]
  /** Unit inward normals pointing into the solid letter ink for every vertex. */
  inwardNormals: Vec2[]
  /** Shoelace signed area in SVG space (>0 outer CW, <0 inner hole CCW). */
  signedArea: number
}

export type LetterBox = {
  x1: number
  y1: number
  x2: number
  y2: number
  width: number
  height: number
  cx: number
  cy: number
}

export type ExtractedLetter = {
  index: number
  char: string
  originX: number
  advanceWidth: number
  box: LetterBox
  contours: LetterContour[]
  basePath: string
  vertexCount: number
}

export type WordExtractOptions = {
  fontSize?: number
  letterSpacing?: number
  kerning?: boolean
  maxSegmentLength?: number
  paddingX?: number
  paddingTop?: number
  paddingBottom?: number
}

export type ExtractedWord = {
  text: string
  letters: ExtractedLetter[]
  totalWidth: number
  totalHeight: number
  inkWidth: number
  inkHeight: number
  ascender: number
  descender: number
  baselineY: number
  viewBox: string
  fontSize: number
}

const DEFAULT_KRONA_URL = '/fonts/krona-one-400-normal.ttf'

let cachedFont: Font | null = null
let fontPromise: Promise<Font> | null = null
const extractedWordCache = new Map<string, ExtractedWord>()

/** Returns the cached Krona One Font synchronously if already parsed. */
export function getCachedKronaFont(): Font | null {
  return cachedFont
}

/**
 * Fetches and parses `/fonts/krona-one-400-normal.ttf` once via a cached
 * singleton promise so multiple sections share the exact same font instance.
 */
export function loadKronaFont(url = DEFAULT_KRONA_URL): Promise<Font> {
  if (cachedFont) return Promise.resolve(cachedFont)
  if (fontPromise) return fontPromise

  fontPromise = (async () => {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to fetch font ${url}: ${response.status}`)
    }
    const buffer = await response.arrayBuffer()
    const font = parse(buffer)
    cachedFont = font
    return font
  })().catch(error => {
    fontPromise = null
    throw error
  })

  return fontPromise
}

function computeSignedArea(points: Vec2[]): number {
  let sum = 0
  const len = points.length
  for (let i = 0; i < len; i += 1) {
    const a = points[i]
    const b = points[(i + 1) % len]
    sum += a.x * b.y - b.x * a.y
  }
  return sum * 0.5
}

function appendLineSamples(
  target: Vec2[],
  p0: Vec2,
  p1: Vec2,
  maxSegmentLength: number,
) {
  const len = Math.hypot(p1.x - p0.x, p1.y - p0.y)
  const steps = Math.max(1, Math.ceil(len / maxSegmentLength))
  for (let s = 1; s <= steps; s += 1) {
    const t = s / steps
    target.push({
      x: p0.x + (p1.x - p0.x) * t,
      y: p0.y + (p1.y - p0.y) * t,
    })
  }
}

function appendQuadSamples(
  target: Vec2[],
  p0: Vec2,
  c1: Vec2,
  p1: Vec2,
  maxSegmentLength: number,
) {
  const polyLen =
    Math.hypot(c1.x - p0.x, c1.y - p0.y) + Math.hypot(p1.x - c1.x, p1.y - c1.y)
  const chordLen = Math.hypot(p1.x - p0.x, p1.y - p0.y)
  const estLen = 0.5 * (polyLen + chordLen)
  const steps = Math.max(4, Math.ceil(estLen / maxSegmentLength))
  for (let s = 1; s <= steps; s += 1) {
    const t = s / steps
    const inv = 1 - t
    target.push({
      x: inv * inv * p0.x + 2 * inv * t * c1.x + t * t * p1.x,
      y: inv * inv * p0.y + 2 * inv * t * c1.y + t * t * p1.y,
    })
  }
}

function appendCubicSamples(
  target: Vec2[],
  p0: Vec2,
  c1: Vec2,
  c2: Vec2,
  p1: Vec2,
  maxSegmentLength: number,
) {
  const polyLen =
    Math.hypot(c1.x - p0.x, c1.y - p0.y) +
    Math.hypot(c2.x - c1.x, c2.y - c1.y) +
    Math.hypot(p1.x - c2.x, p1.y - c2.y)
  const chordLen = Math.hypot(p1.x - p0.x, p1.y - p0.y)
  const estLen = 0.5 * (polyLen + chordLen)
  const steps = Math.max(6, Math.ceil(estLen / maxSegmentLength))
  for (let s = 1; s <= steps; s += 1) {
    const t = s / steps
    const inv = 1 - t
    const inv2 = inv * inv
    const t2 = t * t
    target.push({
      x: inv2 * inv * p0.x + 3 * inv2 * t * c1.x + 3 * inv * t2 * c2.x + t2 * t * p1.x,
      y: inv2 * inv * p0.y + 3 * inv2 * t * c1.y + 3 * inv * t2 * c2.y + t2 * t * p1.y,
    })
  }
}

function finalizeContour(raw: Vec2[], maxSegmentLength: number): Vec2[] {
  if (raw.length < 3) return []
  const cleaned: Vec2[] = [raw[0]]
  for (let i = 1; i < raw.length; i += 1) {
    const prev = cleaned[cleaned.length - 1]
    const curr = raw[i]
    if (Math.hypot(curr.x - prev.x, curr.y - prev.y) > 1e-3) {
      cleaned.push(curr)
    }
  }
  if (cleaned.length < 3) return []

  const first = cleaned[0]
  const last = cleaned[cleaned.length - 1]
  const closingDist = Math.hypot(last.x - first.x, last.y - first.y)
  if (closingDist < 0.05) {
    cleaned.pop()
  } else if (closingDist > maxSegmentLength) {
    const steps = Math.ceil(closingDist / maxSegmentLength)
    for (let s = 1; s < steps; s += 1) {
      const t = s / steps
      cleaned.push({
        x: last.x + (first.x - last.x) * t,
        y: last.y + (first.y - last.y) * t,
      })
    }
  }

  return cleaned.length >= 3 ? cleaned : []
}

function flattenPathToPolygons(
  path: Path,
  maxSegmentLength: number,
): Vec2[][] {
  const polygons: Vec2[][] = []
  let current: Vec2[] = []
  let cursor: Vec2 = { x: 0, y: 0 }

  const flush = () => {
    const finalized = finalizeContour(current, maxSegmentLength)
    if (finalized.length >= 3) polygons.push(finalized)
    current = []
  }

  for (const cmd of path.commands) {
    if (cmd.type === 'M') {
      if (current.length > 0) flush()
      cursor = { x: cmd.x, y: cmd.y }
      current = [cursor]
    } else if (cmd.type === 'L') {
      const end = { x: cmd.x, y: cmd.y }
      appendLineSamples(current, cursor, end, maxSegmentLength)
      cursor = end
    } else if (cmd.type === 'Q') {
      const c1 = { x: cmd.x1, y: cmd.y1 }
      const end = { x: cmd.x, y: cmd.y }
      appendQuadSamples(current, cursor, c1, end, maxSegmentLength)
      cursor = end
    } else if (cmd.type === 'C') {
      const c1 = { x: cmd.x1, y: cmd.y1 }
      const c2 = { x: cmd.x2, y: cmd.y2 }
      const end = { x: cmd.x, y: cmd.y }
      appendCubicSamples(current, cursor, c1, c2, end, maxSegmentLength)
      cursor = end
    } else if (cmd.type === 'Z') {
      flush()
    }
  }

  if (current.length > 0) flush()
  return polygons
}

/**
 * Computes unit inward vertex normals pointing into the filled letter body.
 * For TrueType glyphs in SVG y-down coordinates, outer CW loops have positive
 * signed area and inner CCW holes have negative signed area, so `(-dy, dx)`
 * consistently points into the solid ink across both outer and hole contours.
 */
export function computeInwardNormals(points: Vec2[]): {
  normals: Vec2[]
  signedArea: number
} {
  const n = points.length
  const signedArea = computeSignedArea(points)
  const normals: Vec2[] = new Array(n)

  for (let i = 0; i < n; i += 1) {
    const prev = points[(i - 1 + n) % n]
    const curr = points[i]
    const next = points[(i + 1) % n]

    const e1x = curr.x - prev.x
    const e1y = curr.y - prev.y
    const l1 = Math.hypot(e1x, e1y) || 1
    const n1x = -e1y / l1
    const n1y = e1x / l1

    const e2x = next.x - curr.x
    const e2y = next.y - curr.y
    const l2 = Math.hypot(e2x, e2y) || 1
    const n2x = -e2y / l2
    const n2y = e2x / l2

    let nx = n1x + n2x
    let ny = n1y + n2y
    const nl = Math.hypot(nx, ny)
    if (nl < 1e-5) {
      nx = n1x
      ny = n1y
    } else {
      nx /= nl
      ny /= nl
    }
    normals[i] = { x: nx, y: ny }
  }

  return { normals, signedArea }
}

/**
 * Serializes contours (optionally displaced along inward vertex normals) into
 * an SVG `<path d="...">` string.
 */
export function serializeContours(
  contours: LetterContour[],
  displacements?: Float32Array | number[],
): string {
  const parts: string[] = []
  let offset = 0

  for (let c = 0; c < contours.length; c += 1) {
    const { points, inwardNormals } = contours[c]
    if (points.length === 0) continue

    const segments: string[] = new Array(points.length + 1)
    for (let i = 0; i < points.length; i += 1) {
      const pt = points[i]
      const disp = displacements ? displacements[offset + i] ?? 0 : 0
      const nx = inwardNormals[i].x
      const ny = inwardNormals[i].y
      const x = (pt.x + nx * disp).toFixed(2)
      const y = (pt.y + ny * disp).toFixed(2)
      segments[i] = `${i === 0 ? 'M' : 'L'}${x} ${y}`
    }
    segments[points.length] = 'Z'
    parts.push(segments.join(''))
    offset += points.length
  }

  return parts.join('')
}

/**
 * Extracts per-letter dense polygon/bezier vertex arrays, inward vertex normals,
 * SVG path strings, and bounding metrics (`totalWidth`, `ascender`, `descender`,
 * `baselineY`) for a given word in Krona One.
 */
export function extractWordLetters(
  font: Font,
  text: string,
  opts?: WordExtractOptions,
): ExtractedWord {
  const fontSize = opts?.fontSize ?? 100
  const letterSpacing = opts?.letterSpacing ?? -0.03
  const kerning = opts?.kerning ?? true
  const maxSegmentLength = opts?.maxSegmentLength ?? Math.max(1.8, fontSize * 0.032)
  const paddingX = opts?.paddingX ?? fontSize * 0.1
  const paddingTop = opts?.paddingTop ?? fontSize * 0.1
  const paddingBottom = opts?.paddingBottom ?? fontSize * 0.1

  const cacheKey = `${text}|${fontSize}|${letterSpacing}|${kerning ? 1 : 0}|${maxSegmentLength}|${paddingX}|${paddingTop}|${paddingBottom}`
  const hit = extractedWordCache.get(cacheKey)
  if (hit) return hit

  const scale = fontSize / font.unitsPerEm
  const glyphs = font.stringToGlyphs(text)
  const renderOpts: RenderOptions = { kerning, letterSpacing }

  let rawMinX = Infinity
  let rawMaxX = -Infinity
  let rawMinY = Infinity
  let rawMaxY = -Infinity

  type RawGlyph = {
    index: number
    char: string
    originX: number
    advanceWidth: number
    polygons: Vec2[][]
  }

  const rawGlyphs: RawGlyph[] = []
  let penX = 0

  for (let i = 0; i < glyphs.length; i += 1) {
    const glyph = glyphs[i]
    if (kerning && i > 0) {
      penX += font.getKerningValue(glyphs[i - 1], glyph) * scale
    }
    const path = glyph.getPath(penX, 0, fontSize, renderOpts, font)
    const polygons = flattenPathToPolygons(path, maxSegmentLength)

    for (const poly of polygons) {
      for (const pt of poly) {
        if (pt.x < rawMinX) rawMinX = pt.x
        if (pt.x > rawMaxX) rawMaxX = pt.x
        if (pt.y < rawMinY) rawMinY = pt.y
        if (pt.y > rawMaxY) rawMaxY = pt.y
      }
    }

    const advanceWidth = (glyph.advanceWidth ?? 0) * scale
    rawGlyphs.push({
      index: i,
      char: text[i] ?? '',
      originX: penX,
      advanceWidth,
      polygons,
    })

    penX += advanceWidth
    if (i < glyphs.length - 1) {
      penX += letterSpacing * fontSize
    }
  }

  if (!Number.isFinite(rawMinX)) {
    rawMinX = 0
    rawMaxX = Math.max(1, penX)
    rawMinY = -fontSize * 0.8
    rawMaxY = fontSize * 0.2
  }

  const inkWidth = Math.max(1, rawMaxX - rawMinX)
  const inkHeight = Math.max(1, rawMaxY - rawMinY)
  const totalWidth = inkWidth + paddingX * 2
  const totalHeight = inkHeight + paddingTop + paddingBottom
  const shiftX = paddingX - rawMinX
  const baselineY = paddingTop - rawMinY

  const letters: ExtractedLetter[] = rawGlyphs.map(raw => {
    let lx1 = Infinity
    let ly1 = Infinity
    let lx2 = -Infinity
    let ly2 = -Infinity
    let vertexCount = 0

    const contours: LetterContour[] = raw.polygons.map(poly => {
      const shifted = poly.map(pt => {
        const x = pt.x + shiftX
        const y = pt.y + baselineY
        if (x < lx1) lx1 = x
        if (x > lx2) lx2 = x
        if (y < ly1) ly1 = y
        if (y > ly2) ly2 = y
        return { x, y }
      })
      vertexCount += shifted.length
      const { normals, signedArea } = computeInwardNormals(shifted)
      return { points: shifted, inwardNormals: normals, signedArea }
    })

    if (!Number.isFinite(lx1)) {
      const ox = raw.originX + shiftX
      lx1 = ox
      lx2 = ox + raw.advanceWidth
      ly1 = baselineY - fontSize * 0.5
      ly2 = baselineY
    }

    const box: LetterBox = {
      x1: lx1,
      y1: ly1,
      x2: lx2,
      y2: ly2,
      width: Math.max(1, lx2 - lx1),
      height: Math.max(1, ly2 - ly1),
      cx: (lx1 + lx2) * 0.5,
      cy: (ly1 + ly2) * 0.5,
    }

    return {
      index: raw.index,
      char: raw.char,
      originX: raw.originX + shiftX,
      advanceWidth: raw.advanceWidth,
      box,
      contours,
      basePath: serializeContours(contours),
      vertexCount,
    }
  })

  const result: ExtractedWord = {
    text,
    letters,
    totalWidth,
    totalHeight,
    inkWidth,
    inkHeight,
    ascender: font.ascender * scale,
    descender: font.descender * scale,
    baselineY,
    viewBox: `0 0 ${totalWidth.toFixed(2)} ${totalHeight.toFixed(2)}`,
    fontSize,
  }
  extractedWordCache.set(cacheKey, result)
  return result
}

/**
 * Computes Gaussian-falloff inward dent targets along vertex normals from an
 * invisible pointer circle collider at `(pointerX, pointerY)` in SVG coords.
 */
export function computeNormalDentTargets(
  letter: ExtractedLetter,
  pointerX: number,
  pointerY: number,
  opts?: { radius?: number; maxDent?: number; out?: Float32Array },
): Float32Array {
  const radius = opts?.radius ?? 56
  const maxDent = opts?.maxDent ?? 5.4
  const out = opts?.out ?? new Float32Array(letter.vertexCount)
  const reach = radius * 1.65

  const { box } = letter
  if (
    pointerX < box.x1 - reach ||
    pointerX > box.x2 + reach ||
    pointerY < box.y1 - reach ||
    pointerY > box.y2 + reach
  ) {
    out.fill(0)
    return out
  }

  const sigma = radius * 0.45
  const invTwoSigmaSq = 1 / (2 * sigma * sigma)
  let idx = 0

  for (let c = 0; c < letter.contours.length; c += 1) {
    const pts = letter.contours[c].points
    for (let i = 0; i < pts.length; i += 1) {
      const dx = pts[i].x - pointerX
      const dy = pts[i].y - pointerY
      const distSq = dx * dx + dy * dy
      out[idx] = distSq < reach * reach ? maxDent * Math.exp(-distSq * invTwoSigmaSq) : 0
      idx += 1
    }
  }

  return out
}
