import type { DeviceTier, SqueezeAnchors } from '../types/mochi'
import { flavours } from '../brand'
import MochiTube3D from './MochiTube3D'

export type SqueezeScene3DProps = {
  progress?: number
  reducedMotion?: boolean
  tier?: DeviceTier
  onAnchors?: (anchors: SqueezeAnchors) => void
  className?: string
}

const cherry = flavours[0]

/**
 * Interactive Cherry 3D squeeze tube (exposed = true, detached milky cap beside base,
 * glossy bead on slanted applicator nozzle).
 * Scroll progress (0..1) drives middle pinch, volume-preserving squash, nozzle bead swell,
 * and release wobble; pointer press dents at exact raycast height + tilts on heavy spring.
 */
export default function SqueezeScene3D({
  progress = 0,
  reducedMotion = false,
  tier = 'high',
  onAnchors,
  className = '',
}: SqueezeScene3DProps) {
  return (
    <MochiTube3D
      colour={cherry.jelly}
      aura={cherry.aura}
      exposed={true}
      reducedMotion={reducedMotion}
      tier={tier}
      externalSqueeze={progress}
      dragMode="tilt"
      onAnchors={onAnchors}
      fallbackSrc="/media/cutouts/mochi-cherry.webp"
      fallbackAlt="Cherry MOCHI lip jelly tube"
      ariaLabel="Interactive Cherry MOCHI lip jelly tube"
      className={`squeeze-scene-3d ${className}`.trim()}
    />
  )
}
