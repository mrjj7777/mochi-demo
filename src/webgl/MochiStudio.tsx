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
  intensity = 0.96,
}: MochiStudioEnvProps) {
  const rimTint = useMemo(
    () => `#${new THREE.Color('#FFF8EE').lerp(new THREE.Color(aura), 0.22).getHexString()}`,
    [aura],
  )

  return (
    <Environment resolution={256} frames={1} environmentIntensity={intensity}>
      {/* Broad studio ambient dome fill so silicone edges never go dark */}
      <Lightformer
        form="rect"
        intensity={1.05}
        color="#F6F2EA"
        position={[0, 6, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[14, 14, 1]}
      />

      {/* Signature 2x2 window softbox upper-left (visible on cap & left shoulder) */}
      <Lightformer
        form="rect"
        intensity={3.6}
        color="#FFFDF8"
        position={[-3.45, 3.85, 3.6]}
        target={[0, 0.3, 0]}
        scale={[1.05, 1.55, 1]}
      />
      <Lightformer
        form="rect"
        intensity={3.6}
        color="#FFFDF8"
        position={[-2.25, 3.85, 4.0]}
        target={[0, 0.3, 0]}
        scale={[1.05, 1.55, 1]}
      />
      <Lightformer
        form="rect"
        intensity={3.3}
        color="#FFFDF8"
        position={[-3.45, 2.05, 3.6]}
        target={[0, 0.3, 0]}
        scale={[1.05, 1.55, 1]}
      />
      <Lightformer
        form="rect"
        intensity={3.3}
        color="#FFFDF8"
        position={[-2.25, 2.05, 4.0]}
        target={[0, 0.3, 0]}
        scale={[1.05, 1.55, 1]}
      />

      {/* Long vertical edge rim along left silicone curve */}
      <Lightformer
        form="rect"
        intensity={2.4}
        color="#FAF7F2"
        position={[-5.2, 0.3, 1.4]}
        target={[0, 0, 0]}
        scale={[0.85, 6.8, 1]}
      />

      {/* Rear translucent backlight panel so inner jelly glows from behind */}
      <Lightformer
        form="rect"
        intensity={2.5}
        color={rimTint}
        position={[0.2, 0.9, -4.8]}
        target={[0, 0, 0]}
        scale={[7.5, 6.8, 1]}
      />

      {/* Soft right side fill keeping right contour luminous */}
      <Lightformer
        form="rect"
        intensity={1.35}
        color="#F6F1E9"
        position={[4.8, 1.4, 2.4]}
        target={[0, 0, 0]}
        scale={[3.2, 6.0, 1]}
      />

      {/* Warm cream tabletop paper bounce underneath */}
      <Lightformer
        form="rect"
        intensity={1.1}
        color="#F2EDE4"
        position={[0, -4.5, 0.5]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[12, 12, 1]}
      />
    </Environment>
  )
})
