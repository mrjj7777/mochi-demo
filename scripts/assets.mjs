import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceRoot = 'C:\\Users\\mrjj7\\Desktop\\ADS-CAMPAIGN\\SOFT CHAOS\\01_mochi'
const deliveredAssetRoot = 'C:\\Users\\mrjj7\\Desktop\\MOCHI LIP GLOSS'
const sourceDirs = [deliveredAssetRoot, path.join(sourceRoot, 'site'), path.join(sourceRoot, 'raw')]
const mediaRoot = path.join(projectRoot, 'public', 'media')
const log = []

for (const dir of ['cutouts', 'photos', 'sequence', 'sequence/squeeze', 'video', 'wallpapers', 'og']) await fs.mkdir(path.join(mediaRoot, dir), { recursive: true })

let sharp = null
try { sharp = (await import('sharp')).default } catch { log.push('sharp missing, source files copied without conversion') }

async function findSource(names) {
  for (const dir of sourceDirs) {
    for (const name of names) {
      for (const ext of ['', '.png', '.jpg', '.jpeg', '.webp']) {
        const candidate = path.join(dir, `${name}${ext}`)
        try { await fs.access(candidate); return candidate } catch { /* try next */ }
      }
    }
  }
  return null
}

async function writePlaceholder(target) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900"><rect width="1200" height="900" fill="#f2ede4"/><circle cx="600" cy="430" r="235" fill="#2fa4a8" opacity=".38"/><rect x="540" y="220" width="120" height="410" rx="55" fill="#b3122e" opacity=".9"/><circle cx="600" cy="210" r="56" fill="#faf7f2"/><text x="600" y="760" fill="#141414" text-anchor="middle" font-family="Arial" font-size="22" letter-spacing="4">MOCHI</text></svg>`
  if (target.endsWith('.png') && sharp) await sharp(Buffer.from(svg)).resize(1290, 2796).png().toFile(target)
  else await fs.writeFile(target, svg)
}

async function copyOptimised(source, target) {
  if (!source) { await writePlaceholder(target.replace(/\.webp$/, '.svg')); log.push(`missing: ${path.basename(target)}`); return }
  if (sharp) await sharp(source).resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 86 }).toFile(target)
  else await fs.copyFile(source, target.replace(/\.webp$/, '.png'))
}

const models = [
  ['mochi-peach-model.webp', ['MOCHI_PEACH_MODEL', 'MOCHI_M1']],
  ['mochi-model-1.webp', ['MOCHI_CHERRY_MODEL', 'MOCHI_M2']],
  ['mochi-model-2.webp', ['MOCHI_MINT_MODEL', 'MOCHI_M3']],
  ['mochi-model-3.webp', ['MOCHI_GRAPE_MODEL', 'MOCHI_M4']],
  ['mochi-model-4.webp', ['MOCHI_LYCHEE_MODEL', 'MOCHI_M5']],
  ['mochi-model-5.webp', ['MOCHI_MANGO_MODEL', 'MOCHI_N01']],
  ['mochi-diptych-cherry.webp', ['MOCHI_DIPTYCH_CHERRY', 'MOCHI_N02']],
  ['mochi-diptych-lychee.webp', ['MOCHI_DIPTYCH_LYCHEE']],
  ['mochi-all-row.webp', ['MOCHI_ALL_ROW']],
  ['mochi-hero-wide.webp', ['MOCHI_HERO_WIDE']],
  ['mochi-blob-stand.webp', ['MOCHI_BLOB_STAND']],
  ['mochi-all-pile.webp', ['MOCHI_ALL_PILE', 'MOCHI_N03']],
]
for (const [target, names] of models) await copyOptimised(await findSource(names), path.join(mediaRoot, 'photos', target))

for (const flavour of ['cherry', 'peach', 'lychee', 'grape', 'mint', 'mango']) {
  const flavourKey = flavour.toUpperCase()
  const packshot = await findSource([`MOCHI_${flavourKey}_PK`, `MOCHI_${flavourKey}_AURA`])
  const aura = await findSource([`MOCHI_${flavourKey}_AURA`, `MOCHI_${flavourKey}_PK`])
  await copyOptimised(packshot, path.join(mediaRoot, 'cutouts', `mochi-${flavour}.webp`))
  await copyOptimised(aura, path.join(mediaRoot, 'cutouts', `mochi-${flavour}-aura.webp`))
  const wallpaper = path.join(mediaRoot, 'wallpapers', `mochi-${flavour}-1290x2796.png`)
  if (aura && sharp) await sharp(aura).resize(1290, 2796, { fit: 'cover' }).png({ compressionLevel: 9, palette: true, quality: 82 }).toFile(wallpaper)
  else await writePlaceholder(wallpaper)
}

await fs.writeFile(path.join(mediaRoot, 'manifest.json'), JSON.stringify({ generatedAt: new Date().toISOString(), log }, null, 2))
await fs.writeFile(path.join(projectRoot, 'asset-pipeline.log'), log.length ? log.join('\n') : 'all requested assets found')
console.log(log.length ? log.join('\n') : 'asset pipeline complete')
