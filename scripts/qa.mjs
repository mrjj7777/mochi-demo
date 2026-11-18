import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const qa = path.join(root, 'qa')
const sectionsDir = path.join(qa, 'sections')
await fs.mkdir(sectionsDir, { recursive: true })

const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' })
const errors = []
const warnings = []
const sectionIds = ['hero', 'belief', 'squeeze', 'flavours', 'texture', 'lookbook', 'stand', 'all-six', 'wallpapers']
const widths = [390, 768, 1280, 1440, 1920]

for (const width of widths) {
  const page = await browser.newPage({ viewport: { width, height: 864 }, deviceScaleFactor: 1 })
  page.on('console', message => { if (message.type() === 'error') errors.push(`${width}: ${message.text()}`); if (message.type() === 'warning') warnings.push(`${width}: ${message.text()}`) })
  page.on('pageerror', error => errors.push(`${width}: ${error.message}`))
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(650)
  await page.screenshot({ path: path.join(qa, `page-${width}.png`), fullPage: true })
  if (width === 1440) {
    for (const id of sectionIds) {
      await page.evaluate(sectionId => {
        const section = document.getElementById(sectionId)
        window.scrollTo(0, section?.offsetTop ?? 0)
      }, id)
      await page.waitForTimeout(1800)
      await page.screenshot({ path: path.join(sectionsDir, `${id}-1440.png`) })
    }
  }
  await page.close()
}

const reducedPage = await browser.newPage({ viewport: { width: 1440, height: 864 }, reducedMotion: 'reduce' })
reducedPage.on('console', message => { if (message.type() === 'error') errors.push(`reduced: ${message.text()}`); if (message.type() === 'warning') warnings.push(`reduced: ${message.text()}`) })
reducedPage.on('pageerror', error => errors.push(`reduced: ${error.message}`))
await reducedPage.emulateMedia({ reducedMotion: 'reduce' })
await reducedPage.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
await reducedPage.waitForTimeout(650)
await reducedPage.screenshot({ path: path.join(qa, 'reduced-motion-1440.png'), fullPage: true })
await reducedPage.close()

const recordContext = await browser.newContext({ viewport: { width: 1440, height: 864 }, recordVideo: { dir: qa, size: { width: 1440, height: 864 } } })
const recordPage = await recordContext.newPage()
await recordPage.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
await recordPage.waitForTimeout(650)
const end = Date.now() + 45000
while (Date.now() < end) {
  await recordPage.evaluate(() => window.scrollBy({ top: Math.max(280, window.innerHeight * .42), behavior: 'smooth' }))
  await recordPage.waitForTimeout(1350)
  if (await recordPage.evaluate(() => window.scrollY + window.innerHeight >= document.body.scrollHeight - 10)) await recordPage.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
}
const videoPath = await (await recordPage.video()).path()
await recordPage.close()
await recordContext.close()
const finalVideo = path.join(qa, 'scroll-1440.webm')
await fs.copyFile(videoPath, finalVideo)

await fs.writeFile(path.join(qa, 'console.json'), JSON.stringify({ errors, warnings }, null, 2))
console.log(JSON.stringify({ widths, sections: sectionIds.length, errors: errors.length, warnings: warnings.length, video: finalVideo }, null, 2))
await browser.close()
