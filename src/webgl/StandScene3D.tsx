import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { CuboidCollider, Physics, type RapierRigidBody, RigidBody } from '@react-three/rapier'
import { flavours } from '../brand'
import {
  PointerHistory,
  clamp,
  createSpring,
  projectMomentum,
  rubberBandClamp,
} from '../physics/spring'
import type { DeviceTier, Flavour } from '../types/mochi'
import { MochiStudioEnv } from './MochiStudio'
import {
  MOCHI_BODY_BASE,
  MochiTubeMesh,
  createDefaultDeformState,
} from './MochiTubeMesh'
import {
  auraShadowColor,
  canUseWebGL,
  getCappedDpr,
  getSoftShadowTexture,
  useViewportActive,
} from './webglUtils'

export type StandScene3DProps = {
  active?: boolean
  reducedMotion?: boolean
  tier?: DeviceTier
  onHoverFlavour?: (flavour: Flavour | null) => void
  className?: string
}

const SLOT_XS = [-2.9, -1.74, -0.58, 0.58, 1.74, 2.9]
const MAX_STAND_RAD = (35 * Math.PI) / 180
const WELL_FLOOR_Y = 0.22
const TUBE_START_Y = 3.8
const STAND_AURA = '#8FC3E6'

let sharedStandGeo: THREE.BufferGeometry | null = null

function spineZAt(x: number): number {
  const u = clamp(x / 3.8, -1, 1)
  return -0.14 * Math.cos(u * Math.PI * 0.85) + 0.07 * Math.sin(u * Math.PI * 1.25)
}

function buildBlobStandGeometry(): THREE.BufferGeometry {
  if (sharedStandGeo) return sharedStandGeo

  const geo = new THREE.SphereGeometry(1, 160, 80)
  const pos = geo.attributes.position
  const colors = new Float32Array(pos.count * 3)
  const creamCol = new THREE.Color('#FAF7F2')
  const aoCol = new THREE.Color('#E3DBD0')
  const tmpCol = new THREE.Color()

  for (let i = 0; i < pos.count; i += 1) {
    const ux = pos.getX(i)
    const uy = pos.getY(i)
    const uz = pos.getZ(i)

    // Smooth pillow stretch into organic peanut/pebble silhouette matching MOCHI_BLOB_STAND.png
    const px = ux * 3.84
    const lobeMod =
      1.0 +
      0.13 * Math.sin(ux * Math.PI * 1.15 - 0.3) -
      0.15 * Math.exp(-Math.pow((ux + 0.1) / 0.36, 2))
    const spineZ = spineZAt(px)
    const pz = uz * 1.08 * lobeMod + spineZ

    // Rounded ceramic pillow top and softly flattened stable underside
    let py =
      uy >= 0
        ? 0.56 * Math.pow(uy, 0.58)
        : -0.50 * Math.pow(Math.abs(uy), 0.58)

    let wellAo = 0
    // Carve 6 smooth recessed wells along the top surface
    if (uy > 0.08) {
      const topBlend = clamp((uy - 0.08) / 0.42, 0, 1)
      const smoothTop = topBlend * topBlend * (3 - 2 * topBlend)

      for (let k = 0; k < SLOT_XS.length; k += 1) {
        const sx = SLOT_XS[k]
        const sz = spineZAt(sx)
        const d = Math.hypot((px - sx) / 0.52, (pz - sz) / 0.45)
        if (d < 1.45) {
          const lipRim = 0.028 * Math.exp(-Math.pow((d - 1.06) / 0.16, 2))
          const cup = d < 1.0 ? -0.36 * Math.pow(1 - d * d, 1.32) : 0
          py += (cup + lipRim) * smoothTop
          if (d < 1.05) {
            wellAo = Math.max(wellAo, (1 - d / 1.05) * smoothTop)
          }
        }
      }
    }

    // Subtle underside contact darkening so ceramic weight reads clearly
    const bottomAo = uy < -0.25 ? clamp((-uy - 0.25) * 0.55, 0, 0.38) : 0
    tmpCol.copy(creamCol).lerp(aoCol, Math.max(wellAo * 0.85, bottomAo))
    colors[i * 3] = tmpCol.r
    colors[i * 3 + 1] = tmpCol.g
    colors[i * 3 + 2] = tmpCol.b

    pos.setXYZ(i, px, py, pz)
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  pos.needsUpdate = true
  geo.computeVertexNormals()
  sharedStandGeo = geo
  return geo
}

type StandInnerProps = {
  active: boolean
  tier: DeviceTier
  isActive: boolean
  onHoverFlavour?: (flavour: Flavour | null) => void
}

function StandStage({ active, tier, isActive, onHoverFlavour }: StandInnerProps) {
  const { camera, gl, size } = useThree()
  const standGeo = useMemo(() => buildBlobStandGeometry(), [])
  const shadowTex = useMemo(() => getSoftShadowTexture(), [])
  const shadowTint = useMemo(() => auraShadowColor(STAND_AURA, 0.45), [])

  const bodyRefs = useRef<(RapierRigidBody | null)[]>([])
  const tubeShadowRefs = useRef<(THREE.Mesh | null)[]>([])
  const deformRefs = useRef(flavours.map(() => createDefaultDeformState()))

  const squashSprings = useRef(flavours.map(() => createSpring('jelly', 1)))
  const wobbleSprings = useRef(flavours.map(() => createSpring('jelly', 0)))
  const liftSprings = useRef(flavours.map(() => createSpring('jelly', 0)))
  const hoverIndexRef = useRef<number | null>(null)
  const landedRef = useRef<boolean[]>(flavours.map(() => false))
  const releasedRef = useRef<boolean[]>(flavours.map(() => false))
  const dropStartAtRef = useRef<number | null>(null)

  const orbitSpring = useRef(createSpring('heavy', 0))
  const dragRef = useRef({ active: false, startX: 0, startOrbit: 0 })
  const historyRef = useRef(new PointerHistory(5))

  useEffect(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping
    gl.toneMappingExposure = 1.05
  }, [gl])

  // Drag anywhere on stand canvas -> heavy spring ±35° orbit with PointerHistory inertia
  useEffect(() => {
    const dom = gl.domElement
    const onDown = (e: PointerEvent) => {
      dragRef.current = {
        active: true,
        startX: e.clientX,
        startOrbit: orbitSpring.current.value,
      }
      orbitSpring.current.setTarget(orbitSpring.current.value)
      historyRef.current.reset()
      historyRef.current.add(e.clientX, e.clientY)
      try {
        dom.setPointerCapture(e.pointerId)
      } catch {
        // ignore
      }
    }
    const onMove = (e: PointerEvent) => {
      if (!dragRef.current.active) return
      historyRef.current.add(e.clientX, e.clientY)
      const dx = e.clientX - dragRef.current.startX
      const raw = dragRef.current.startOrbit - dx * 0.0048
      orbitSpring.current.setTarget(rubberBandClamp(raw, -MAX_STAND_RAD, MAX_STAND_RAD, 0.36))
    }
    const onUp = (e: PointerEvent) => {
      if (!dragRef.current.active) return
      dragRef.current.active = false
      const vel = -historyRef.current.velocity().x * 0.0045
      historyRef.current.reset()
      const boundedVel = clamp(vel, -6, 6)
      const projected = projectMomentum(orbitSpring.current.value, boundedVel)
      orbitSpring.current.setTarget(clamp(projected, -MAX_STAND_RAD, MAX_STAND_RAD))
      orbitSpring.current.setVelocity(boundedVel)
      try {
        if (dom.hasPointerCapture(e.pointerId)) dom.releasePointerCapture(e.pointerId)
      } catch {
        // ignore
      }
    }
    dom.addEventListener('pointerdown', onDown)
    dom.addEventListener('pointermove', onMove)
    dom.addEventListener('pointerup', onUp)
    dom.addEventListener('pointercancel', onUp)
    return () => {
      dom.removeEventListener('pointerdown', onDown)
      dom.removeEventListener('pointermove', onMove)
      dom.removeEventListener('pointerup', onUp)
      dom.removeEventListener('pointercancel', onUp)
    }
  }, [gl])

  useFrame((_, rawDelta) => {
    if (!isActive) return
    const dt = Math.min(0.05, Math.max(0.001, rawDelta))
    const nowMs = performance.now()

    if (active) {
      if (dropStartAtRef.current === null) dropStartAtRef.current = nowMs
      const wallElapsedSec = (nowMs - dropStartAtRef.current) / 1000
      for (let i = 0; i < flavours.length; i += 1) {
        if (!releasedRef.current[i] && wallElapsedSec >= i * 0.085) {
          const rb = bodyRefs.current[i]
          if (rb) {
            releasedRef.current[i] = true
            rb.setGravityScale(1, true)
            rb.wakeUp()
          }
        }
      }
    }

    const angle = orbitSpring.current.step(dt)
    const aspect = Math.max(0.45, size.width / Math.max(1, size.height))
    const camDist = aspect < 1.05 ? 14.5 / Math.max(0.55, aspect * 0.92) : 13.8
    camera.position.set(
      Math.sin(angle) * camDist,
      1.65,
      Math.cos(angle) * camDist,
    )
    camera.lookAt(0, 0.72, 0)

    const wallElapsed = dropStartAtRef.current !== null ? (nowMs - dropStartAtRef.current) / 1000 : 0
    for (let i = 0; i < flavours.length; i += 1) {
      const sq = squashSprings.current[i].step(dt)
      const wb = wobbleSprings.current[i].step(dt)
      const lift = liftSprings.current[i].step(dt)
      const d = deformRefs.current[i]
      d.squash = sq
      d.wobble = wb
      d.liftY = lift
      d.time += dt

      const rb = bodyRefs.current[i]
      if (rb && active && releasedRef.current[i]) {
        const pos = rb.translation()
        const vel = rb.linvel()
        const settledY = WELL_FLOOR_Y + 1.50
        if (wallElapsed > i * 0.085 + 0.65 && pos.y > settledY + 0.05 && Math.abs(vel.y) < 0.14) {
          rb.setLinvel({ x: 0, y: Math.min(vel.y, -2.5), z: 0 }, true)
          rb.wakeUp()
        }
      }
      const shadow = tubeShadowRefs.current[i]
      if (rb && shadow) {
        const pos = rb.translation()
        const tubeBottomY = pos.y + MOCHI_BODY_BASE + lift
        const clearance = clamp(tubeBottomY - WELL_FLOOR_Y, 0, 4.5)
        const tightness = 1 - clamp(clearance / 3.8, 0, 0.78)
        const s = 0.92 + (1 - tightness) * 0.65
        shadow.scale.set(s, s * 0.85, 1)
        shadow.position.set(pos.x, WELL_FLOOR_Y + 0.015, pos.z)
        const mat = shadow.material as THREE.MeshBasicMaterial
        mat.opacity = 0.36 * tightness
      }
    }
  })

  return (
    <>
      <MochiStudioEnv aura={STAND_AURA} intensity={0.96} />
      <hemisphereLight args={['#FAF7F2', '#DCE6ED', 0.95]} />
      <directionalLight color="#FFF8EE" intensity={1.15} position={[-4.5, 6.2, 5.4]} />
      <directionalLight color="#EEF5FA" intensity={0.55} position={[4.2, 2.2, -3.6]} />

      {/* Ground aura-tinted shadow beneath the milk-ceramic blob stand */}
      <mesh position={[0, -0.52, -0.05]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={0}>
        <planeGeometry args={[9.4, 3.8]} />
        <meshBasicMaterial
          map={shadowTex}
          color={shadowTint}
          transparent
          opacity={0.42}
          depthWrite={false}
        />
      </mesh>

      {/* Sculpted milk-ceramic organic blob stand */}
      <mesh geometry={standGeo} position={[0, 0, 0]} receiveShadow>
        <meshPhysicalMaterial
          vertexColors
          color="#FFFFFF"
          roughness={0.34}
          metalness={0}
          clearcoat={0.28}
          clearcoatRoughness={0.22}
          sheen={0.30}
          sheenColor="#FFFDF8"
          envMapIntensity={0.85}
        />
      </mesh>

      {/* Per-tube aura-tinted contact shadows inside each stand well */}
      {flavours.map((flavour, i) => (
        <mesh
          key={`shadow-${flavour.key}`}
          ref={el => {
            tubeShadowRefs.current[i] = el
          }}
          position={[SLOT_XS[i], WELL_FLOOR_Y + 0.015, spineZAt(SLOT_XS[i])]}
          rotation={[-Math.PI / 2, 0, 0]}
          renderOrder={1}
        >
          <planeGeometry args={[1.05, 0.88]} />
          <meshBasicMaterial
            map={shadowTex}
            color={shadowTint}
            transparent
            opacity={0}
            depthWrite={false}
          />
        </mesh>
      ))}

      <Physics gravity={[0, -16, 0]} paused={!isActive || !active} timeStep="vary">
        {/* Fixed stand slot well floors (1 RigidBody total; vertical slot guides keep tubes aligned) */}
        <RigidBody type="fixed" colliders={false} restitution={0.26} friction={0.4}>
          {SLOT_XS.map((sx, idx) => {
            const sz = spineZAt(sx)
            return (
              <CuboidCollider
                key={`slot-col-${idx}`}
                args={[0.50, 0.36, 0.46]}
                position={[sx, WELL_FLOOR_Y - 0.36, sz]}
              />
            )
          })}
        </RigidBody>

        {/* Six MOCHI tubes dropping under Rapier gravity into their matching ceramic wells */}
        {flavours.map((flavour, i) => {
          const sx = SLOT_XS[i]
          const sz = spineZAt(sx)
          return (
            <RigidBody
              key={flavour.key}
              ref={el => {
                bodyRefs.current[i] = el
              }}
              type="dynamic"
              colliders={false}
              canSleep
              ccd
              gravityScale={releasedRef.current[i] ? 1 : 0}
              position={[sx, TUBE_START_Y + i * 0.24, sz]}
              rotation={[0, 0, 0]}
              linearDamping={0.35}
              enabledTranslations={[false, true, false]}
              enabledRotations={[false, false, false]}
              restitution={0.26}
              friction={0.4}
              onCollisionEnter={() => {
                if (!landedRef.current[i]) {
                  landedRef.current[i] = true
                  squashSprings.current[i].addImpulse(-2.1)
                  wobbleSprings.current[i].addImpulse(2.4)
                } else {
                  const rb = bodyRefs.current[i]
                  if (rb) {
                    const vy = Math.abs(rb.linvel().y)
                    if (vy > 0.7) {
                      squashSprings.current[i].addImpulse(-clamp(vy * 0.35, 0.2, 1.4))
                      wobbleSprings.current[i].addImpulse(clamp(vy * 0.45, 0.3, 1.8))
                    }
                  }
                }
              }}
            >
              <CuboidCollider args={[0.38, 1.50, 0.32]} position={[0, 0, 0]} />
              <MochiTubeMesh
                colour={flavour.jelly}
                aura={STAND_AURA}
                exposed={false}
                tier={tier}
                transmissionMode="layered"
                deformRef={{ current: deformRefs.current[i] }}
                onPointerOverTube={e => {
                  e.stopPropagation()
                  if (hoverIndexRef.current !== i) {
                    hoverIndexRef.current = i
                    liftSprings.current[i].setTarget(0.42)
                    wobbleSprings.current[i].addImpulse(1.2)
                    onHoverFlavour?.(flavour)
                  }
                }}
                onPointerOutTube={e => {
                  e.stopPropagation()
                  liftSprings.current[i].setTarget(0)
                  if (hoverIndexRef.current === i) {
                    hoverIndexRef.current = null
                    onHoverFlavour?.(null)
                  }
                }}
              />
            </RigidBody>
          )
        })}
      </Physics>
    </>
  )
}

/**
 * Interactive 3D Milk-Ceramic Organic Blob Stand with Rapier gravity slot drops,
 * hover lift + flavour callback, and heavy-spring ±35° horizontal drag rotation.
 * Falls back gracefully to transparent mochi-stand cutout on low tier / reduced motion / no WebGL.
 */
export default function StandScene3D({
  active = true,
  reducedMotion = false,
  tier = 'high',
  onHoverFlavour,
  className = '',
}: StandScene3DProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const isActive = useViewportActive(containerRef, '180px')
  const [contextFailed, setContextFailed] = useState(false)
  const [fallbackSrc, setFallbackSrc] = useState('/media/cutouts/mochi-stand.webp')

  const webglAvailable = canUseWebGL()
  const useFallback = tier === 'low' || reducedMotion || !webglAvailable || contextFailed
  const dpr = useMemo(() => getCappedDpr(tier), [tier])

  return (
    <div
      ref={containerRef}
      className={`stand-scene-3d ${className}`.trim()}
      role="img"
      aria-label="Milk-ceramic MOCHI stand holding all six lip jelly flavours"
      style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'pan-y' }}
    >
      {useFallback ? (
        <img
          className="stand-scene-3d__fallback"
          src={fallbackSrc}
          alt="MOCHI milk-ceramic stand with all six lip jelly flavours"
          onError={() => {
            if (fallbackSrc !== '/media/photos/mochi-blob-stand.webp') {
              setFallbackSrc('/media/photos/mochi-blob-stand.webp')
            }
          }}
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
        />
      ) : (
        <Canvas
          dpr={dpr}
          frameloop={isActive ? 'always' : 'demand'}
          camera={{ fov: 28, near: 0.1, far: 80, position: [0, 1.65, 13.8] }}
          gl={{
            alpha: true,
            antialias: true,
            powerPreference: 'high-performance',
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.05,
          }}
          onCreated={({ gl }) => {
            gl.setClearColor(0x000000, 0)
            gl.domElement.dataset.rendered = 'true'
            gl.domElement.addEventListener(
              'webglcontextlost',
              e => {
                e.preventDefault()
                setContextFailed(true)
              },
              { once: true },
            )
          }}
          style={{ width: '100%', height: '100%', display: 'block', cursor: 'grab' }}
        >
          <StandStage
            active={active}
            tier={tier}
            isActive={isActive}
            onHoverFlavour={onHoverFlavour}
          />
        </Canvas>
      )}
    </div>
  )
}
