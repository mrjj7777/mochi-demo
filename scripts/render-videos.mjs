import { spawnSync } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { bundle } from '@remotion/bundler'
import { renderFrames, renderMedia, renderStill, selectComposition } from '@remotion/renderer'
import sharp from 'sharp'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const mediaRoot = path.join(projectRoot, 'public', 'media')
const videoRoot = path.join(mediaRoot, 'video')
const auraLoopsDir = path.join(videoRoot, 'aura-loops')
const squeezeSeqDir = path.join(mediaRoot, 'sequence', 'squeeze')
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const FLAVOURS = ['cherry', 'peach', 'lychee', 'grape', 'mint', 'mango']

const onlyArg = process.argv.find(a => a.startsWith('--only='))
const onlySet = onlyArg ? new Set(onlyArg.slice(7).split(',').map(s => s.trim())) : null
const shouldRun = tag => !onlySet || onlySet.has(tag)

await fs.mkdir(auraLoopsDir, { recursive: true })
await fs.mkdir(squeezeSeqDir, { recursive: true })

function runFfmpeg(args, label) {
  const res = spawnSync('ffmpeg', ['-y', ...args, '-loglevel', 'error'], { stdio: 'inherit' })
  if (res.status !== 0) throw new Error(`ffmpeg failed (${label}) with code ${res.status}`)
}

async function encodeMp4AndWebm(sourceMp4, outMp4, outWebm, crfH264 = '22', crfVp9 = '34') {
  runFfmpeg(
    [
      '-i',
      sourceMp4,
      '-vf',
      'scale=in_range=full:out_range=tv,format=yuv420p',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-color_range',
      'tv',
      '-movflags',
      '+faststart',
      '-crf',
      crfH264,
      '-preset',
      'medium',
      '-an',
      outMp4,
    ],
    path.basename(outMp4),
  )
  runFfmpeg(
    [
      '-i',
      sourceMp4,
      '-c:v',
      'libvpx-vp9',
      '-pix_fmt',
      'yuv420p',
      '-b:v',
      '0',
      '-crf',
      crfVp9,
      '-deadline',
      'good',
      '-cpu-used',
      '4',
      '-row-mt',
      '1',
      '-an',
      outWebm,
    ],
    path.basename(outWebm),
  )
}

async function renderPoster(serveUrl, composition, frame, outWebp, tempDir) {
  const tmpPng = path.join(tempDir, `${composition.id}-poster.png`)
  await renderStill({
    composition,
    serveUrl,
    frame,
    imageFormat: 'png',
    output: tmpPng,
    overwrite: true,
    browserExecutable: chromePath,
  })
  await sharp(tmpPng).webp({ quality: 82 }).toFile(outWebp)
}

// Stage minimal publicDir (fonts + transparent cutouts) so Windows bundle copy takes < 1s
const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'mochi-remotion-'))
const stagedPublic = path.join(tmpRoot, 'public')
await fs.mkdir(path.join(stagedPublic, 'fonts'), { recursive: true })
await fs.mkdir(path.join(stagedPublic, 'media', 'cutouts'), { recursive: true })

for (const fontFile of await fs.readdir(path.join(projectRoot, 'public', 'fonts'))) {
  await fs.copyFile(path.join(projectRoot, 'public', 'fonts', fontFile), path.join(stagedPublic, 'fonts', fontFile))
}
for (const f of FLAVOURS) {
  const png = `mochi-${f}.png`
  const src = path.join(mediaRoot, 'cutouts', png)
  await fs.copyFile(src, path.join(stagedPublic, 'media', 'cutouts', png))
}

console.log('Bundling Remotion compositions...')
const serveUrl = await bundle({
  entryPoint: path.join(projectRoot, 'remotion', 'index.ts'),
  publicDir: stagedPublic,
  outDir: path.join(tmpRoot, 'bundle'),
})

const concurrency = Math.max(2, Math.min(4, os.cpus().length))

try {
  if (shouldRun('squeeze')) {
    console.log('Rendering SqueezeSequence (90 frames, 768x960)...')
    const comp = await selectComposition({ serveUrl, id: 'SqueezeSequence', browserExecutable: chromePath })
    const framesDir = path.join(tmpRoot, 'squeeze-frames')
    await fs.mkdir(framesDir, { recursive: true })

    await renderFrames({
      composition: comp,
      serveUrl,
      outputDir: framesDir,
      imageFormat: 'png',
      inputProps: {},
      browserExecutable: chromePath,
      concurrency,
      onStart: () => {},
      onFrameUpdate: () => {},
    })

    // Clear old frames in squeeze sequence directory
    for (const oldFile of await fs.readdir(squeezeSeqDir)) {
      if (oldFile.endsWith('.webp')) await fs.unlink(path.join(squeezeSeqDir, oldFile))
    }

    const frameFiles = (await fs.readdir(framesDir)).filter(f => f.endsWith('.png')).sort()
    for (let i = 0; i < frameFiles.length; i += 1) {
      const idxName = `${String(i + 1).padStart(4, '0')}.webp`
      await sharp(path.join(framesDir, frameFiles[i]))
        .webp({ quality: 76 })
        .toFile(path.join(squeezeSeqDir, idxName))
    }

    // Rename or pass sequential pattern for ffmpeg (Remotion writes element-0.png / 0000.png or element-00.png)
    const seqTempDir = path.join(tmpRoot, 'squeeze-seq-numbered')
    await fs.mkdir(seqTempDir, { recursive: true })
    for (let i = 0; i < frameFiles.length; i += 1) {
      await fs.copyFile(
        path.join(framesDir, frameFiles[i]),
        path.join(seqTempDir, `${String(i + 1).padStart(4, '0')}.png`),
      )
    }

    const rawMp4 = path.join(tmpRoot, 'squeeze-raw.mp4')
    runFfmpeg(
      [
        '-framerate',
        String(comp.fps),
        '-i',
        path.join(seqTempDir, '%04d.png'),
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-crf',
        '18',
        '-an',
        rawMp4,
      ],
      'squeeze raw',
    )
    await encodeMp4AndWebm(
      rawMp4,
      path.join(videoRoot, 'squeeze.mp4'),
      path.join(videoRoot, 'squeeze.webm'),
      '22',
      '34',
    )
    const posterSrc = path.join(seqTempDir, `${String(Math.min(frameFiles.length, 44)).padStart(4, '0')}.png`)
    await sharp(posterSrc).webp({ quality: 82 }).toFile(path.join(videoRoot, 'squeeze-poster.webp'))
    console.log(`SqueezeSequence complete: ${frameFiles.length} WebP frames + squeeze.mp4/webm + poster`)
  }

  if (shouldRun('flavour')) {
    console.log('Rendering FlavourReel (12s, 720x1280)...')
    const comp = await selectComposition({ serveUrl, id: 'FlavourReel', browserExecutable: chromePath })
    const rawMp4 = path.join(tmpRoot, 'flavour-reel-raw.mp4')
    await renderMedia({
      composition: comp,
      serveUrl,
      codec: 'h264',
      outputLocation: rawMp4,
      overwrite: true,
      crf: 18,
      pixelFormat: 'yuv420p',
      browserExecutable: chromePath,
      concurrency,
    })
    await encodeMp4AndWebm(
      rawMp4,
      path.join(videoRoot, 'flavour-reel.mp4'),
      path.join(videoRoot, 'flavour-reel.webm'),
      '23',
      '35',
    )
    await renderPoster(serveUrl, comp, 20, path.join(videoRoot, 'flavour-reel-poster.webp'), tmpRoot)
    console.log('FlavourReel complete')
  }

  if (shouldRun('drop')) {
    console.log('Rendering DropReel (6s, 864x1080)...')
    const comp = await selectComposition({ serveUrl, id: 'DropReel', browserExecutable: chromePath })
    const rawMp4 = path.join(tmpRoot, 'drop-reel-raw.mp4')
    await renderMedia({
      composition: comp,
      serveUrl,
      codec: 'h264',
      outputLocation: rawMp4,
      overwrite: true,
      crf: 18,
      pixelFormat: 'yuv420p',
      browserExecutable: chromePath,
      concurrency,
    })
    await encodeMp4AndWebm(
      rawMp4,
      path.join(videoRoot, 'drop-reel.mp4'),
      path.join(videoRoot, 'drop-reel.webm'),
      '23',
      '35',
    )
    await renderPoster(serveUrl, comp, 125, path.join(videoRoot, 'drop-reel-poster.webp'), tmpRoot)
    console.log('DropReel complete')
  }

  if (shouldRun('aura')) {
    for (const f of FLAVOURS) {
      const id = `AuraLoop-${f}`
      console.log(`Rendering ${id} (4s, 1280x720)...`)
      const comp = await selectComposition({ serveUrl, id, browserExecutable: chromePath })
      const rawMp4 = path.join(tmpRoot, `${id}-raw.mp4`)
      await renderMedia({
        composition: comp,
        serveUrl,
        codec: 'h264',
        outputLocation: rawMp4,
        overwrite: true,
        crf: 19,
        pixelFormat: 'yuv420p',
        browserExecutable: chromePath,
        concurrency,
      })
      await encodeMp4AndWebm(
        rawMp4,
        path.join(auraLoopsDir, `${f}.mp4`),
        path.join(auraLoopsDir, `${f}.webm`),
        '24',
        '36',
      )
      await renderPoster(serveUrl, comp, 30, path.join(auraLoopsDir, `${f}-poster.webp`), tmpRoot)
    }
    console.log('All 6 AuraLoops complete')
  }
} finally {
  await fs.rm(tmpRoot, { recursive: true, force: true })
}
