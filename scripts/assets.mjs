import { spawnSync } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import opentype from 'opentype.js'
import sharp from 'sharp'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceRoot = 'C:\\Users\\mrjj7\\Desktop\\ADS-CAMPAIGN\\SOFT CHAOS\\01_mochi'
const deliveredAssetRoot = 'C:\\Users\\mrjj7\\Desktop\\MOCHI LIP GLOSS'
const sourceDirs = [deliveredAssetRoot, path.join(sourceRoot, 'site'), path.join(sourceRoot, 'raw')]
const mediaRoot = path.join(projectRoot, 'public', 'media')
const pythonExe = path.join(projectRoot, '.venv-assets', 'Scripts', 'python.exe')
const rembgHelper = path.join(projectRoot, 'scripts', 'rembg_helper.py')
const fontPath = path.join(projectRoot, 'public', 'fonts', 'krona-one-400-normal.ttf')
const heroVideo = path.join(mediaRoot, 'video', 'hero-six.mp4')

const argv = new Set(process.argv.slice(2))
const forceAll = argv.has('--force')
const forceHero = forceAll || argv.has('--force-hero')
const forceCutouts = forceAll || argv.has('--force-cutouts')
const forcePhotos = forceAll || argv.has('--force-photos')
const forceWallpapers = forceAll || argv.has('--force-wallpapers')
const forceOg = forceAll || argv.has('--force-og')
const log = []

const FLAVOURS = [
  { key: 'cherry', name: 'CHERRY', jelly: '#B3122E', aura: '#2FA4A8' },
  { key: 'peach', name: 'PEACH', jelly: '#F4A27E', aura: '#8FC3E6' },
  { key: 'lychee', name: 'LYCHEE', jelly: '#F6D3D6', aura: '#E46A8E' },
  { key: 'grape', name: 'GRAPE', jelly: '#8E5BC4', aura: '#F08A3C' },
  { key: 'mint', name: 'MINT', jelly: '#8FD9B6', aura: '#14524A' },
  { key: 'mango', name: 'MANGO', jelly: '#F2B632', aura: '#2346B8' },
]

for (const dir of [
  'cutouts',
  'photos',
  'hero-seq',
  'hero-seq/desk',
  'hero-seq/mob',
  'sequence',
  'sequence/squeeze',
  'video',
  'video/aura-loops',
  'wallpapers',
  'og',
]) {
  await fs.mkdir(path.join(mediaRoot, dir), { recursive: true })
}

async function exists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function dirTotalBytes(dirPath) {
  if (!(await exists(dirPath))) return 0
  const entries = await fs.readdir(dirPath, { withFileTypes: true })
  let sum = 0
  for (const entry of entries) {
    if (entry.isFile()) {
      const stat = await fs.stat(path.join(dirPath, entry.name))
      sum += stat.size
    }
  }
  return sum
}

async function findSource(names) {
  for (const dir of sourceDirs) {
    for (const name of names) {
      for (const ext of ['', '.png', '.jpg', '.jpeg', '.webp']) {
        const candidate = path.join(dir, `${name}${ext}`)
        if (await exists(candidate)) return candidate
      }
    }
  }
  return null
}

async function makeBlurDataUrl(inputPath) {
  const buf = await sharp(inputPath)
    .resize({ width: 24, withoutEnlargement: true })
    .webp({ quality: 40 })
    .toBuffer()
  return `data:image/webp;base64,${buf.toString('base64')}`
}

async function hasTransparentCorners(imagePath) {
  try {
    const { data, info } = await sharp(imagePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    const { width, height, channels } = info
    const corners = [
      data[3],
      data[(width - 1) * channels + 3],
      data[((height - 1) * width) * channels + 3],
      data[((height - 1) * width + (width - 1)) * channels + 3],
    ]
    return corners.every(alpha => alpha === 0)
  } catch {
    return false
  }
}

function makeWordmarkSvgPath(font, text, targetWidth, fill, opacity = 1) {
  const pathObj = font.getPath(text, 0, 0, 1000)
  const box = pathObj.getBoundingBox()
  const rawWidth = Math.max(1, box.x2 - box.x1)
  const rawHeight = Math.max(1, box.y2 - box.y1)
  const outWidth = Math.round(targetWidth)
  const outHeight = Math.max(1, Math.round((targetWidth * rawHeight) / rawWidth))
  const pad = 4
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${outWidth}" height="${outHeight}" viewBox="${(box.x1 - pad).toFixed(2)} ${(box.y1 - pad).toFixed(2)} ${(rawWidth + pad * 2).toFixed(2)} ${(rawHeight + pad * 2).toFixed(2)}"><path d="${pathObj.toPathData(2)}" fill="${fill}" fill-opacity="${opacity}"/></svg>`
  return { svg, width: outWidth, height: outHeight }
}

/**
 * 1. HERO WAVE FRAMES (07-H)
 * Extracts 172 desktop frames (<=10MB) and 86 mobile frames (<=3MB) from hero-six.mp4,
 * never modifying hero-six.mp4, and removes legacy hero-seq-v2/v3/v4 duplicates.
 */
async function buildHeroSequence() {
  for (const staleDir of ['hero-seq-v2', 'hero-seq-v3', 'hero-seq-v4']) {
    const full = path.join(mediaRoot, staleDir)
    if (await exists(full)) {
      await fs.rm(full, { recursive: true, force: true })
      log.push(`removed stale ${staleDir}`)
    }
  }

  if (!(await exists(heroVideo))) {
    log.push('missing hero-six.mp4; skipped hero-seq extraction')
    return { deskCount: 0, mobCount: 0, deskBytes: 0, mobBytes: 0 }
  }

  const deskDir = path.join(mediaRoot, 'hero-seq', 'desk')
  const mobDir = path.join(mediaRoot, 'hero-seq', 'mob')
  const posterPath = path.join(mediaRoot, 'hero-seq', 'poster.webp')

  const existingDesk = (await fs.readdir(deskDir)).filter(f => f.endsWith('.webp'))
  const existingMob = (await fs.readdir(mobDir)).filter(f => f.endsWith('.webp'))
  const existingDeskBytes = await dirTotalBytes(deskDir)
  const existingMobBytes = await dirTotalBytes(mobDir)

  const needsDesk = forceHero || existingDesk.length !== 172 || existingDeskBytes > 10 * 1024 * 1024 || !(await exists(posterPath))
  const needsMob = forceHero || existingMob.length !== 86 || existingMobBytes > 3 * 1024 * 1024

  if (needsDesk) {
    for (const f of existingDesk) await fs.unlink(path.join(deskDir, f))
    // Use -preset photo -q:v 35 so 172 frames at 1600x900 stay crisp and <= 10 MB
    const res = spawnSync(
      'ffmpeg',
      [
        '-y',
        '-i',
        heroVideo,
        '-an',
        '-vf',
        'scale=1600:-2',
        '-c:v',
        'libwebp',
        '-preset',
        'photo',
        '-q:v',
        '35',
        '-compression_level',
        '6',
        path.join(deskDir, '%04d.webp'),
        '-loglevel',
        'error',
      ],
      { stdio: 'inherit' },
    )
    if (res.status !== 0) throw new Error(`ffmpeg desktop hero-seq failed with code ${res.status}`)
    await fs.copyFile(path.join(deskDir, '0001.webp'), posterPath)
  }

  if (needsMob) {
    for (const f of existingMob) await fs.unlink(path.join(mobDir, f))
    const res = spawnSync(
      'ffmpeg',
      [
        '-y',
        '-i',
        heroVideo,
        '-an',
        '-vf',
        'select=not(mod(n\\,2)),scale=960:-2',
        '-fps_mode',
        'vfr',
        '-c:v',
        'libwebp',
        '-quality',
        '68',
        '-compression_level',
        '6',
        path.join(mobDir, '%04d.webp'),
        '-loglevel',
        'error',
      ],
      { stdio: 'inherit' },
    )
    if (res.status !== 0) throw new Error(`ffmpeg mobile hero-seq failed with code ${res.status}`)
  }

  const deskFiles = (await fs.readdir(deskDir)).filter(f => f.endsWith('.webp'))
  const mobFiles = (await fs.readdir(mobDir)).filter(f => f.endsWith('.webp'))
  const deskBytes = await dirTotalBytes(deskDir)
  const mobBytes = await dirTotalBytes(mobDir)
  return { deskCount: deskFiles.length, mobCount: mobFiles.length, deskBytes, mobBytes }
}

/**
 * 2. REAL TRANSPARENT CUTOUTS (rembg + alpha decontamination) + AURA WEBPs
 */
async function buildCutouts() {
  const cutoutManifest = {}
  const rembgJobs = []

  const targets = [
    ...FLAVOURS.map(f => ({
      key: f.key,
      sourceNames: [`MOCHI_${f.key.toUpperCase()}_PK`],
      baseName: `mochi-${f.key}`,
    })),
    {
      key: 'stand',
      sourceNames: ['MOCHI_BLOB_STAND'],
      baseName: 'mochi-stand',
    },
  ]

  for (const item of targets) {
    const src = await findSource(item.sourceNames)
    if (!src) {
      log.push(`missing cutout source for ${item.baseName}`)
      continue
    }
    const pngPath = path.join(mediaRoot, 'cutouts', `${item.baseName}.png`)
    const webpPath = path.join(mediaRoot, 'cutouts', `${item.baseName}.webp`)
    const validExisting =
      !forceCutouts &&
      (await exists(pngPath)) &&
      (await exists(webpPath)) &&
      (await hasTransparentCorners(pngPath)) &&
      (await hasTransparentCorners(webpPath))

    if (!validExisting) {
      rembgJobs.push({ source: src, target: pngPath, webp: webpPath, maxHeight: 1600 })
    }
  }

  if (rembgJobs.length > 0) {
    const jobFile = path.join(os.tmpdir(), `mochi-rembg-${Date.now()}.json`)
    await fs.writeFile(jobFile, JSON.stringify(rembgJobs, null, 2))
    try {
      const res = spawnSync(pythonExe, [rembgHelper, '--batch', jobFile], { stdio: 'inherit' })
      if (res.status !== 0) throw new Error(`rembg_helper.py exited with status ${res.status}`)
    } finally {
      await fs.rm(jobFile, { force: true })
    }
  }

  for (const item of targets) {
    const pngPath = path.join(mediaRoot, 'cutouts', `${item.baseName}.png`)
    const webpPath = path.join(mediaRoot, 'cutouts', `${item.baseName}.webp`)
    if (!(await exists(webpPath))) continue
    const meta = await sharp(webpPath).metadata()
    const blurDataUrl = await makeBlurDataUrl(webpPath)
    cutoutManifest[`${item.baseName}.webp`] = {
      path: `/media/cutouts/${item.baseName}.webp`,
      png: `/media/cutouts/${item.baseName}.png`,
      webp: `/media/cutouts/${item.baseName}.webp`,
      width: meta.width ?? 0,
      height: meta.height ?? 0,
      blurDataUrl,
    }
  }

  // Aura cutouts (1200px wide WebP)
  for (const f of FLAVOURS) {
    const auraSource = await findSource([`MOCHI_${f.key.toUpperCase()}_AURA`, `MOCHI_${f.key.toUpperCase()}_PK`])
    if (!auraSource) {
      log.push(`missing aura source for ${f.key}`)
      continue
    }
    const auraTarget = path.join(mediaRoot, 'cutouts', `mochi-${f.key}-aura.webp`)
    if (forceCutouts || !(await exists(auraTarget))) {
      await sharp(auraSource)
        .resize({ width: 1200, withoutEnlargement: true })
        .webp({ quality: 86 })
        .toFile(auraTarget)
    }
    const meta = await sharp(auraTarget).metadata()
    const blurDataUrl = await makeBlurDataUrl(auraTarget)
    cutoutManifest[`mochi-${f.key}-aura.webp`] = {
      path: `/media/cutouts/mochi-${f.key}-aura.webp`,
      webp: `/media/cutouts/mochi-${f.key}-aura.webp`,
      width: meta.width ?? 0,
      height: meta.height ?? 0,
      blurDataUrl,
    }
  }

  return cutoutManifest
}

/**
 * 3. PHOTOS + AVIF/WEBP + BLUR PLACEHOLDERS
 */
async function buildPhotos() {
  const photoSpecs = [
    ['mochi-peach-model', ['MOCHI_PEACH_MODEL', 'MOCHI_M1']],
    ['mochi-model-1', ['MOCHI_CHERRY_MODEL', 'MOCHI_M2']],
    ['mochi-model-2', ['MOCHI_MINT_MODEL', 'MOCHI_M3']],
    ['mochi-model-3', ['MOCHI_GRAPE_MODEL', 'MOCHI_M4']],
    ['mochi-model-4', ['MOCHI_LYCHEE_MODEL', 'MOCHI_M5']],
    ['mochi-model-5', ['MOCHI_MANGO_MODEL', 'MOCHI_N01']],
    ['mochi-diptych-cherry', ['MOCHI_DIPTYCH_CHERRY', 'MOCHI_N02']],
    ['mochi-diptych-lychee', ['MOCHI_DIPTYCH_LYCHEE']],
    ['mochi-all-row', ['MOCHI_ALL_ROW']],
    ['mochi-hero-wide', ['MOCHI_HERO_WIDE']],
    ['mochi-blob-stand', ['MOCHI_BLOB_STAND']],
    ['mochi-all-pile', ['MOCHI_ALL_PILE', 'MOCHI_N03']],
  ]

  const photosManifest = {}

  for (const [baseName, sourceNames] of photoSpecs) {
    const src = await findSource(sourceNames)
    if (!src) {
      log.push(`missing photo: ${baseName}`)
      continue
    }
    const webpPath = path.join(mediaRoot, 'photos', `${baseName}.webp`)
    const avifPath = path.join(mediaRoot, 'photos', `${baseName}.avif`)

    if (forcePhotos || !(await exists(webpPath))) {
      await sharp(src)
        .resize({ width: 1600, withoutEnlargement: true })
        .webp({ quality: 86 })
        .toFile(webpPath)
    }
    if (forcePhotos || !(await exists(avifPath))) {
      await sharp(src)
        .resize({ width: 1600, withoutEnlargement: true })
        .avif({ quality: 62, effort: 4 })
        .toFile(avifPath)
    }

    const meta = await sharp(webpPath).metadata()
    const blurDataUrl = await makeBlurDataUrl(webpPath)
    photosManifest[`${baseName}.webp`] = {
      path: `/media/photos/${baseName}.webp`,
      webp: `/media/photos/${baseName}.webp`,
      avif: `/media/photos/${baseName}.avif`,
      width: meta.width ?? 0,
      height: meta.height ?? 0,
      blurDataUrl,
    }
  }

  return photosManifest
}

/**
 * 4. WALLPAPERS (1290x2796)
 * Preserves 100% horizontal width of MOCHI_<FLAVOUR>_AURA (never clipping Peach/Grape/etc.),
 * extends the sampled top/bottom perimeter vertically with smooth C1 feathering + film grain,
 * and adds a clean small Krona One MOCHI wordmark at the bottom.
 */
async function buildWallpapers(kronaFont) {
  const W = 1290
  const H = 2796
  const IMG_H = 1612 // 1122x1402 scaled cleanly to width 1290
  const TOP_Y = 560 // Leaves generous top clock breathing room and centers tube comfortably
  const BOT_Y = TOP_Y + IMG_H
  const FEATHER = 150
  const wallpaperManifest = {}

  for (let idx = 0; idx < FLAVOURS.length; idx += 1) {
    const f = FLAVOURS[idx]
    const targetPath = path.join(mediaRoot, 'wallpapers', `mochi-${f.key}-1290x2796.png`)
    const auraSource = await findSource([`MOCHI_${f.key.toUpperCase()}_AURA`, `MOCHI_${f.key.toUpperCase()}_PK`])
    if (!auraSource) {
      log.push(`missing wallpaper source for ${f.key}`)
      continue
    }

    if (forceWallpapers || !(await exists(targetPath))) {
      const { data: src } = await sharp(auraSource)
        .resize(W, IMG_H, { fit: 'fill' })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true })

      // Sample averaged top/bottom 20-row profiles per x
      const topRow = new Float32Array(W * 3)
      const botRow = new Float32Array(W * 3)
      const sampleRows = 20
      for (let x = 0; x < W; x += 1) {
        let tr = 0; let tg = 0; let tb = 0
        let br = 0; let bg = 0; let bb = 0
        for (let r = 0; r < sampleRows; r += 1) {
          const ti = (r * W + x) * 3
          tr += src[ti]; tg += src[ti + 1]; tb += src[ti + 2]
          const bi = ((IMG_H - 1 - r) * W + x) * 3
          br += src[bi]; bg += src[bi + 1]; bb += src[bi + 2]
        }
        topRow[x * 3] = tr / sampleRows
        topRow[x * 3 + 1] = tg / sampleRows
        topRow[x * 3 + 2] = tb / sampleRows
        botRow[x * 3] = br / sampleRows
        botRow[x * 3 + 1] = bg / sampleRows
        botRow[x * 3 + 2] = bb / sampleRows
      }

      // Horizontally smooth both boundary profiles (radius 48) so film grain is separated from gradient field
      const smoothStrip = (strip, radius = 48) => {
        const out = new Float32Array(strip.length)
        for (let x = 0; x < W; x += 1) {
          let sr = 0; let sg = 0; let sb = 0; let cnt = 0
          const x0 = Math.max(0, x - radius)
          const x1 = Math.min(W - 1, x + radius)
          for (let k = x0; k <= x1; k += 1) {
            sr += strip[k * 3]; sg += strip[k * 3 + 1]; sb += strip[k * 3 + 2]; cnt += 1
          }
          out[x * 3] = sr / cnt
          out[x * 3 + 1] = sg / cnt
          out[x * 3 + 2] = sb / cnt
        }
        return out
      }
      const topSmooth = smoothStrip(topRow, 48)
      const botSmooth = smoothStrip(botRow, 48)

      // Outer edge reference (average across the outer 15% corners)
      const avgOuter = (strip) => {
        let r = 0; let g = 0; let b = 0; let c = 0
        for (let x = Math.floor(W * 0.25); x < Math.floor(W * 0.85); x += 1) {
          r += strip[x * 3]; g += strip[x * 3 + 1]; b += strip[x * 3 + 2]; c += 1
        }
        return [r / c, g / c, b / c]
      }
      const topOuter = avgOuter(topSmooth)
      const botOuter = avgOuter(botSmooth)

      // Assemble 1290x2796 RGB canvas with smooth vertical extension + feather + deterministic film grain
      const canvas = Buffer.alloc(W * H * 3)
      let seed = 1337 + idx * 97
      const nextGrain = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0
        const u1 = ((seed >>> 16) & 0xffff) / 65535
        seed = (seed * 1664525 + 1013904223) >>> 0
        const u2 = ((seed >>> 16) & 0xffff) / 65535
        return (u1 + u2 - 1) * 7.5
      }

      for (let y = 0; y < H; y += 1) {
        const inPhoto = y >= TOP_Y && y < BOT_Y
        const py = y - TOP_Y
        for (let x = 0; x < W; x += 1) {
          const xi = x * 3
          let fr; let fg; let fb
          let grainScale = 1.0

          if (y < TOP_Y + FEATHER) {
            const extT = Math.min(1, y / TOP_Y)
            const s = extT * extT * (3 - 2 * extT)
            const tr = topOuter[0] * (1 - s * 0.65) + topSmooth[xi] * (s * 0.65)
            const tg = topOuter[1] * (1 - s * 0.65) + topSmooth[xi + 1] * (s * 0.65)
            const tb = topOuter[2] * (1 - s * 0.65) + topSmooth[xi + 2] * (s * 0.65)
            if (inPhoto) {
              const u = py / FEATHER
              const w = 0.5 - 0.5 * Math.cos(Math.PI * u)
              const si = (py * W + x) * 3
              fr = tr * (1 - w) + src[si] * w
              fg = tg * (1 - w) + src[si + 1] * w
              fb = tb * (1 - w) + src[si + 2] * w
              grainScale = 1 - w
            } else {
              fr = tr; fg = tg; fb = tb
            }
          } else if (y >= BOT_Y - FEATHER) {
            const extT = Math.max(0, Math.min(1, (H - 1 - y) / (H - BOT_Y)))
            const s = extT * extT * (3 - 2 * extT)
            const br = botOuter[0] * (1 - s * 0.65) + botSmooth[xi] * (s * 0.65)
            const bg = botOuter[1] * (1 - s * 0.65) + botSmooth[xi + 1] * (s * 0.65)
            const bb = botOuter[2] * (1 - s * 0.65) + botSmooth[xi + 2] * (s * 0.65)
            if (inPhoto) {
              const u = (BOT_Y - 1 - y) / FEATHER
              const w = 0.5 - 0.5 * Math.cos(Math.PI * u)
              const si = (py * W + x) * 3
              fr = br * (1 - w) + src[si] * w
              fg = bg * (1 - w) + src[si + 1] * w
              fb = bb * (1 - w) + src[si + 2] * w
              grainScale = 1 - w
            } else {
              fr = br; fg = bg; fb = bb
            }
          } else {
            const si = (py * W + x) * 3
            fr = src[si]; fg = src[si + 1]; fb = src[si + 2]
            grainScale = 0.25 // gentle subtle film texture unify
          }

          const g = nextGrain() * grainScale
          const oi = (y * W + x) * 3
          canvas[oi] = Math.max(0, Math.min(255, Math.round(fr + g)))
          canvas[oi + 1] = Math.max(0, Math.min(255, Math.round(fg + g)))
          canvas[oi + 2] = Math.max(0, Math.min(255, Math.round(fb + g)))
        }
      }

      // Pick ink vs milk wordmark based on bottom band luminance
      const lum = (0.2126 * botOuter[0] + 0.7152 * botOuter[1] + 0.0722 * botOuter[2]) / 255
      const wmFill = lum < 0.45 ? '#FAF7F2' : '#141414'
      const wm = makeWordmarkSvgPath(kronaFont, 'MOCHI', 210, wmFill, lum < 0.45 ? 0.84 : 0.78)
      const wmLeft = Math.round((W - wm.width) / 2)
      const wmTop = H - 148 - Math.round(wm.height / 2)

      await sharp(canvas, { raw: { width: W, height: H, channels: 3 } })
        .composite([{ input: Buffer.from(wm.svg), left: wmLeft, top: wmTop }])
        .png({ compressionLevel: 9 })
        .toFile(targetPath)
    }

    const meta = await sharp(targetPath).metadata()
    wallpaperManifest[`mochi-${f.key}-1290x2796.png`] = {
      path: `/media/wallpapers/mochi-${f.key}-1290x2796.png`,
      width: meta.width ?? 0,
      height: meta.height ?? 0,
    }
  }

  return wallpaperManifest
}

/**
 * 5. OG IMAGE (1200x630 .jpg + .png) from MOCHI_HERO_WIDE with MOCHI wordmark
 */
async function buildOgImage(kronaFont) {
  const heroWide = await findSource(['MOCHI_HERO_WIDE'])
  if (!heroWide) {
    log.push('missing MOCHI_HERO_WIDE for OG image')
    return null
  }
  const jpgPath = path.join(mediaRoot, 'og', 'mochi-og.jpg')
  const pngPath = path.join(mediaRoot, 'og', 'mochi-og.png')

  if (forceOg || !(await exists(jpgPath)) || !(await exists(pngPath))) {
    const wm = makeWordmarkSvgPath(kronaFont, 'MOCHI', 248, '#141414', 0.9)
    const composed = sharp(heroWide)
      .resize(1200, 630, { fit: 'cover', position: 'centre' })
      .composite([{ input: Buffer.from(wm.svg), left: 64, top: 58 }])

    await composed.clone().jpeg({ quality: 90, mozjpeg: true }).toFile(jpgPath)
    await composed.clone().png({ compressionLevel: 9 }).toFile(pngPath)
  }

  return {
    jpg: '/media/og/mochi-og.jpg',
    png: '/media/og/mochi-og.png',
    width: 1200,
    height: 630,
  }
}

async function scanVideos() {
  const videos = {}
  const candidates = [
    ['hero-six.mp4', '/media/video/hero-six.mp4'],
    ['flavour-reel.mp4', '/media/video/flavour-reel.mp4'],
    ['flavour-reel.webm', '/media/video/flavour-reel.webm'],
    ['drop-reel.mp4', '/media/video/drop-reel.mp4'],
    ['drop-reel.webm', '/media/video/drop-reel.webm'],
    ['squeeze.mp4', '/media/video/squeeze.mp4'],
    ['squeeze.webm', '/media/video/squeeze.webm'],
  ]
  for (const [name, rel] of candidates) {
    const full = path.join(projectRoot, 'public', rel.slice(1))
    if (await exists(full)) {
      const stat = await fs.stat(full)
      videos[name] = { path: rel, bytes: stat.size }
    }
  }
  for (const f of FLAVOURS) {
    for (const ext of ['mp4', 'webm']) {
      const rel = `/media/video/aura-loops/${f.key}.${ext}`
      const full = path.join(projectRoot, 'public', rel.slice(1))
      if (await exists(full)) {
        const stat = await fs.stat(full)
        videos[`aura-loops/${f.key}.${ext}`] = { path: rel, bytes: stat.size }
      }
    }
  }
  return videos
}

const fontBytes = await fs.readFile(fontPath)
const kronaFont = opentype.parse(fontBytes.buffer.slice(fontBytes.byteOffset, fontBytes.byteOffset + fontBytes.byteLength))
const heroSeq = await buildHeroSequence()
const cutouts = await buildCutouts()
const photos = await buildPhotos()
const wallpapers = await buildWallpapers(kronaFont)
const og = await buildOgImage(kronaFont)
const videos = await scanVideos()

const byPath = {}
for (const entry of Object.values(photos)) byPath[entry.path] = entry
for (const entry of Object.values(cutouts)) byPath[entry.path] = entry
for (const entry of Object.values(wallpapers)) byPath[entry.path] = entry
if (og) {
  byPath[og.jpg] = og
  byPath[og.png] = og
}

const manifest = {
  generatedAt: new Date().toISOString(),
  heroSeq,
  photos,
  cutouts,
  wallpapers,
  og,
  videos,
  byPath,
  log,
}

await fs.writeFile(path.join(mediaRoot, 'manifest.json'), JSON.stringify(manifest, null, 2))
await fs.writeFile(
  path.join(projectRoot, 'asset-pipeline.log'),
  log.length ? log.join('\n') : 'all requested assets generated and verified',
)
console.log(
  JSON.stringify(
    {
      heroSeq,
      cutoutsCount: Object.keys(cutouts).length,
      photosCount: Object.keys(photos).length,
      wallpapersCount: Object.keys(wallpapers).length,
      og,
      videosCount: Object.keys(videos).length,
      log,
    },
    null,
    2,
  ),
)
