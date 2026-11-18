import { chromium } from 'playwright'

const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' })
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
await page.evaluate(() => document.fonts?.ready)

await page.locator('#flavours').scrollIntoViewIfNeeded()
await page.locator('#flavours .flavour-dots button').nth(2).click()
const visibleName = await page.locator('.flavour-panel__name').evaluateAll(nodes => nodes.find(node => getComputedStyle(node).visibility !== 'hidden' && getComputedStyle(node).opacity !== '0')?.textContent?.trim() ?? null)
await page.locator('#flavours .add-pill').nth(2).click()
const bag = await page.locator('.bag').textContent()

await page.locator('#wallpapers').scrollIntoViewIfNeeded()
await page.locator('.wallpaper-card__open').first().click({ force: true })
const dialogVisible = await page.locator('.wallpaper-preview').isVisible()
await page.keyboard.press('ArrowRight')
const previewLabel = await page.locator('.wallpaper-preview__label').textContent()
await page.keyboard.press('Escape')
const dialogClosed = !(await page.locator('.wallpaper-preview').count())

const overflow = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }))
const flavourName = await page.locator('#flavours .flavour-dots button').nth(2).textContent()
console.log(JSON.stringify({ flavourName: flavourName?.trim(), visibleName, bag, dialogVisible, previewLabel, dialogClosed, overflow }, null, 2))
await browser.close()
