import fs from 'node:fs/promises'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { chromium } from 'playwright'

const root = path.resolve('C:/Users/mrjj7/Desktop/Portfolio-Demo-Sites/mochi-landing')
const output = path.join(root, '_qa/3d-vs-photo')
await fs.mkdir(output, { recursive: true })

const flavours = [
  ['cherry', 'CHERRY', '#B3122E'],
  ['peach', 'PEACH', '#E8A287'],
  ['lychee', 'LYCHEE', '#E5B7BF'],
  ['grape', 'GRAPE', '#6E4279'],
  ['mint', 'MINT', '#8AAE97'],
  ['mango', 'MANGO', '#D89B45'],
]

const pageMarkup = [
  '<!doctype html>',
  '<html><head><meta charset="utf-8"><style>',
  '@font-face { font-family: Krona; src: url("/fonts/krona-one-400-normal.ttf") format("truetype"); font-display: swap; }',
  ':root { background: #f2ede4; color: #151313; font-family: Krona, Arial, sans-serif; }',
  '* { box-sizing: border-box; }',
  'html, body { margin: 0; background: #f2ede4; }',
  'body { width: 1560px; padding: 22px; }',
  '#stage { display: grid; grid-template-columns: repeat(2, 760px); gap: 18px; }',
  '.pair { width: 760px; height: 760px; padding: 18px; border: 1px solid #d4c7bd; background: #ede6dd; }',
  '.pair h2 { margin: 0 0 12px; font-size: 20px; letter-spacing: .13em; font-weight: 400; }',
  '.pair-grid { height: 690px; display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }',
  '.visual { position: relative; height: 690px; display: flex; align-items: center; justify-content: center; overflow: hidden; background: #f7f2ea; border: 1px solid #ddd2c7; }',
  '.visual[data-kind="3d"] { background: linear-gradient(145deg,#f0e8e0 0%,#e9e0d7 58%,#ded2c9 100%); }',
  '.visual::after { content: attr(data-caption); position: absolute; left: 12px; bottom: 10px; font: 12px/1.1 Krona, Arial, sans-serif; letter-spacing: .11em; color: #514845; }',
  '.tube-mount { width: 100%; height: 100%; }',
  '.tube-mount .mochi-tube-3d { width: 100%; height: 100%; display: block; }',
  '.tube-mount canvas { width: 100%; height: 100%; display: block; }',
  '.photo { width: 100%; height: 100%; object-fit: contain; padding: 0; transform: scale(1.3); }',
  '</style></head><body><div id="stage"></div>',
  '<script type="module">',
  'const React = await import("/node_modules/.vite/deps/react.js")',
  'const ReactDOM = await import("/node_modules/.vite/deps/react-dom_client.js")',
  'const createElement = React.createElement || React.default.createElement',
  'const createRoot = ReactDOM.createRoot || ReactDOM.default.createRoot',
  'const module = await import("/src/components/MochiTube3D.tsx")',
  'const colours = ' + JSON.stringify(flavours),
  'const stage = document.querySelector("#stage")',
  'for (const [asset, label, colour] of colours) {',
  '  const pair = document.createElement("section")',
  '  pair.className = "pair"',
  '  pair.dataset.asset = asset',
  '  pair.innerHTML = "<h2>" + label + " · 3D / PHOTO</h2><div class=\\"pair-grid\\"><div class=\\"visual\\" data-kind=\\"3d\\" data-caption=\\"INTERACTIVE TUBE\\"><div class=\\"tube-mount\\"></div></div><div class=\\"visual\\" data-kind=\\"photo\\" data-caption=\\"CUTOUT PHOTO\\"><img class=\\"photo\\" alt=\\"" + label + " product photo\\" src=\\"/media/cutouts/mochi-" + asset + ".webp\\"></div></div>"',
  '  stage.append(pair)',
  '  const root = createRoot(pair.querySelector(".tube-mount"))',
  '  root.render(createElement(module.default, { colour, reducedMotion: false, ariaLabel: label + " interactive MOCHI lip jelly tube" }))',
  '}',
  'window.dispatchEvent(new Event("mochi-qa-mounted"))',
  '</script></body></html>',
].join('\n')

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
})
const errors = []
const page = await browser.newPage({ viewport: { width: 1560, height: 1000 }, deviceScaleFactor: 1 })
page.on('pageerror', error => errors.push('pageerror: ' + error.message))
page.on('console', message => { if (message.type() === 'error' && !message.text().includes('Failed to load resource')) errors.push('console: ' + message.text()) })
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
await page.setContent(pageMarkup, { waitUntil: 'networkidle' })
try {
  await page.waitForFunction(() => document.querySelectorAll('.mochi-tube-3d canvas[data-rendered="true"]').length === 6, null, { timeout: 30000 })
} catch (error) {
  console.error('3D QA mount failed', errors, (await page.locator('body').innerText()).slice(0, 500))
  throw error
}
await page.waitForTimeout(900)
const renderState = await page.evaluate(() => ({
  canvases: [...document.querySelectorAll('.mochi-tube-3d canvas')].map(canvas => ({
    rendered: canvas.dataset.rendered === 'true',
    width: canvas.width,
    height: canvas.height,
    failed: canvas.hidden,
  })),
  pairs: document.querySelectorAll('.pair').length,
}))
if (renderState.canvases.length !== 6 || renderState.canvases.some(canvas => !canvas.rendered || canvas.failed)) {
  throw new Error('3D QA did not render all six canvas instances: ' + JSON.stringify(renderState))
}
await page.screenshot({ path: path.join(output, 'contact-sheet.png'), fullPage: true })
for (const [asset] of flavours) {
  await page.locator('.pair[data-asset="' + asset + '"]').screenshot({ path: path.join(output, asset + '-3d-vs-photo.png') })
}
await page.locator('.pair[data-asset="cherry"] .visual[data-kind="3d"] canvas').screenshot({ path: path.join(output, 'cherry-3d-canvas.png') })

const videoContext = await browser.newContext({
  viewport: { width: 980, height: 760 },
  deviceScaleFactor: 1,
  recordVideo: { dir: output, size: { width: 980, height: 760 } },
})
const videoPage = await videoContext.newPage()
const videoErrors = []
videoPage.on('pageerror', error => videoErrors.push('pageerror: ' + error.message))
videoPage.on('console', message => { if (message.type() === 'error' && !message.text().includes('Failed to load resource')) videoErrors.push('console: ' + message.text()) })
await videoPage.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
await videoPage.setContent(pageMarkup, { waitUntil: 'networkidle' })
await videoPage.waitForFunction(() => document.querySelector('.pair[data-asset="cherry"] canvas[data-rendered="true"]'), null, { timeout: 30000 })
const videoCanvas = videoPage.locator('.pair[data-asset="cherry"] .visual[data-kind="3d"] canvas')
const videoBox = await videoCanvas.boundingBox()
if (!videoBox) throw new Error('Cherry canvas has no bounding box for interaction capture')
const start = Date.now()
await videoPage.mouse.move(videoBox.x + videoBox.width * 0.52, videoBox.y + videoBox.height * 0.57)
await videoPage.mouse.down()
for (let index = 0; index < 24; index += 1) {
  const phase = index / 23
  const x = videoBox.x + videoBox.width * (0.52 + 0.25 * Math.sin(phase * Math.PI * 2))
  const y = videoBox.y + videoBox.height * (0.55 + 0.16 * Math.sin(phase * Math.PI * 4))
  await videoPage.mouse.move(x, y, { steps: 3 })
  await videoPage.waitForTimeout(230)
}
await videoPage.mouse.up()
await videoPage.waitForTimeout(900)
const durationMs = Date.now() - start
const video = videoPage.video()
await videoContext.close()
const videoPath = await video.path()
const trimmedVideoPath = path.join(output, 'mochi-tube-interaction-trimmed.webm')
execFileSync('ffmpeg.exe', ['-y', '-sseof', '-8', '-i', videoPath, '-t', '8', '-c:v', 'libvpx-vp9', '-crf', '32', '-b:v', '0', trimmedVideoPath], { stdio: 'ignore' })
await fs.rename(trimmedVideoPath, path.join(output, 'mochi-tube-interaction.webm'))
await fs.rm(videoPath, { force: true })
await videoPage.close().catch(() => {})
await browser.close()

if (errors.length || videoErrors.length) throw new Error('Browser console errors: ' + [...errors, ...videoErrors].join(' | '))
console.log(JSON.stringify({
  output,
  renderState,
  interactionDurationMs: durationMs,
  interactionDurationSeconds: Number((durationMs / 1000).toFixed(2)),
  files: flavours.length + 4,
}, null, 2))
