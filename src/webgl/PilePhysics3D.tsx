import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  BallCollider,
  CapsuleCollider,
  CuboidCollider,
  Physics,
  type RapierRigidBody,
  RigidBody,
} from '@react-three/rapier'
import { flavours } from '../brand'
import { PointerHistory, clamp, createSpring } from '../physics/spring'
import type { DeviceTier, Flavour } from '../types/mochi'
import { MochiStudioEnv } from './MochiStudio'
import { MochiTubeMesh, createDefaultDeformState } from './MochiTubeMesh'
import {
  auraShadowColor,
  canUseWebGL,
  getCappedDpr,
  getSoftShadowTexture,
  useViewportActive,
} from './webglUtils'

export type PilePhysics3DProps = {
  active?: boolean
  reducedMotion?: boolean
  tier?: DeviceTier
  className?: string
}

type TubeSeed = {
  id: number
  flavour: Flavour
  position: [number, number, number]
  rotation: [number, number, number]
}

const PILE_AURA = '#E46A8E'
const FLOOR_Y = 0
const KINEMATIC_PARK_Y = 28

function buildSeeds(count: number, compact = false): TubeSeed[] {
  const seeds: TubeSeed[] = []
  const maxSpreadX = compact ? 1.85 : 3.2
  const maxSpreadZ = compact ? 1.45 : 1.8
  for (let i = 0; i < count; i += 1) {
    // 3 tubes per flavour on high (18), balanced spread on mid (10)
    const flavour = flavours[i % flavours.length]
    const ring = i % 6
    const layer = Math.floor(i / 6)
    const angle = (ring / 6) * Math.PI * 2 + layer * 0.52
    const rad = (compact ? 0.72 : 1.05) + (i % 3) * (compact ? 0.52 : 0.85)
    const x = clamp(Math.cos(angle) * rad + ((i % 2 === 0 ? 1 : -1) * (compact ? 0.22 : 0.35)), -maxSpreadX, maxSpreadX)
    const z = clamp(Math.sin(angle) * (rad * 0.65), -maxSpreadZ, maxSpreadZ)
    const y = 4.6 + i * 0.55

    // Varied initial tilts so tubes cascade into a natural organic pile
    const rx = ((i * 37) % 100) / 100 * 1.4 - 0.7 + Math.PI * 0.42
    const ry = ((i * 53) % 100) / 100 * Math.PI * 2
    const rz = ((i * 71) % 100) / 100 * 1.2 - 0.6
    seeds.push({
      id: i,
      flavour,
      position: [x, y, z],
      rotation: [rx, ry, rz],
    })
  }
  return seeds
}

type PileStageProps = {
  active: boolean
  tier: DeviceTier
  isActive: boolean
}

function PileStage({ active, tier, isActive }: PileStageProps) {
  const { camera, gl, size } = useThree()
  const isCompact = size.width <= 700 || size.width / Math.max(1, size.height) < 0.88
  const count = tier === 'mid' || isCompact ? 10 : 18
  const seeds = useMemo(() => buildSeeds(count, isCompact), [count, isCompact])

  const shadowTex = useMemo(() => getSoftShadowTexture(), [])
  const shadowTint = useMemo(() => auraShadowColor(PILE_AURA, 0.42), [])

  const bodyRefs = useRef<(RapierRigidBody | null)[]>([])
  const kinematicRef = useRef<RapierRigidBody | null>(null)
  const shadowRefs = useRef<(THREE.Mesh | null)[]>([])

  const deformRefs = useRef(Array.from({ length: 18 }, () => createDefaultDeformState()))
  const squashSprings = useRef(Array.from({ length: 18 }, () => createSpring('jelly', 1)))
  const wobbleSprings = useRef(Array.from({ length: 18 }, () => createSpring('jelly', 0)))
  const lastImpactTime = useRef(new Float32Array(18))

  const grabRef = useRef<{ index: number | null; worldPos: THREE.Vector3 }>({
    index: null,
    worldPos: new THREE.Vector3(),
  })
  const pointerWorldRef = useRef<{
    active: boolean
    lastMoveAt: number
    pos: THREE.Vector3
  }>({
    active: false,
    lastMoveAt: 0,
    pos: new THREE.Vector3(0, KINEMATIC_PARK_Y, 0),
  })
  const historyRef = useRef(new PointerHistory(5))

  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const ndcVec = useMemo(() => new THREE.Vector2(), [])
  const dragPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.68), [])
  const grabPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.35), [])
  const hitVec = useMemo(() => new THREE.Vector3(), [])

  const aspect = Math.max(0.45, size.width / Math.max(1, size.height))
  const wallHalfX = isCompact ? 2.65 : 4.7
  const wallHalfZ = isCompact ? 2.35 : 2.85

  useEffect(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping
    gl.toneMappingExposure = 1.05
  }, [gl])

  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera
    const dist = isCompact ? clamp(15.2 / Math.max(0.66, aspect), 16.5, 22.0) : 12.6
    cam.position.set(0, dist * 0.96, dist * 0.36)
    cam.lookAt(0, 0.25, 0.1)
    cam.updateProjectionMatrix()
  }, [camera, aspect, isCompact])

  useEffect(() => {
    const dom = gl.domElement

    const projectToPlane = (clientX: number, clientY: number, plane: THREE.Plane): THREE.Vector3 | null => {
      const rect = dom.getBoundingClientRect()
      ndcVec.set(
        ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1,
        -((clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1,
      )
      raycaster.setFromCamera(ndcVec, camera)
      return raycaster.ray.intersectPlane(plane, hitVec)
    }

    const onPointerMove = (e: PointerEvent) => {
      const plane = grabRef.current.index !== null ? grabPlane : dragPlane
      const pt = projectToPlane(e.clientX, e.clientY, plane)
      if (!pt) return
      const clampedX = clamp(pt.x, -wallHalfX + 0.3, wallHalfX - 0.3)
      const clampedZ = clamp(pt.z, -wallHalfZ + 0.3, wallHalfZ - 0.3)

      if (grabRef.current.index !== null) {
        grabRef.current.worldPos.set(clampedX, 1.35, clampedZ)
        historyRef.current.add(clampedX, clampedZ)
      } else {
        pointerWorldRef.current.active = true
        pointerWorldRef.current.lastMoveAt = performance.now()
        pointerWorldRef.current.pos.set(clampedX, 0.68, clampedZ)
      }
    }

    const releaseGrab = (e?: PointerEvent) => {
      const idx = grabRef.current.index
      if (idx === null) return
      grabRef.current.index = null

      const rb = bodyRefs.current[idx]
      const vel = historyRef.current.velocity()
      historyRef.current.reset()

      if (rb) {
        const vx = clamp(vel.x * 1.15, -20, 20)
        const vz = clamp(vel.y * 1.15, -20, 20)
        const speed = Math.hypot(vx, vz)
        rb.wakeUp()
        rb.applyImpulse({ x: vx * 0.55, y: clamp(1.2 + speed * 0.14, 1.0, 5.2), z: vz * 0.55 }, true)
        rb.applyTorqueImpulse(
          {
            x: clamp(vz * 0.14, -2.5, 2.5),
            y: clamp((vx - vz) * 0.08, -1.8, 1.8),
            z: clamp(-vx * 0.14, -2.5, 2.5),
          },
          true,
        )
        wobbleSprings.current[idx].addImpulse(clamp(1.2 + speed * 0.12, 1.2, 3.6))
      }

      if (e) {
        try {
          if (dom.hasPointerCapture(e.pointerId)) dom.releasePointerCapture(e.pointerId)
        } catch {
          // ignore
        }
      }
    }

    const onPointerLeave = () => {
      pointerWorldRef.current.active = false
      releaseGrab()
    }

    dom.addEventListener('pointermove', onPointerMove)
    dom.addEventListener('pointerup', releaseGrab)
    dom.addEventListener('pointercancel', releaseGrab)
    dom.addEventListener('pointerleave', onPointerLeave)
    return () => {
      dom.removeEventListener('pointermove', onPointerMove)
      dom.removeEventListener('pointerup', releaseGrab)
      dom.removeEventListener('pointercancel', releaseGrab)
      dom.removeEventListener('pointerleave', onPointerLeave)
    }
  }, [gl, camera, raycaster, ndcVec, dragPlane, grabPlane, hitVec, wallHalfX, wallHalfZ])

  useFrame((state, rawDelta) => {
    if (!isActive) return
    const dt = Math.min(0.05, Math.max(0.001, rawDelta))
    const nowMs = performance.now()

    // Drive kinematic scatter sphere collider while sweeping; park when idle so bodies sleep
    if (kinematicRef.current) {
      const sweepActive =
        grabRef.current.index === null &&
        pointerWorldRef.current.active &&
        nowMs - pointerWorldRef.current.lastMoveAt < 220

      if (sweepActive) {
        kinematicRef.current.setNextKinematicTranslation({
          x: pointerWorldRef.current.pos.x,
          y: pointerWorldRef.current.pos.y,
          z: pointerWorldRef.current.pos.z,
        })
      } else {
        kinematicRef.current.setNextKinematicTranslation({ x: 0, y: KINEMATIC_PARK_Y, z: 0 })
      }
    }

    // Spring-pull actively grabbed tube toward pointer
    if (grabRef.current.index !== null) {
      const rb = bodyRefs.current[grabRef.current.index]
      if (rb) {
        const cur = rb.translation()
        const target = grabRef.current.worldPos
        rb.wakeUp()
        rb.setLinvel(
          {
            x: clamp((target.x - cur.x) * 14, -22, 22),
            y: clamp((target.y - cur.y) * 14, -18, 18),
            z: clamp((target.z - cur.z) * 14, -22, 22),
          },
          true,
        )
      }
    }

    const t = state.clock.elapsedTime
    for (let i = 0; i < count; i += 1) {
      const sq = squashSprings.current[i].step(dt)
      const wb = wobbleSprings.current[i].step(dt)
      const d = deformRefs.current[i]
      d.squash = sq
      d.wobble = wb
      d.time = t + i * 0.37

      const rb = bodyRefs.current[i]
      const shadow = shadowRefs.current[i]
      if (rb && shadow) {
        const pos = rb.translation()
        const rot = rb.rotation()
        const height = clamp(pos.y - FLOOR_Y, 0, 5)
        const tightness = 1 - clamp(height / 4.2, 0, 0.82)
        shadow.position.set(pos.x, FLOOR_Y + 0.015, pos.z)
        // Align oval shadow roughly with tube yaw/heading
        const euler = new THREE.Euler().setFromQuaternion(
          new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w),
        )
        shadow.rotation.set(-Math.PI / 2, 0, euler.y)
        const s = 1 + (1 - tightness) * 0.48
        shadow.scale.set(s, s, 1)
        const mat = shadow.material as THREE.MeshBasicMaterial
        mat.opacity = 0.28 * tightness
      }
    }
  })

  return (
    <>
      <MochiStudioEnv aura={PILE_AURA} intensity={0.95} />
      <hemisphereLight args={['#FAF7F2', '#ECD6CE', 0.98]} />
      <directionalLight color="#FFF8EE" intensity={1.2} position={[-4.8, 9.5, 4.2]} />
      <directionalLight color="#FFEAD9" intensity={0.55} position={[4.4, 5.2, -4.0]} />

      {/* Per-tube aura-tinted contact shadows on the floor */}
      {seeds.map((seed, i) => (
        <mesh
          key={`pile-shadow-${seed.id}`}
          ref={el => {
            shadowRefs.current[i] = el
          }}
          position={[seed.position[0], FLOOR_Y + 0.015, seed.position[2]]}
          rotation={[-Math.PI / 2, 0, 0]}
          renderOrder={0}
        >
          <planeGeometry args={[1.35, 3.1]} />
          <meshBasicMaterial
            map={shadowTex}
            color={shadowTint}
            transparent
            opacity={0}
            depthWrite={false}
          />
        </mesh>
      ))}

      <Physics gravity={[0, -16, 0]} paused={!isActive || !active} timeStep={1 / 60}>
        {/* Invisible tray floor & containment walls (1 fixed RigidBody) */}
        <RigidBody type="fixed" colliders={false} restitution={0.3} friction={0.65}>
          <CuboidCollider args={[wallHalfX + 2, 0.5, wallHalfZ + 2]} position={[0, FLOOR_Y - 0.5, 0]} />
          <CuboidCollider args={[0.5, 8, wallHalfZ + 2]} position={[-wallHalfX - 0.5, 4, 0]} />
          <CuboidCollider args={[0.5, 8, wallHalfZ + 2]} position={[wallHalfX + 0.5, 4, 0]} />
          <CuboidCollider args={[wallHalfX + 2, 8, 0.5]} position={[0, 4, -wallHalfZ - 0.5]} />
          <CuboidCollider args={[wallHalfX + 2, 8, 0.5]} position={[0, 4, wallHalfZ + 0.5]} />
        </RigidBody>

        {/* Kinematic pointer scatter sphere (1 kinematic RigidBody) */}
        <RigidBody
          ref={kinematicRef}
          type="kinematicPosition"
          colliders={false}
          position={[0, KINEMATIC_PARK_Y, 0]}
          restitution={0.45}
        >
          <BallCollider args={[0.88]} />
        </RigidBody>

        {/* 18 (or 10 on mid tier) dynamic tubes with sleep enabled */}
        {seeds.map((seed, i) => (
          <RigidBody
            key={seed.id}
            ref={el => {
              bodyRefs.current[i] = el
            }}
            type="dynamic"
            colliders={false}
            canSleep
            position={seed.position}
            rotation={seed.rotation}
            linearDamping={0.48}
            angularDamping={0.78}
            restitution={0.34}
            friction={0.62}
            onCollisionEnter={() => {
              const now = performance.now()
              if (now - lastImpactTime.current[i] < 160) return
              const rb = bodyRefs.current[i]
              if (!rb) return
              const lv = rb.linvel()
              const speed = Math.hypot(lv.x, lv.y, lv.z)
              if (speed > 1.35) {
                lastImpactTime.current[i] = now
                squashSprings.current[i].addImpulse(-clamp(speed * 0.22, 0.25, 1.6))
                wobbleSprings.current[i].addImpulse(clamp(speed * 0.32, 0.4, 2.5))
              }
            }}
          >
            <CapsuleCollider args={[1.15, 0.43]} position={[0, 0.14, 0]} />
            <MochiTubeMesh
              colour={seed.flavour.jelly}
              aura={PILE_AURA}
              exposed={false}
              tier={tier}
              transmissionMode="layered"
              deformRef={{ current: deformRefs.current[i] }}
              onPointerDownBody={e => {
                e.stopPropagation()
                grabRef.current.index = i
                grabRef.current.worldPos.set(e.point.x, 1.35, e.point.z)
                historyRef.current.reset()
                historyRef.current.add(e.point.x, e.point.z)
                wobbleSprings.current[i].addImpulse(1.4)
                try {
                  gl.domElement.setPointerCapture(e.pointerId)
                } catch {
                  // ignore
                }
              }}
            />
          </RigidBody>
        ))}
      </Physics>
    </>
  )
}

/**
 * Interactive Rapier rigid-body pile of 18 MOCHI tubes (10 on mid tier).
 * Tubes rain down on active entry, sleep when still, scatter under kinematic pointer sphere,
 * and can be grabbed and thrown with velocity-proportional impulse.
 */
export default function PilePhysics3D({
  active = true,
  reducedMotion = false,
  tier = 'high',
  className = '',
}: PilePhysics3DProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const isActive = useViewportActive(containerRef, '180px')
  const [contextFailed, setContextFailed] = useState(false)

  const webglAvailable = canUseWebGL()
  const useFallback = tier === 'low' || reducedMotion || !webglAvailable || contextFailed
  const dpr = useMemo(() => getCappedDpr(tier), [tier])

  return (
    <div
      ref={containerRef}
      className={`pile-physics-3d ${className}`.trim()}
      role="img"
      aria-label="Pile of all six MOCHI lip jelly shades"
      style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'pan-y' }}
    >
      {useFallback ? (
        <img
          className="pile-physics-3d__fallback"
          src="/media/photos/mochi-all-pile.webp"
          alt="All six MOCHI lip jelly shades piled together"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
            maskImage:
              'linear-gradient(180deg, transparent 0%, #000 18%, #000 82%, transparent 100%)',
            WebkitMaskImage:
              'linear-gradient(180deg, transparent 0%, #000 18%, #000 82%, transparent 100%)',
          }}
        />
      ) : (
        <Canvas
          dpr={dpr}
          frameloop={isActive ? 'always' : 'demand'}
          camera={{ fov: 34, near: 0.1, far: 80, position: [0, 12.2, 4.4] }}
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
          <PileStage active={active} tier={tier} isActive={isActive} />
        </Canvas>
      )}
    </div>
  )
}
