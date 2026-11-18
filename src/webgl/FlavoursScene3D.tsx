import type { DeviceTier, Flavour } from '../types/mochi'
import MochiTube3D from './MochiTube3D'

export type FlavoursScene3DProps = {
  flavour: Flavour
  reducedMotion?: boolean
  tier?: DeviceTier
  className?: string
}

/**
 * Centered capped 3D MOCHI tube for the Flavours stage (exposed = false).
 * Changing flavour pours the new attenuation & jelly colour upward from base to nozzle
 * with a wavy meniscus over ~0.85s; horizontal drag spins with heavy spring inertia & ±35° rubber-band.
 */
export default function FlavoursScene3D({
  flavour,
  reducedMotion = false,
  tier = 'high',
  className = '',
}: FlavoursScene3DProps) {
  return (
    <MochiTube3D
      colour={flavour.jelly}
      aura={flavour.aura}
      exposed={false}
      reducedMotion={reducedMotion}
      tier={tier}
      dragMode="spin35"
      fallbackSrc={`/media/cutouts/mochi-${flavour.asset}.webp`}
      fallbackAlt={`${flavour.name} MOCHI lip jelly tube`}
      ariaLabel={`${flavour.name} — ${flavour.mood} MOCHI lip jelly tube`}
      className={`flavours-scene-3d ${className}`.trim()}
    />
  )
}
