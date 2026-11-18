import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  PointerHistory,
  clamp,
  createSpring,
  projectMomentum,
  rubberBandClamp,
} from '../physics/spring'
import type { DeviceTier, SqueezeAnchors } from '../types/mochi'
import { MochiStudioEnv } from './MochiStudio'
import {
  MOCHI_BODY_BASE,
  MOCHI_BODY_HEIGHT,
  MOCHI_CAP_EXPOSED_POS,
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

export type MochiTubeDragMode = 'tilt' | 'spin35'

export type MochiTube3DProps = {
  colour: string
  prevColour?: string
  pourProgress?: number
  exposed?: boolean
  reducedMotion?: boolean
  tier?: DeviceTier
  aura?: string
  fallbackSrc?: string
  fallbackAlt?: string
  ariaLabel?: string
  className?: string
  externalSqueeze?: number
  dragMode?: MochiTubeDragMode
  onAnchors?: (a: SqueezeAnchors) => void
}

const MAX_SPIN_RAD = (35 * Math.PI) / 180
const REST_ROT_X = -0.035
const REST_ROT_Y = -0.075

type InnerSceneProps = {
  colour: string
  prevColour?: string
  pourProgress?: number
  exposed: boolean
  reducedMotion: boolean
  tier: DeviceTier
  aura: string
  externalSqueeze: number
  dragMode: MochiTubeDragMode
  onAnchors?: (a: SqueezeAnchors) => void
  isActive: boolean
}

function MochiTubeStage({
  colour,
  prevColour,
  pourProgress,
  exposed,
  reducedMotion,
  tier,
  aura,
  externalSqueeze,
  dragMode,
  onAnchors,
  isActive,
}: InnerSceneProps) {
  const { camera, size, gl } = useThree()
  const groupRef = useRef<THREE.Group>(null)
  const bodyMeshRef = useRef<THREE.Mesh | null>(null)
  const shadowMeshRef = useRef<THREE.Mesh>(null)
  const capShadowMeshRef = useRef<THREE.Mesh>(null)

  const deformRef = useRef(createDefaultDeformState())
  const shadowTexture = useMemo(() => getSoftShadowTexture(), [])
  const shadowColor = useMemo(() => auraShadowColor(aura, 0.45), [aura])

  // Internal liquid-fill pour tracking when pourProgress isn't controlled externally
  const [pourPair, setPourPair] = useState<{ prev: string; curr: string }>({
    prev: prevColour ?? colour,
    curr: colour,
  })
  const lastColourRef = useRef(colour)
  const pourSpring = useRef(createSpring({ stiffness: 54, damping: 14, mass: 1 }, 1))

  // Deformation & rotation springs (tokens.json presets)
  const squashSpring = useRef(createSpring('jelly', 1))
  const dentSpring = useRef(createSpring('jelly', 0))
  const dentYSpring = useRef(createSpring('jelly', 0.48))
  const bendXSpring = useRef(createSpring('jelly', 0))
  const bendZSpring = useRef(createSpring('jelly', 0))
  const wobbleSpring = useRef(createSpring('jelly', 0))
  const beadSpring = useRef(createSpring('jelly', 0))
  const rotXSpring = useRef(createSpring('heavy', REST_ROT_X))
  const rotYSpring = useRef(createSpring('heavy', REST_ROT_Y))

  const pointerRef = useRef({
    down: false,
    startX: 0,
    startY: 0,
    startRotX: REST_ROT_X,
    startRotY: REST_ROT_Y,
    holdTime: 0,
    pointerDent: 0,
  })
  const historyRef = useRef(new PointerHistory(5))
  const prevExternalSqueezeRef = useRef(externalSqueeze)
  const scrollRef = useRef({ lastY: typeof window !== 'undefined' ? window.scrollY : 0, velocity: 0 })
  const lastAnchorsRef = useRef<SqueezeAnchors | null>(null)

  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const ndcVec = useMemo(() => new THREE.Vector2(), [])
  const projVec = useMemo(() => new THREE.Vector3(), [])

  // Handle flavour colour change -> liquid pour from base to nozzle
  useEffect(() => {
    if (prevColour !== undefined && pourProgress !== undefined) {
      setPourPair({ prev: prevColour, curr: colour })
      return
    }
    if (colour !== lastColourRef.current) {
      const previous = lastColourRef.current
      lastColourRef.current = colour
      setPourPair({ prev: previous, curr: colour })
      if (reducedMotion) {
        pourSpring.current.snap(1)
      } else {
        pourSpring.current.snap(0)
        pourSpring.current.setTarget(1)
        wobbleSpring.current.addImpulse(0.95)
        squashSpring.current.addImpulse(-0.22)
        if (dragMode === 'spin35') {
          rotYSpring.current.setTarget(REST_ROT_Y)
        }
      }
    }
  }, [colour, prevColour, pourProgress, reducedMotion, dragMode])

  // Camera & transmission resolution tuning
  useEffect(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping
    gl.toneMappingExposure = 1.06
    gl.transmissionResolutionScale = tier === 'mid' ? 0.35 : 0.5
  }, [gl, tier])

  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera
    const centerX = exposed ? 0.34 : 0
    const aspect = Math.max(0.35, size.width / Math.max(1, size.height))
    const baseDist = exposed ? 10.6 : 9.8
    const fitDist = aspect < 0.85 ? baseDist / Math.max(0.76, aspect * 1.15) : baseDist
    cam.position.set(centerX, 0.22, fitDist)
    cam.lookAt(centerX, 0.14, 0)
    cam.updateProjectionMatrix()
  }, [camera, exposed, size.width, size.height])

  // Scroll velocity -> subtle jelly bend (<= 4 deg)
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY
      scrollRef.current.velocity = clamp((y - scrollRef.current.lastY) * 0.0022, -0.065, 0.065)
      scrollRef.current.lastY = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Pointer listeners on the WebGL canvas element
  useEffect(() => {
    const dom = gl.domElement

    const updateRaycastDentY = (clientX: number, clientY: number) => {
      const rect = dom.getBoundingClientRect()
      ndcVec.set(
        ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1,
        -((clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1,
      )
      if (bodyMeshRef.current) {
        raycaster.setFromCamera(ndcVec, camera)
        const hit = raycaster.intersectObject(bodyMeshRef.current, false)[0]
        if (hit) {
          const local = bodyMeshRef.current.worldToLocal(hit.point.clone())
          dentYSpring.current.setTarget(
            clamp((local.y - MOCHI_BODY_BASE) / MOCHI_BODY_HEIGHT, 0.1, 0.9),
          )
          return
        }
      }
      dentYSpring.current.setTarget(
        clamp(1 - (clientY - rect.top) / Math.max(1, rect.height), 0.12, 0.88),
      )
    }

    const onPointerDown = (e: PointerEvent) => {
      pointerRef.current.down = true
      pointerRef.current.startX = e.clientX
      pointerRef.current.startY = e.clientY
      pointerRef.current.startRotX = rotXSpring.current.value
      pointerRef.current.startRotY = rotYSpring.current.value
      pointerRef.current.holdTime = 0
      pointerRef.current.pointerDent = 0.55

      historyRef.current.reset()
      historyRef.current.add(e.clientX, e.clientY)
      rotXSpring.current.setTarget(rotXSpring.current.value)
      rotYSpring.current.setTarget(rotYSpring.current.value)

      if (dragMode === 'tilt') {
        updateRaycastDentY(e.clientX, e.clientY)
      }
      try {
        dom.setPointerCapture(e.pointerId)
      } catch {
        // ignore if pointer capture not supported
      }
    }

    const onPointerMove = (e: PointerEvent) => {
      if (!pointerRef.current.down) return
      historyRef.current.add(e.clientX, e.clientY)
      const dx = e.clientX - pointerRef.current.startX
      const dy = e.clientY - pointerRef.current.startY

      if (dragMode === 'spin35') {
        const rawY = pointerRef.current.startRotY + dx * 0.0055
        rotYSpring.current.setTarget(rubberBandClamp(rawY, -MAX_SPIN_RAD, MAX_SPIN_RAD, 0.42))
        rotXSpring.current.setTarget(
          rubberBandClamp(REST_ROT_X + dy * 0.0022, -0.22, 0.18, 0.16),
        )
      } else {
        rotYSpring.current.setTarget(
          rubberBandClamp(pointerRef.current.startRotY + dx * 0.005, -0.55, 0.55, 0.35),
        )
        rotXSpring.current.setTarget(
          rubberBandClamp(pointerRef.current.startRotX + dy * 0.0038, -0.32, 0.25, 0.2),
        )
        updateRaycastDentY(e.clientX, e.clientY)
      }
    }

    const release = (e?: PointerEvent) => {
      if (!pointerRef.current.down) return
      pointerRef.current.down = false
      pointerRef.current.pointerDent = 0

      const vel = historyRef.current.velocity()
      historyRef.current.reset()

      if (dragMode === 'spin35') {
        const angularVel = clamp(vel.x * 0.0055, -8, 8)
        const projected = projectMomentum(rotYSpring.current.value, angularVel)
        rotYSpring.current.setTarget(clamp(projected, -MAX_SPIN_RAD, MAX_SPIN_RAD))
        rotYSpring.current.setVelocity(angularVel)
        rotXSpring.current.setTarget(REST_ROT_X)
        wobbleSpring.current.addImpulse(clamp(vel.x * 0.0014, -2.5, 2.5))
      } else {
        const vx = clamp(vel.x * 0.004, -5, 5)
        const vy = clamp(vel.y * 0.003, -4, 4)
        rotYSpring.current.setTarget(REST_ROT_Y)
        rotYSpring.current.setVelocity(vx)
        rotXSpring.current.setTarget(REST_ROT_X)
        rotXSpring.current.setVelocity(vy)
        wobbleSpring.current.addImpulse(clamp((Math.abs(vel.x) + Math.abs(vel.y)) * 0.0018 + 1.1, 0.4, 3.2))
      }

      if (e) {
        try {
          if (dom.hasPointerCapture(e.pointerId)) dom.releasePointerCapture(e.pointerId)
        } catch {
          // ignore
        }
      }
    }

    dom.addEventListener('pointerdown', onPointerDown)
    dom.addEventListener('pointermove', onPointerMove)
    dom.addEventListener('pointerup', release)
    dom.addEventListener('pointercancel', release)
    return () => {
      dom.removeEventListener('pointerdown', onPointerDown)
      dom.removeEventListener('pointermove', onPointerMove)
      dom.removeEventListener('pointerup', release)
      dom.removeEventListener('pointercancel', release)
    }
  }, [gl, camera, dragMode, ndcVec, raycaster])

  useFrame((_, rawDelta) => {
    if (!isActive) return
    const dt = Math.min(0.05, Math.max(0.001, rawDelta))
    const p = pointerRef.current

    // Hold dent deepens with dwell time when pressed
    if (p.down && dragMode === 'tilt') {
      p.holdTime += dt
      p.pointerDent = clamp(0.55 + p.holdTime * 0.6, 0.55, 1.05)
    }

    // Scroll-driven squeeze curve (peaks smoothly mid-pinch, releases with wobble bounce)
    const clampedExt = clamp(externalSqueeze, 0, 1)
    const prevExt = prevExternalSqueezeRef.current
    prevExternalSqueezeRef.current = clampedExt
    const extPinch = Math.pow(Math.sin(clampedExt * Math.PI), 0.85)
    const prevPinch = Math.pow(Math.sin(prevExt * Math.PI), 0.85)
    if (!reducedMotion && prevPinch - extPinch > 0.012) {
      wobbleSpring.current.addImpulse((prevPinch - extPinch) * 8.5)
    }

    const totalDent = clamp(extPinch * 0.88 + p.pointerDent, 0, 1.12)
    const totalSquash = clamp(1 - extPinch * 0.16 - p.pointerDent * 0.13, 0.72, 1.08)
    const totalBead = clamp(extPinch * 1.0 + p.pointerDent * 0.85, 0, 1.35)

    dentSpring.current.setTarget(totalDent)
    squashSpring.current.setTarget(totalSquash)
    beadSpring.current.setTarget(totalBead)
    if (!p.down && extPinch > 0.02) {
      dentYSpring.current.setTarget(0.48)
    }

    scrollRef.current.velocity *= 0.88
    bendXSpring.current.setTarget(clamp(scrollRef.current.velocity, -0.06, 0.06))
    const dragBendZ = p.down ? clamp(rotYSpring.current.velocity * 0.012, -0.04, 0.04) : 0
    bendZSpring.current.setTarget(dragBendZ)

    const targetPour = pourProgress !== undefined ? clamp(pourProgress, 0, 1) : pourSpring.current.target

    if (reducedMotion) {
      squashSpring.current.snap(totalSquash)
      dentSpring.current.snap(totalDent)
      dentYSpring.current.snap(0.48)
      bendXSpring.current.snap(0)
      bendZSpring.current.snap(0)
      wobbleSpring.current.snap(0)
      beadSpring.current.snap(totalBead)
      rotXSpring.current.snap(rotXSpring.current.target)
      rotYSpring.current.snap(rotYSpring.current.target)
      pourSpring.current.snap(targetPour)
    } else {
      squashSpring.current.step(dt)
      dentSpring.current.step(dt)
      dentYSpring.current.step(dt)
      bendXSpring.current.step(dt)
      bendZSpring.current.step(dt)
      wobbleSpring.current.step(dt)
      beadSpring.current.step(dt)
      rotXSpring.current.step(dt)
      rotYSpring.current.step(dt)
      if (pourProgress === undefined) {
        pourSpring.current.step(dt)
      } else {
        pourSpring.current.snap(targetPour)
      }
      deformRef.current.time += dt
    }

    deformRef.current.squash = squashSpring.current.value
    deformRef.current.dent = dentSpring.current.value
    deformRef.current.dentY = dentYSpring.current.value
    deformRef.current.bendX = bendXSpring.current.value
    deformRef.current.bendZ = bendZSpring.current.value
    deformRef.current.wobble = wobbleSpring.current.value
    deformRef.current.bead = beadSpring.current.value
    deformRef.current.pour = pourSpring.current.value

    if (groupRef.current) {
      groupRef.current.rotation.set(rotXSpring.current.value, rotYSpring.current.value, 0)
      groupRef.current.updateMatrixWorld()
    }

    // Aura-tinted contact shadows tighten & darken as body squashes down
    const squeezeAmt = clamp(1 - squashSpring.current.value, 0, 0.35)
    if (shadowMeshRef.current) {
      shadowMeshRef.current.scale.set(1.12 + squeezeAmt * 0.55, 0.86 + squeezeAmt * 0.35, 1)
      const mat = shadowMeshRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.34 + squeezeAmt * 0.38
      mat.color.copy(shadowColor)
    }
    if (capShadowMeshRef.current) {
      const mat = capShadowMeshRef.current.material as THREE.MeshBasicMaterial
      mat.color.copy(shadowColor)
    }

    // Live 3D landmark projection -> normalized [0..1, 0..1] container coords
    if (onAnchors && groupRef.current) {
      const sq = squashSpring.current.value
      const dn = dentSpring.current.value
      const nozzleShift = MOCHI_BODY_HEIGHT * (sq - 1)
      const projectPoint = (lx: number, ly: number, lz: number): [number, number] => {
        projVec.set(lx, ly, lz).applyMatrix4(groupRef.current!.matrixWorld).project(camera)
        return [
          clamp((projVec.x + 1) * 0.5, 0.02, 0.98),
          clamp((1 - projVec.y) * 0.5, 0.02, 0.98),
        ]
      }

      const nextAnchors: SqueezeAnchors = {
        top: projectPoint(0.36, MOCHI_BODY_BASE + MOCHI_BODY_HEIGHT * sq * 0.86, 0.18),
        middle: projectPoint(
          -0.42 * (1 / Math.sqrt(Math.max(0.64, sq))) * (1 - dn * 0.24),
          MOCHI_BODY_BASE + MOCHI_BODY_HEIGHT * sq * dentYSpring.current.value,
          0.14,
        ),
        nozzle: projectPoint(-0.08, 1.64 + nozzleShift + beadSpring.current.value * 0.045, 0.06),
        cap: exposed
          ? projectPoint(
              MOCHI_CAP_EXPOSED_POS[0] + 0.18,
              MOCHI_CAP_EXPOSED_POS[1] + 0.36,
              MOCHI_CAP_EXPOSED_POS[2] + 0.14,
            )
          : projectPoint(0.32, 1.44 + nozzleShift, 0.16),
      }

      const prev = lastAnchorsRef.current
      const moved =
        !prev ||
        (['top', 'middle', 'nozzle', 'cap'] as const).some(
          key =>
            Math.abs(nextAnchors[key][0] - prev[key][0]) > 0.0015 ||
            Math.abs(nextAnchors[key][1] - prev[key][1]) > 0.0015,
        )
      if (moved) {
        lastAnchorsRef.current = nextAnchors
        onAnchors(nextAnchors)
      }
    }
  })

  return (
    <>
      <MochiStudioEnv aura={aura} intensity={0.96} />
      <hemisphereLight args={['#FAF7F2', '#E5D5CE', 0.92]} />
      <directionalLight color="#FFF9F0" intensity={1.15} position={[-3.6, 4.8, 5.2]} />
      <directionalLight color="#FFF2E8" intensity={0.55} position={[3.2, 1.4, -3.5]} />

      <group ref={groupRef} position={[0, 0.02, 0]}>
        <MochiTubeMesh
          colour={pourPair.curr}
          prevColour={pourPair.prev}
          exposed={exposed}
          tier={tier}
          aura={aura}
          transmissionMode="transmission"
          deformRef={deformRef}
          onBodyRef={mesh => {
            bodyMeshRef.current = mesh
          }}
        />
      </group>

      {/* Aura-tinted soft contact shadows */}
      <mesh
        ref={shadowMeshRef}
        position={[0.04, MOCHI_BODY_BASE - 0.03, -0.14]}
        rotation={[-Math.PI / 2 + 0.14, 0, 0]}
        renderOrder={0}
      >
        <planeGeometry args={[1.65, 0.92]} />
        <meshBasicMaterial
          map={shadowTexture}
          color={shadowColor}
          transparent
          opacity={0.34}
          depthWrite={false}
        />
      </mesh>

      {exposed && (
        <mesh
          ref={capShadowMeshRef}
          position={[MOCHI_CAP_EXPOSED_POS[0] + 0.04, MOCHI_BODY_BASE - 0.03, -0.06]}
          rotation={[-Math.PI / 2 + 0.14, 0, 0]}
          renderOrder={0}
        >
          <planeGeometry args={[1.15, 0.78]} />
          <meshBasicMaterial
            map={shadowTexture}
            color={shadowColor}
            transparent
            opacity={0.30}
            depthWrite={false}
          />
        </mesh>
      )}
    </>
  )
}

/**
 * Interactive real-time 3D MOCHI lip jelly tube canvas with lazy off-screen pause,
 * capped DPR, and crisp photo fallback when WebGL is unavailable or on low device tier.
 */
export default function MochiTube3D({
  colour,
  prevColour,
  pourProgress,
  exposed = false,
  reducedMotion = false,
  tier = 'high',
  aura = '#F2EDE4',
  fallbackSrc,
  fallbackAlt = 'MOCHI lip jelly tube',
  ariaLabel = 'Interactive MOCHI lip jelly tube',
  className = '',
  externalSqueeze = 0,
  dragMode = 'tilt',
  onAnchors,
}: MochiTube3DProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const isActive = useViewportActive(containerRef, '160px')
  const [contextFailed, setContextFailed] = useState(false)

  const webglAvailable = canUseWebGL()
  const useFallback = tier === 'low' || !webglAvailable || contextFailed

  // Provide accurate static anchors when falling back to 2D cutout image
  useEffect(() => {
    if (!useFallback || !onAnchors) return
    onAnchors(
      exposed
        ? {
            top: [0.36, 0.24],
            middle: [0.33, 0.50],
            nozzle: [0.43, 0.14],
            cap: [0.69, 0.72],
          }
        : {
            top: [0.41, 0.26],
            middle: [0.38, 0.52],
            nozzle: [0.50, 0.15],
            cap: [0.50, 0.18],
          },
    )
  }, [useFallback, exposed, onAnchors])

  const dpr = useMemo(() => getCappedDpr(tier), [tier])

  return (
    <div
      ref={containerRef}
      className={`mochi-tube-3d ${className}`.trim()}
      role="img"
      aria-label={ariaLabel}
      style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'pan-y' }}
    >
      {useFallback ? (
        fallbackSrc ? (
          <img
            className="mochi-tube-3d__fallback"
            src={fallbackSrc}
            alt={fallbackAlt}
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
          />
        ) : null
      ) : (
        <Canvas
          dpr={dpr}
          frameloop={isActive ? 'always' : 'demand'}
          camera={{ fov: 26, near: 0.1, far: 60, position: [exposed ? 0.34 : 0, 0.24, 11.2] }}
          gl={{
            alpha: true,
            antialias: true,
            powerPreference: 'high-performance',
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.06,
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
          <MochiTubeStage
            colour={colour}
            prevColour={prevColour}
            pourProgress={pourProgress}
            exposed={exposed}
            reducedMotion={reducedMotion}
            tier={tier}
            aura={aura}
            externalSqueeze={externalSqueeze}
            dragMode={dragMode}
            onAnchors={onAnchors}
            isActive={isActive}
          />
        </Canvas>
      )}
    </div>
  )
}
