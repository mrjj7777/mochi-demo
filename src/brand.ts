import tokenData from '../docs/design/tokens.json'
import type { Flavour, FlavourKey } from './types/mochi'

export type { Flavour, FlavourKey }

export const flavours: Flavour[] = tokenData.flavours.map(flavour => ({
  key: flavour.key as FlavourKey,
  asset: flavour.key,
  name: flavour.name,
  mood: flavour.mood,
  jelly: flavour.jelly,
  aura: flavour.aura,
  index: flavour.index,
}))

export const wallpaperSize = tokenData.wallpapers.size
export const wallpaperFileSize = wallpaperSize.replace(' × ', 'x')

export const TOKENS = tokenData
