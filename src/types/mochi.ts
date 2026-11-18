export type FlavourKey = 'cherry' | 'peach' | 'lychee' | 'grape' | 'mint' | 'mango'

export type Flavour = {
  key: FlavourKey
  asset: string
  name: string
  mood: string
  jelly: string
  aura: string
  index: string
}

export type DeviceTier = 'high' | 'mid' | 'low'

export type SqueezeAnchors = {
  top: [number, number]
  middle: [number, number]
  nozzle: [number, number]
  cap: [number, number]
}

export type SharedSectionProps = {
  reduced: boolean
  tier: DeviceTier
}
