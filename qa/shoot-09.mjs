import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const phase = process.argv[2] || 'before'
const baseUrl = process.argv[3] || 'http://127.0.0.1:5174/'
const outDir = path.resolve('_qa', '09', phase)
fs.mkdirSync(outDir, { recursive: true })

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'

const viewports = [
  { name: 'desk-1440', width: 1440, height: 900, mobile: false },
  { name: 'mob-375', width: 375, height: 812, mobile: true },
]

const browser = await chromium.launch({
  executablePath: fs.existsSync(CHROME_PATH) ? CHROME_PATH : undefined,
  headless: true,
  args: [
    '--use-gl=angle',
    '--use-angle=d3d11',
    '--enable-webgl',
    '--ignore-gpu-blocklist',
  ],
})

const summary = { phase, baseUrl, capturedAt: new Date().toISOString(), viewports: {} }

for (const vp of viewports) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.mobile ? 2 : 1,
    hasTouch: vp.mobile,
    isMobile: vp.mobile,
  })
  const page = await context.newPage()
  const consoleErrors = []
  const pageErrors = []
  const failedRequests = []

  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', err => pageErrors.push(String(err)))
  page.on('response', res => {
    if (res.status() >= 400) failedRequests.push(`${res.status()} ${res.url()}`)
  })

  await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(1600)

  // Wait for preloader to clear if present
  await page
    .waitForFunction(() => document.body.classList.contains('is-ready'), { timeout: 6000 })
    .catch(() => {})
  await page.waitForTimeout(500)

  const metrics = await page.evaluate(async () => {
    await document.fonts.ready
    const loadedFonts = Array.from(document.fonts)
      .filter(f => f.status === 'loaded')
      .map(f => `${f.family} (${f.weight} ${f.style})`)

    const navLinks = Array.from(document.querySelectorAll('.site-nav button, .site-nav .bag')).map(el =>
      (el.textContent || '').trim(),
    )

    const preloader = document.querySelector('.preloader')
    const preloaderVisible = preloader
      ? getComputedStyle(preloader).display !== 'none' && getComputedStyle(preloader).visibility !== 'hidden'
      : false

    const sectionIds = Array.from(document.querySelectorAll('main > section, main > .pin-spacer > section, footer')).map(
      el => el.id || el.tagName.toLowerCase(),
    )

    let minFontSize = 999
    let smallestText = ''
    for (const el of document.querySelectorAll('h1,h2,h3,p,span,a,button,figcaption')) {
      const style = getComputedStyle(el)
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) continue
      const rect = el.getBoundingClientRect()
      if (rect.width < 1 || rect.height < 1) continue
      const text = (el.textContent || '').trim()
      if (!text) continue
      const size = parseFloat(style.fontSize)
      if (size > 0 && size < minFontSize) {
        minFontSize = size
        smallestText = `${size}px: "${text.slice(0, 40)}" (.${Array.from(el.classList).join('.')})`
      }
    }

    return {
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      overflowX: document.documentElement.scrollWidth - window.innerWidth,
      loadedFonts: [...new Set(loadedFonts)],
      navLinks,
      preloaderVisible,
      sectionIds,
      minFontSize,
      smallestText,
    }
  })

  // Capture hero at rest (top = 0)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(450)
  await page.screenshot({ path: path.join(outDir, `01-hero-rest-${vp.name}.png`) })

  // Capture hero mid-scroll (headline visible)
  await page.evaluate(() => window.scrollTo(0, Math.round(window.innerHeight * 0.85)))
  await page.waitForTimeout(550)
  await page.screenshot({ path: path.join(outDir, `01b-hero-mid-${vp.name}.png`) })

  // Capture every section by scrolling to its anchor / pin-spacer top
  const sectionTargets = [
    { key: '02-belief', selector: '#belief', extraOffsetRatio: 0.45 },
    { key: '03-flavours', selector: '#flavours', extraOffsetRatio: 0.02 },
    { key: '04-texture', selector: '#texture', extraOffsetRatio: 0 },
    { key: '05-lookbook', selector: '#lookbook', extraOffsetRatio: 0.15 },
    { key: '06-stand', selector: '#stand', extraOffsetRatio: 0 },
    { key: '07-wallpapers', selector: '#wallpapers', extraOffsetRatio: 0 },
    { key: '08-footer', selector: 'footer.footer', extraOffsetRatio: 0 },
  ]

  const captured = []
  for (const target of sectionTargets) {
    const pos = await page.evaluate(({ selector, extraOffsetRatio }) => {
      const el = document.querySelector(selector)
      if (!el) return null
      const host = el.closest('.pin-spacer') || el
      const rect = host.getBoundingClientRect()
      const top = window.scrollY + rect.top
      const h = rect.height
      return { top, h, scrollTo: Math.round(top + Math.min(h * extraOffsetRatio, window.innerHeight * 0.9)) }
    }, target)

    if (!pos) continue
    await page.evaluate(y => window.scrollTo(0, y), pos.scrollTo)
    await page.waitForTimeout(650)

    // On texture desktop, move mouse into the photo to show the loupe
    if (target.key === '04-texture' && !vp.mobile) {
      await page.mouse.move(vp.width * 0.54, vp.height * 0.56, { steps: 6 })
      await page.waitForTimeout(350)
    }

    const file = `${target.key}-${vp.name}.png`
    await page.screenshot({ path: path.join(outDir, file) })
    captured.push(file)
  }

  // Test campaign gallery stats + interactive checks
  const galleryStats = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('#lookbook .campaign-strip__img'))
    const captions = Array.from(document.querySelectorAll('#lookbook .campaign-strip__caption')).map(el =>
      (el.textContent || '').trim(),
    )
    const wpImgs = Array.from(document.querySelectorAll('#wallpapers .wp-item__img'))
    const wpLabels = Array.from(document.querySelectorAll('#wallpapers .wp-item__label')).map(el =>
      (el.textContent || '').trim(),
    )
    const wpDownloads = Array.from(document.querySelectorAll('#wallpapers .wp-item__download')).map(el =>
      (el.textContent || '').trim(),
    )
    const roundedEls = Array.from(document.querySelectorAll('main *, header *, footer *')).filter(el => {
      const s = getComputedStyle(el)
      return s.borderRadius && s.borderRadius !== '0px'
    }).length
    const shadowedEls = Array.from(document.querySelectorAll('main *, header *, footer *')).filter(el => {
      const s = getComputedStyle(el)
      return s.boxShadow && s.boxShadow !== 'none'
    }).length

    return {
      count: imgs.length,
      nonZeroRadius: imgs.filter(img => getComputedStyle(img).borderRadius !== '0px').length,
      filtered: imgs.filter(img => {
        const f = getComputedStyle(img).filter
        return f && f !== 'none'
      }).length,
      firstCaption: captions[0] || '',
      lastCaption: captions[captions.length - 1] || '',
      captionsCount: captions.length,
      wallpapersCount: wpImgs.length,
      wpLabels,
      wpDownloads,
      roundedEls,
      shadowedEls,
    }
  })

  // Test interactive checks on desktop
  let interactions = null
  if (!vp.mobile && phase === 'after') {
    // 1. Nav turns light over #texture
    const texPos = await page.evaluate(() => {
      const el = document.querySelector('#texture')
      return el ? Math.round(window.scrollY + el.getBoundingClientRect().top + 120) : 0
    })
    await page.evaluate(y => window.scrollTo(0, y), texPos)
    await page.waitForTimeout(350)
    const navLightOverTexture = await page.evaluate(() =>
      document.querySelector('.site-nav')?.classList.contains('site-nav--light') ?? false,
    )

    // 2. Open campaign lightbox (via VIEW FULL button) and capture it cleanly above nav
    const galPos = await page.evaluate(() => {
      const el = document.querySelector('#lookbook')
      const host = el?.closest('.pin-spacer') || el
      return host ? Math.round(window.scrollY + host.getBoundingClientRect().top + 120) : 0
    })
    await page.evaluate(y => window.scrollTo(0, y), galPos)
    await page.waitForTimeout(550)
    await page.screenshot({ path: path.join(outDir, `05-lookbook-${vp.name}.png`) })
    await page.click('.campaign-gallery__inspect')
    await page.waitForTimeout(350)
    const lightboxCaption = await page.evaluate(
      () => document.querySelector('.campaign-lightbox__caption')?.textContent?.trim() || '',
    )
    await page.screenshot({ path: path.join(outDir, `05b-lightbox-${vp.name}.png`) })
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)
    const lightboxClosed = await page.evaluate(() => !document.querySelector('.campaign-lightbox'))

    // 2b. Capture Hero -> Belief bottom shutter transition
    await page.evaluate(() => window.scrollTo(0, Math.round(window.innerHeight * 2.15)))
    await page.waitForTimeout(450)
    await page.screenshot({ path: path.join(outDir, `01c-hero-shutter-${vp.name}.png`) })

    // 3. Test flavour tube press squish + cap pop
    const flavPos = await page.evaluate(() => {
      const el = document.querySelector('#flavours')
      const host = el?.closest('.pin-spacer') || el
      return host ? Math.round(window.scrollY + host.getBoundingClientRect().top + 40) : 0
    })
    await page.evaluate(y => window.scrollTo(0, y), flavPos)
    await page.waitForTimeout(450)
    const tubeBox = await page.locator('#flavours .flavour-tube').first().boundingBox()
    let capPopTransform = ''
    if (tubeBox) {
      await page.mouse.move(tubeBox.x + tubeBox.width / 2, tubeBox.y + tubeBox.height / 2)
      await page.mouse.down()
      await page.waitForTimeout(260)
      capPopTransform = await page.evaluate(
        () => document.querySelector('#flavours .flavour-tube__cap')?.style.transform || '',
      )
      await page.mouse.up()
      await page.waitForTimeout(200)
    }

    // 4. Test dedicated multi-page navigation: FLAVOURS -> WALLPAPERS -> BAG
    await page.click('.site-nav nav button:nth-child(1)')
    await page.waitForTimeout(750)
    const flavoursPageTitle = await page.evaluate(() => document.querySelector('.fp-heading')?.textContent?.trim() || '')
    await page.click('.fp-add-btn')
    await page.waitForTimeout(200)
    await page.screenshot({ path: path.join(outDir, `09-page-flavours-${vp.name}.png`) })

    await page.click('.site-nav nav button:nth-child(2)')
    await page.waitForTimeout(750)
    const wallpapersPageTitle = await page.evaluate(() => document.querySelector('.wpp-heading')?.textContent?.trim() || '')
    await page.screenshot({ path: path.join(outDir, `10-page-wallpapers-${vp.name}.png`) })

    await page.click('.site-nav nav button:nth-child(3)')
    await page.waitForTimeout(750)
    const bagPageTitle = await page.evaluate(() => document.querySelector('.bag-heading')?.textContent?.trim() || '')
    await page.click('.bag-perk__toggle')
    await page.waitForTimeout(200)
    await page.screenshot({ path: path.join(outDir, `11-page-bag-${vp.name}.png`) })

    // Navigate cleanly back to Home
    await page.click('.site-nav .nav-brand')
    await page.waitForTimeout(750)

    interactions = {
      navLightOverTexture,
      lightboxCaption,
      lightboxClosed,
      capPopTransform,
      flavoursPageTitle,
      wallpapersPageTitle,
      bagPageTitle,
    }
  }

  summary.viewports[vp.name] = {
    metrics,
    galleryStats,
    interactions,
    captured,
    consoleErrors,
    pageErrors,
    failedRequests,
  }

  await context.close()
}

await browser.close()
fs.writeFileSync(path.join(outDir, 'audit.json'), JSON.stringify(summary, null, 2))
console.log(JSON.stringify(summary, null, 2))
