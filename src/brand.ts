import tokenData from '../docs/design/tokens.json'

export type Flavour = {
  key: string
  asset: string
  name: string
  mood: string
  jelly: string
  aura: string
  index: string
}

export const flavours: Flavour[] = tokenData.flavours.map(flavour => ({
  key: flavour.key,
  asset: flavour.key,
  name: flavour.name,
  mood: flavour.mood,
  jelly: flavour.jelly,
  aura: flavour.aura,
  index: flavour.index,
}))

export const wallpaperSize = tokenData.wallpapers.size
export const wallpaperFileSize = wallpaperSize.replace(' × ', 'x')
