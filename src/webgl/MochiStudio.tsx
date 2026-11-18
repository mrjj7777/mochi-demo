import { memo, useMemo } from 'react'
import * as THREE from 'three'
import { Environment, Lightformer } from '@react-three/drei'

export type MochiStudioEnvProps = {
  aura?: string
  intensity?: number
}

/**
 * Studio Lightformer environment matching the soft upper-left 2x2 window softbox
 * and warm cream paper bounce seen in MOCHI_*_PK.png photography.
 */
export const MochiStudioEnv = memo(function MochiStudioEnv({
  aura = '#F2EDE4',
  intensity = 1.12,
}: MochiStudioEnvProps) {
  const rimTint = useMemo(
    () => `#${new THREE.Color('#FFFBF5').lerp(new THREE.Color(aura), 0.16).getHexString()}`,
    [aura],
  )

  return (
    <Environment resolution={256} frames={1} environmentIntensity={intensity}>
      {/* Broad studio ambient dome fill so silicone edges never go dark */}
      <Lightformer
        form="rect"
        intensity={1.25}
        color="#FAF7F2"
        position={[0, 6, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[14, 14, 1]}
      />

      {/* Signature 2x2 window softbox upper-left (visible on cap & left shoulder) */}
      <Lightformer
        form="rect"
        intensity={3.8}
        color="#FFFDF8"
        position={[-3.45, 3.85, 3.6]}
        target={[0, 0.3, 0]}
        scale={[1.05, 1.55, 1]}
      />
      <Lightformer
        form="rect"
        intensity={3.8}
        color="#FFFDF8"
        position={[-2.25, 3.85, 4.0]}
        target={[0, 0.3, 0]}
        scale={[1.05, 1.55, 1]}
      />
      <Lightformer
        form="rect"
        intensity={3.5}
        color="#FFFDF8"
        position={[-3.45, 2.05, 3.6]}
        target={[0, 0.3, 0]}
        scale={[1.05, 1.55, 1]}
      />
      <Lightformer
        form="rect"
        intensity={3.5}
        color="#FFFDF8"
        position={[-2.25, 2.05, 4.0]}
        target={[0, 0.3, 0]}
        scale={[1.05, 1.55, 1]}
      />

      {/* Long vertical edge rim along left silicone curve */}
      <Lightformer
        form="rect"
        intensity={2.8}
        color="#FAF7F2"
        position={[-5.2, 0.3, 1.4]}
        target={[0, 0, 0]}
        scale={[0.95, 7.2, 1]}
      />

      {/* Rear translucent backlight panel + flanking rim panels so inner jelly glows luminously */}
      <Lightformer
        form="rect"
        intensity={3.8}
        color={rimTint}
        position={[0.1, 0.8, -4.6]}
        target={[0, 0, 0]}
        scale={[9.5, 8.5, 1]}
      />
      <Lightformer
        form="rect"
        intensity={2.4}
        color="#FFF8F0"
        position={[-3.6, 0.4, -3.2]}
        target={[0, 0, 0]}
        scale={[3.5, 7.0, 1]}
      />
      <Lightformer
        form="rect"
        intensity={2.4}
        color="#FFF8F0"
        position={[3.6, 0.4, -3.2]}
        target={[0, 0, 0]}
        scale={[3.5, 7.0, 1]}
      />

      {/* Soft right side fill keeping right contour luminous */}
      <Lightformer
        form="rect"
        intensity={1.6}
        color="#F8F4EC"
        position={[4.8, 1.4, 2.4]}
        target={[0, 0, 0]}
        scale={[3.5, 6.4, 1]}
      />

      {/* Warm cream tabletop paper bounce underneath */}
      <Lightformer
        form="rect"
        intensity={1.25}
        color="#F2EDE4"
        position={[0, -4.5, 0.5]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[12, 12, 1]}
      />
    </Environment>
  )
})
