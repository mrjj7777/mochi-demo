import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputArg = process.argv.find((value) => value.startsWith('--out='))?.slice(6) ?? '_qa/before'
const output = path.resolve(root, outputArg)
const url = process.env.MOCHI_URL ?? 'http://127.0.0.1:5173/'
const sectionIds = ['hero', 'belief', 'squeeze', 'flavours', 'texture', 'lookbook', 'stand', 'all-six', 'wallpapers']
const viewports = [
  { name: '1440', width: 1440, height: 900 },
  { name: '1920', width: 1920, height: 1080 },
  { name: '390', width: 390, height: 844 },
]

await fs.rm(output, { recursive: true, force: true })
await fs.mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' })
const consoleErrors = []
const consoleWarnings = []
const metrics = []

async function waitForPage(page) {
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts?.ready)
  await page.waitForTimeout(650)
}

for (const viewport of viewports) {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 })
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(`${viewport.name}: ${message.text()}`)
    if (message.type() === 'warning') consoleWarnings.push(`${viewport.name}: ${message.text()}`)
  })
  page.on('pageerror', (error) => consoleErrors.push(`${viewport.name}: ${error.message}`))
  await waitForPage(page)
  await page.screenshot({ path: path.join(output, `page-${viewport.name}.png`), fullPage: true })
  for (const id of sectionIds) {
    const section = page.locator(`#${id}`)
    await section.scrollIntoViewIfNeeded()
    await page.waitForTimeout(220)
    await section.screenshot({ path: path.join(output, `${id}-${viewport.name}.png`) })
  }
  const audit = await page.evaluate((ids) => {
    const elements = ids.map((id) => document.getElementById(id)).filter(Boolean)
    const body = document.body
    return {
      width: window.innerWidth,
      height: window.innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      bodyWidth: body.scrollWidth,
      sections: elements.map((element) => ({ id: element.id, height: Math.round(element.getBoundingClientRect().height) })),
      fontsReady: document.fonts?.status ?? 'unknown',
    }
  }, sectionIds)
  metrics.push(audit)
  await page.close()
}

const recordContext = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: output, size: { width: 1440, height: 900 } },
})
const recordPage = await recordContext.newPage()
await waitForPage(recordPage)
const end = Date.now() + 12000
while (Date.now() < end) {
  await recordPage.evaluate(() => window.scrollBy({ top: Math.max(320, window.innerHeight * 0.62), behavior: 'smooth' }))
  await recordPage.waitForTimeout(420)
  if (await recordPage.evaluate(() => window.scrollY + window.innerHeight >= document.body.scrollHeight - 12)) {
    await recordPage.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
  }
}
const recordedPath = await recordPage.video().path()
await recordPage.close()
await recordContext.close()
await fs.copyFile(recordedPath, path.join(output, 'scroll-1440.webm'))

await fs.writeFile(path.join(output, 'audit.json'), JSON.stringify({ url, viewports, metrics, consoleErrors, consoleWarnings }, null, 2))
await browser.close()
console.log(JSON.stringify({ output, sections: sectionIds.length, viewports: viewports.map(({ name }) => name), errors: consoleErrors.length, warnings: consoleWarnings.length }, null, 2))
