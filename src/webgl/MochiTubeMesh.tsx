import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { MeshTransmissionMaterial } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import type { DeviceTier } from '../types/mochi'
import { auraTransmissionBg } from './webglUtils'

export const MOCHI_BODY_BASE = -1.5
export const MOCHI_BODY_TOP = 1.12
export const MOCHI_BODY_HEIGHT = MOCHI_BODY_TOP - MOCHI_BODY_BASE
export const MOCHI_CAP_EXPOSED_POS: [number, number, number] = [0.94, MOCHI_BODY_BASE, 0.06]
export const MOCHI_CAP_CLOSED_Y = 1.105

export type MochiTubeDeformState = {
  squash: number
  dent: number
  dentY: number
  bendX: number
  bendZ: number
  wobble: number
  bead: number
  pour: number
  time: number
  liftY?: number
}

export type MochiTubeMeshProps = {
  colour: string
  prevColour?: string
  exposed?: boolean
  tier?: DeviceTier
  aura?: string
  transmissionMode?: 'transmission' | 'layered'
  deformRef?: React.MutableRefObject<MochiTubeDeformState>
  onBodyRef?: (mesh: THREE.Mesh | null) => void
  onPointerDownBody?: (e: any) => void
  onPointerOverTube?: (e: any) => void
  onPointerOutTube?: (e: any) => void
  liftY?: number
}

type ShaderUniformBundle = {
  uTime: { value: number }
  uSquash: { value: number }
  uDent: { value: number }
  uDentY: { value: number }
  uBend: { value: THREE.Vector2 }
  uWobble: { value: number }
  uPour: { value: number }
  uPrevColor: { value: THREE.Color }
  uNextColor: { value: THREE.Color }
  uPrevAtten: { value: THREE.Color }
  uNextAtten: { value: THREE.Color }
  uEmbossMap: { value: THREE.Texture | null }
}

let sharedBodyGeo: THREE.BufferGeometry | null = null
let sharedInnerGeo: THREE.BufferGeometry | null = null
let sharedThreadGeo: THREE.BufferGeometry | null = null
let sharedNozzleGeo: THREE.BufferGeometry | null = null
let sharedBeadGeo: THREE.BufferGeometry | null = null
let sharedCapGeo: THREE.BufferGeometry | null = null
let sharedEmbossNormal: THREE.DataTexture | null = null
let sharedEmbossHeight: THREE.DataTexture | null = null
let embossFontReadyBound = false

function buildBodyLatheGeometry(radialSegs = 128, heightSegs = 160): THREE.BufferGeometry {
  const points: THREE.Vector2[] = [new THREE.Vector2(0, MOCHI_BODY_BASE)]
  for (let i = 0; i <= heightSegs; i += 1) {
    const t = i / heightSegs
    const lowerWaist = Math.exp(-(((t - 0.25) / 0.145) ** 2))
    const midBelly = Math.exp(-(((t - 0.48) / 0.13) ** 2))
    const upperWaist = Math.exp(-(((t - 0.70) / 0.145) ** 2))
    const shoulder = Math.exp(-(((t - 0.915) / 0.115) ** 2))
    const footRound = Math.sqrt(Math.max(0, 1 - Math.min(1, Math.max(0, 1 - t / 0.042)) ** 2))
    const lipRound = Math.sqrt(Math.max(0, 1 - Math.min(1, Math.max(0, (t - 0.955) / 0.045)) ** 2))

    const radius =
      0.484 -
      0.052 * lowerWaist +
      0.016 * midBelly -
      0.040 * upperWaist +
      0.026 * shoulder -
      0.048 * t -
      0.058 * (1 - footRound) -
      0.078 * (1 - lipRound)

    points.push(new THREE.Vector2(Math.max(0.002, radius), MOCHI_BODY_BASE + MOCHI_BODY_HEIGHT * t))
  }
  points.push(new THREE.Vector2(0, MOCHI_BODY_TOP))

  const geo = new THREE.LatheGeometry(points, radialSegs, -Math.PI, Math.PI * 2)
  const pos = geo.attributes.position
  // Subtle organic left/right wave asymmetry matching MOCHI_*_PK.png + baked 0.82 z-flattening
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const r = Math.hypot(x, z)
    if (r > 0.004) {
      const t = Math.min(1, Math.max(0, (y - MOCHI_BODY_BASE) / MOCHI_BODY_HEIGHT))
      const theta = Math.atan2(x, z)
      const edgeFade = Math.sin(t * Math.PI)
      const waveOffset = 1.0 + 0.024 * Math.sin(t * Math.PI * 2.85 + 0.35) * (-Math.sin(theta)) * edgeFade
      pos.setX(i, x * waveOffset)
      pos.setZ(i, z * waveOffset * 0.82)
    } else {
      pos.setZ(i, z * 0.82)
    }
  }
  pos.needsUpdate = true
  geo.computeVertexNormals()
  return geo
}

export function getTubeBodyGeometry(): THREE.BufferGeometry {
  if (!sharedBodyGeo) sharedBodyGeo = buildBodyLatheGeometry(128, 160)
  return sharedBodyGeo
}

export function getTubeInnerGeometry(): THREE.BufferGeometry {
  if (!sharedInnerGeo) {
    const base = getTubeBodyGeometry().clone()
    const pos = base.attributes.position
    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i)
      const y = pos.getY(i)
      const z = pos.getZ(i)
      pos.setXYZ(i, x * 0.895, (y + 0.03) * 0.935 + 0.015, z * 0.895)
    }
    pos.needsUpdate = true
    base.computeVertexNormals()
    sharedInnerGeo = base
  }
  return sharedInnerGeo
}

export function getTubeThreadGeometry(): THREE.BufferGeometry {
  if (!sharedThreadGeo) {
    // 8-ring smooth threaded neck matching MOCHI_CHERRY_PK.png
    const pts: THREE.Vector2[] = []
    const steps = 112
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps
      const collar = i < 6 ? Math.sin((i / 6) * (Math.PI / 2)) : 1
      const rings = 0.0085 * Math.pow(0.5 + 0.5 * Math.cos(t * Math.PI * 16), 1.3)
      const r = (0.314 - t * 0.055 + rings) * (0.85 + 0.15 * collar)
      pts.push(new THREE.Vector2(r, 1.08 + 0.285 * t))
    }
    const geo = new THREE.LatheGeometry(pts, 72)
    geo.scale(1, 1, 0.84)
    geo.computeVertexNormals()
    sharedThreadGeo = geo
  }
  return sharedThreadGeo
}

export function getTubeNozzleGeometry(): THREE.BufferGeometry {
  if (!sharedNozzleGeo) {
    // Slanted glossy lip applicator tip rising from the threaded neck
    const pts: THREE.Vector2[] = []
    const steps = 48
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps
      const r = 0.242 * Math.cos(t * Math.PI * 0.48)
      const y = 1.35 + 0.34 * Math.sin(t * Math.PI * 0.5)
      pts.push(new THREE.Vector2(Math.max(0.002, r), y))
    }
    const geo = new THREE.LatheGeometry(pts, 64)
    const pos = geo.attributes.position
    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i)
      const y = pos.getY(i)
      const z = pos.getZ(i)
      // Subtle slant forward-right matching real applicator profile
      const h = Math.max(0, (y - 1.35) / 0.34)
      pos.setY(i, y - x * 0.14 * h)
      pos.setZ(i, z * 0.84 + h * 0.025)
    }
    pos.needsUpdate = true
    geo.computeVertexNormals()
    sharedNozzleGeo = geo
  }
  return sharedNozzleGeo
}

export function getTubeBeadGeometry(): THREE.BufferGeometry {
  if (!sharedBeadGeo) {
    const geo = new THREE.SphereGeometry(0.185, 48, 32)
    geo.scale(1.12, 0.72, 0.90)
    sharedBeadGeo = geo
  }
  return sharedBeadGeo
}

export function getTubeCapGeometry(): THREE.BufferGeometry {
  if (!sharedCapGeo) {
    const pts: THREE.Vector2[] = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.398, 0),
      new THREE.Vector2(0.418, 0.016),
      new THREE.Vector2(0.424, 0.095),
    ]
    const domeSteps = 56
    for (let i = 0; i <= domeSteps; i += 1) {
      const a = (i / domeSteps) * (Math.PI / 2)
      pts.push(new THREE.Vector2(0.424 * Math.cos(a), 0.095 + 0.595 * Math.pow(Math.sin(a), 0.94)))
    }
    const geo = new THREE.LatheGeometry(pts, 84)
    geo.scale(1, 1, 0.86)
    geo.computeVertexNormals()
    sharedCapGeo = geo
  }
  return sharedCapGeo
}

function paintEmbossIntoTextures(
  normalData: Uint8Array,
  heightData: Uint8Array,
  size: number,
) {
  if (typeof document === 'undefined') return
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, size, size)
  ctx.save()
  ctx.translate(size * 0.5, size * 0.515)
  ctx.rotate(Math.PI / 2)
  ctx.filter = 'blur(4.0px)'
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 6
  ctx.lineJoin = 'round'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '400 88px "Krona One", sans-serif'
  ctx.scale(1.12, 1.06)

  // Draw letter by letter with subtle spacing matching MOCHI_CHERRY_PK.png
  const word = 'MOCHI'
  const offsets = [-182, -91, 2, 95, 178]
  for (let i = 0; i < word.length; i += 1) {
    ctx.strokeText(word[i], offsets[i], 0)
    ctx.fillText(word[i], offsets[i], 0)
  }
  ctx.restore()

  const img = ctx.getImageData(0, 0, size, size).data
  const strength = 56

  // Populate with flipY = false: dstY = 0 maps to bottom of tube (srcY = size - 1)
  for (let dstY = 0; dstY < size; dstY += 1) {
    const srcY = size - 1 - dstY
    const srcYUp = Math.max(0, srcY - 1)
    const srcYDown = Math.min(size - 1, srcY + 1)

    for (let x = 0; x < size; x += 1) {
      const xLeft = Math.max(0, x - 1)
      const xRight = Math.min(size - 1, x + 1)

      const hCenter = img[(srcY * size + x) * 4 + 3]
      const hLeft = img[(srcY * size + xLeft) * 4 + 3]
      const hRight = img[(srcY * size + xRight) * 4 + 3]
      const hUp = img[(srcYUp * size + x) * 4 + 3]
      const hDown = img[(srcYDown * size + x) * 4 + 3]

      const xSlope = hLeft - hRight
      // Normal +Y tilts upward (+V), matching top edge of raised letters catching upper key light
      const ySlope = hDown - hUp
      const len = Math.hypot(xSlope, ySlope, strength)

      const dstIdx = (dstY * size + x) * 4
      normalData[dstIdx] = Math.round(128 + (127 * xSlope) / len)
      normalData[dstIdx + 1] = Math.round(128 + (127 * ySlope) / len)
      normalData[dstIdx + 2] = Math.round(128 + (127 * strength) / len)
      normalData[dstIdx + 3] = 255

      heightData[dstIdx] = hCenter
      heightData[dstIdx + 1] = hCenter
      heightData[dstIdx + 2] = hCenter
      heightData[dstIdx + 3] = 255
    }
  }
}

export function getEmbossTextures(): {
  normalMap: THREE.DataTexture
  heightMap: THREE.DataTexture
} {
  const size = 1024
  if (!sharedEmbossNormal || !sharedEmbossHeight) {
    const normalData = new Uint8Array(size * size * 4)
    const heightData = new Uint8Array(size * size * 4)
    paintEmbossIntoTextures(normalData, heightData, size)

    const makeTex = (data: Uint8Array) => {
      const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType)
      tex.flipY = false
      tex.premultiplyAlpha = false
      tex.unpackAlignment = 4
      tex.colorSpace = THREE.NoColorSpace
      tex.magFilter = THREE.LinearFilter
      tex.minFilter = THREE.LinearMipmapLinearFilter
      tex.generateMipmaps = true
      tex.needsUpdate = true
      return tex
    }

    sharedEmbossNormal = makeTex(normalData)
    sharedEmbossHeight = makeTex(heightData)

    if (!embossFontReadyBound && typeof document !== 'undefined' && document.fonts?.load) {
      embossFontReadyBound = true
      document.fonts
        .load('400 88px "Krona One"')
        .then(() => {
          if (!sharedEmbossNormal || !sharedEmbossHeight) return
          paintEmbossIntoTextures(
            sharedEmbossNormal.image.data as Uint8Array,
            sharedEmbossHeight.image.data as Uint8Array,
            size,
          )
          sharedEmbossNormal.needsUpdate = true
          sharedEmbossHeight.needsUpdate = true
        })
        .catch(() => {
          // keep fallback render
        })
    }
  }
  return { normalMap: sharedEmbossNormal, heightMap: sharedEmbossHeight }
}

function createUniformBundle(colour: string, prevColour?: string, isLayered = false): ShaderUniformBundle {
  const nextCol = new THREE.Color(colour)
  const prevCol = new THREE.Color(prevColour ?? colour)
  const nextOuter = isLayered
    ? nextCol.clone()
    : new THREE.Color('#FFFFFF').lerp(nextCol, 0.50)
  const prevOuter = isLayered
    ? prevCol.clone()
    : new THREE.Color('#FFFFFF').lerp(prevCol, 0.50)
  const nextAtten = isLayered ? nextCol.clone() : nextCol.clone().lerp(new THREE.Color('#FFFFFF'), 0.05)
  const prevAtten = isLayered ? prevCol.clone() : prevCol.clone().lerp(new THREE.Color('#FFFFFF'), 0.05)
  const { heightMap } = getEmbossTextures()
  return {
    uTime: { value: 0 },
    uSquash: { value: 1 },
    uDent: { value: 0 },
    uDentY: { value: 0.48 },
    uBend: { value: new THREE.Vector2(0, 0) },
    uWobble: { value: 0 },
    uPour: { value: 1 },
    uPrevColor: { value: prevOuter },
    uNextColor: { value: nextOuter },
    uPrevAtten: { value: prevAtten },
    uNextAtten: { value: nextAtten },
    uEmbossMap: { value: heightMap },
  }
}

function patchJellyShader(
  shader: THREE.WebGLProgramParametersWithUniforms,
  uniforms: ShaderUniformBundle,
  options: { isOuter: boolean; isLayered: boolean },
) {
  Object.assign(shader.uniforms, uniforms)

  shader.vertexShader = shader.vertexShader.replace(
    '#include <common>',
    `#include <common>
uniform float uTime;
uniform float uSquash;
uniform float uDent;
uniform float uDentY;
uniform vec2 uBend;
uniform float uWobble;
varying float vMochiHeight;
varying vec3 vMochiLocalPos;
${options.isOuter ? 'varying vec2 vMochiUv;' : ''}`,
  )

  shader.vertexShader = shader.vertexShader.replace(
    '#include <begin_vertex>',
    `vec3 transformed = vec3(position);
float mochiHeight = clamp((position.y - (${MOCHI_BODY_BASE.toFixed(3)})) / ${MOCHI_BODY_HEIGHT.toFixed(3)}, 0.0, 1.0);
vMochiHeight = mochiHeight;
vMochiLocalPos = position;
${
  options.isOuter
    ? `#ifdef USE_UV
vMochiUv = uv;
#else
vMochiUv = vec2(0.0);
#endif`
    : ''
}
float dentFalloff = exp(-pow((mochiHeight - uDentY) / 0.13, 2.0));
float bulgeShoulder = exp(-pow((mochiHeight - clamp(uDentY + 0.18, 0.05, 0.96)) / 0.12, 2.0)) * 0.055 * uDent;
float bulgeHip = exp(-pow((mochiHeight - clamp(uDentY - 0.18, 0.04, 0.95)) / 0.12, 2.0)) * 0.055 * uDent;
float squash = max(uSquash, 0.64);
float preserveVolume = inversesqrt(squash);
transformed.y = ${MOCHI_BODY_BASE.toFixed(3)} + (transformed.y - (${MOCHI_BODY_BASE.toFixed(3)})) * squash;
transformed.xz *= preserveVolume;
transformed.xz *= 1.0 - dentFalloff * uDent * 0.24 + bulgeShoulder + bulgeHip;
float bendProfile = mochiHeight * mochiHeight * 0.85;
transformed.x += uBend.x * bendProfile;
transformed.z += uBend.y * bendProfile;
float ripple = sin(uTime * 11.0 - mochiHeight * 19.0) * uWobble;
transformed.xz *= 1.0 + ripple * 0.032;`,
  )

  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <common>',
    `#include <common>
uniform float uTime;
uniform float uPour;
uniform vec3 uPrevColor;
uniform vec3 uNextColor;
uniform vec3 uPrevAtten;
uniform vec3 uNextAtten;
${options.isOuter ? 'uniform sampler2D uEmbossMap;\nvarying vec2 vMochiUv;' : ''}
varying float vMochiHeight;
varying vec3 vMochiLocalPos;`,
  )

  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <color_fragment>',
    `#include <color_fragment>
float pourClamp = clamp(uPour, 0.0, 1.0);
float pourAmp = sin(pourClamp * 3.14159265);
float meniscusWave = sin(vMochiLocalPos.x * 7.5 + uTime * 6.5) * 0.026 + cos(vMochiLocalPos.z * 8.8 - uTime * 5.2) * 0.018;
float meniscusY = mix(-0.08, 1.08, pourClamp);
float mochiPourMask = 1.0 - smoothstep(meniscusY - 0.045, meniscusY + 0.045, vMochiHeight + meniscusWave * pourAmp);
float mochiMeniscus = exp(-pow((vMochiHeight + meniscusWave * pourAmp - meniscusY) / 0.028, 2.0)) * pourAmp;
vec3 pourBodyCol = mix(uPrevColor, uNextColor, mochiPourMask);
${
  options.isOuter
    ? `diffuseColor.rgb = pourBodyCol;
float embossSample = texture2D(uEmbossMap, vMochiUv).r;
float embossEdge = smoothstep(0.16, 0.66, embossSample) * (1.0 - smoothstep(0.66, 0.98, embossSample) * 0.45);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.98, 0.96, 0.94), embossEdge * 0.24);`
    : `diffuseColor.rgb = mix(uPrevAtten, uNextAtten, mochiPourMask) * 1.04;`
}`,
  )

  if (options.isOuter && !options.isLayered) {
    shader.fragmentShader = shader.fragmentShader.replace(
      'material.attenuationColor = attenuationColor;',
      `material.attenuationColor = max(mix(uPrevAtten, uNextAtten, mochiPourMask), vec3(0.02));`,
    )
  }

  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <emissivemap_fragment>',
    `#include <emissivemap_fragment>
totalEmissiveRadiance += mix(uNextAtten, vec3(0.98, 0.96, 0.94), 0.35) * mochiMeniscus * 0.28;
${
  options.isLayered
    ? `vec3 viewDirMochi = normalize(vViewPosition);
float rimSil = pow(1.0 - clamp(abs(dot(normal, viewDirMochi)), 0.0, 1.0), 2.5);
float embossFrosted = smoothstep(0.18, 0.72, texture2D(uEmbossMap, vMochiUv).r);
vec3 jellyCol = mix(uPrevAtten, uNextAtten, mochiPourMask);
diffuseColor.rgb = mix(jellyCol * 0.96, mix(jellyCol * 1.12, vec3(0.98, 0.96, 0.94), 0.22), rimSil);
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.98, 0.96, 0.94), embossFrosted * 0.14);
totalEmissiveRadiance += jellyCol * (0.06 + rimSil * 0.12);`
    : options.isOuter
      ? `vec3 viewDirOuter = normalize(vViewPosition);
float outerRim = pow(1.0 - clamp(abs(dot(normal, viewDirOuter)), 0.0, 1.0), 2.4);
totalEmissiveRadiance += mix(uPrevAtten, uNextAtten, mochiPourMask) * (0.04 + outerRim * 0.12);`
      : `vec3 viewDirInner = normalize(vViewPosition);
float coreFresnel = pow(1.0 - clamp(abs(dot(normal, viewDirInner)), 0.0, 1.0), 2.0);
totalEmissiveRadiance += mix(uPrevAtten, uNextAtten, mochiPourMask) * (0.12 + coreFresnel * 0.18);`
}`,
  )
}

export function createDefaultDeformState(): MochiTubeDeformState {
  return {
    squash: 1,
    dent: 0,
    dentY: 0.48,
    bendX: 0,
    bendZ: 0,
    wobble: 0,
    bead: 0,
    pour: 1,
    time: 0,
  }
}

/**
 * Reusable R3F 3D MOCHI silicone lip-jelly tube mesh.
 * Matches MOCHI_*_PK.png silhouette, 8-ring threaded neck, slanted nozzle + glossy bead,
 * Krona One embossed normal map, detachable milky dome cap, jelly deformation & uPour shader.
 */
export function MochiTubeMesh({
  colour,
  prevColour,
  exposed = false,
  tier = 'high',
  aura = '#F2EDE4',
  transmissionMode = 'transmission',
  deformRef,
  onBodyRef,
  onPointerDownBody,
  onPointerOverTube,
  onPointerOutTube,
  liftY = 0,
}: MochiTubeMeshProps) {
  const bodyMeshRef = useRef<THREE.Mesh>(null)
  const outerMatRef = useRef<THREE.MeshPhysicalMaterial | null>(null)
  const innerMatRef = useRef<THREE.MeshPhysicalMaterial | null>(null)
  const threadGroupRef = useRef<THREE.Group>(null)
  const beadMeshRef = useRef<THREE.Mesh>(null)
  const capMeshRef = useRef<THREE.Mesh>(null)
  const rootGroupRef = useRef<THREE.Group>(null)

  const bodyGeo = useMemo(() => getTubeBodyGeometry(), [])
  const innerGeo = useMemo(() => getTubeInnerGeometry(), [])
  const threadGeo = useMemo(() => getTubeThreadGeometry(), [])
  const nozzleGeo = useMemo(() => getTubeNozzleGeometry(), [])
  const beadGeo = useMemo(() => getTubeBeadGeometry(), [])
  const capGeo = useMemo(() => getTubeCapGeometry(), [])
  const { normalMap } = useMemo(() => getEmbossTextures(), [])

  const isLayered = transmissionMode === 'layered'
  const outerUniforms = useMemo(() => createUniformBundle(colour, prevColour, isLayered), [])
  const innerUniforms = useMemo(() => createUniformBundle(colour, prevColour, false), [])
  const transmissionBg = useMemo(() => auraTransmissionBg(aura, 0.16), [aura])

  const colourPair = useMemo(() => {
    const base = new THREE.Color(colour)
    const prev = new THREE.Color(prevColour ?? colour)
    const outerNext = isLayered
      ? base.clone()
      : new THREE.Color('#FFFFFF').lerp(base, 0.50)
    const outerPrev = isLayered
      ? prev.clone()
      : new THREE.Color('#FFFFFF').lerp(prev, 0.50)
    const attenNext = isLayered ? base.clone() : base.clone().lerp(new THREE.Color('#FFFFFF'), 0.05)
    const attenPrev = isLayered ? prev.clone() : prev.clone().lerp(new THREE.Color('#FFFFFF'), 0.05)
    const neckTint = base.clone().lerp(new THREE.Color('#FAF7F2'), 0.56)
    const beadTint = base.clone()
    return { base, prev, outerNext, outerPrev, attenNext, attenPrev, neckTint, beadTint }
  }, [colour, prevColour, isLayered])

  useEffect(() => {
    outerUniforms.uNextColor.value.copy(colourPair.outerNext)
    outerUniforms.uPrevColor.value.copy(colourPair.outerPrev)
    outerUniforms.uNextAtten.value.copy(colourPair.attenNext)
    outerUniforms.uPrevAtten.value.copy(colourPair.attenPrev)

    innerUniforms.uNextColor.value.copy(colourPair.outerNext)
    innerUniforms.uPrevColor.value.copy(colourPair.outerPrev)
    innerUniforms.uNextAtten.value.copy(colourPair.attenNext)
    innerUniforms.uPrevAtten.value.copy(colourPair.attenPrev)
  }, [colourPair, outerUniforms, innerUniforms])

  useEffect(() => {
    onBodyRef?.(bodyMeshRef.current)
    return () => onBodyRef?.(null)
  }, [onBodyRef])

  useLayoutEffect(() => {
    const outerMat = outerMatRef.current as (THREE.MeshPhysicalMaterial & { __mochiPatched?: boolean }) | null
    if (outerMat && !outerMat.__mochiPatched) {
      outerMat.__mochiPatched = true
      const baseCompile = outerMat.onBeforeCompile?.bind(outerMat)
      outerMat.onBeforeCompile = (shader, renderer) => {
        baseCompile?.(shader, renderer)
        patchJellyShader(shader, outerUniforms, { isOuter: true, isLayered })
      }
      outerMat.customProgramCacheKey = () =>
        isLayered ? 'mochi-tube-layered-v2' : 'mochi-tube-trans-v2'
      outerMat.needsUpdate = true
    }

    const innerMat = innerMatRef.current as (THREE.MeshPhysicalMaterial & { __mochiPatched?: boolean }) | null
    if (innerMat && !innerMat.__mochiPatched) {
      innerMat.__mochiPatched = true
      const baseInnerCompile = innerMat.onBeforeCompile?.bind(innerMat)
      innerMat.onBeforeCompile = (shader, renderer) => {
        baseInnerCompile?.(shader, renderer)
        patchJellyShader(shader, innerUniforms, { isOuter: false, isLayered: false })
      }
      innerMat.customProgramCacheKey = () => 'mochi-tube-inner-v2'
      innerMat.needsUpdate = true
    }
  }, [outerUniforms, innerUniforms, isLayered])

  useFrame((_, delta) => {
    const state = deformRef?.current
    const squash = state ? state.squash : 1
    const dent = state ? state.dent : 0
    const dentY = state ? state.dentY : 0.48
    const bendX = state ? state.bendX : 0
    const bendZ = state ? state.bendZ : 0
    const wobble = state ? state.wobble : 0
    const bead = state ? state.bead : 0
    const pour = state ? state.pour : 1
    const t = state ? state.time : (outerUniforms.uTime.value + Math.min(delta, 0.05))

    for (const bundle of [outerUniforms, innerUniforms]) {
      bundle.uTime.value = t
      bundle.uSquash.value = squash
      bundle.uDent.value = dent
      bundle.uDentY.value = dentY
      bundle.uBend.value.set(bendX, bendZ)
      bundle.uWobble.value = wobble
      bundle.uPour.value = pour
    }

    const nozzleShift = MOCHI_BODY_HEIGHT * (squash - 1)
    if (threadGroupRef.current) {
      threadGroupRef.current.position.y = nozzleShift
      threadGroupRef.current.position.x = bendX * 0.85
      threadGroupRef.current.position.z = bendZ * 0.85
      threadGroupRef.current.rotation.z = -bendX * 0.35
      threadGroupRef.current.rotation.x = bendZ * 0.35
    }
    if (capMeshRef.current && !exposed) {
      capMeshRef.current.position.set(bendX * 0.85, MOCHI_CAP_CLOSED_Y + nozzleShift, bendZ * 0.85)
      capMeshRef.current.rotation.z = -bendX * 0.35
      capMeshRef.current.rotation.x = bendZ * 0.35
    }
    if (beadMeshRef.current) {
      const s = 1 + bead * 0.45
      beadMeshRef.current.scale.set(s, s * 1.06, s)
      beadMeshRef.current.position.set(0.025, 1.66 + bead * 0.045, 0.02)
    }
    if (rootGroupRef.current) {
      rootGroupRef.current.position.y = state?.liftY ?? liftY
    }
  })

  const samples = tier === 'mid' ? 3 : 6
  const resolution = tier === 'mid' ? 256 : 512

  return (
    <group ref={rootGroupRef}>
      {/* Inner deep saturated jelly core (only needed for true refractive transmission mode) */}
      {!isLayered && (
        <mesh geometry={innerGeo} name="MOCHI inner jelly" renderOrder={1}>
          <meshPhysicalMaterial
            ref={innerMatRef}
            color={colourPair.attenNext}
            roughness={0.24}
            metalness={0}
            clearcoat={0.5}
            clearcoatRoughness={0.12}
            sheen={0.30}
            sheenColor={colourPair.outerNext}
            envMapIntensity={1.05}
          />
        </mesh>
      )}

      {/* Outer frosted-glossy translucent silicone sleeve (opaque backlit shader on multi-tube pile/stand to eliminate alpha edge halos) */}
      <mesh
        ref={bodyMeshRef}
        geometry={bodyGeo}
        name="MOCHI silicone body"
        renderOrder={2}
        onPointerDown={onPointerDownBody}
        onPointerOver={onPointerOverTube}
        onPointerOut={onPointerOutTube}
      >
        {isLayered ? (
          <meshPhysicalMaterial
            ref={outerMatRef}
            color={colourPair.outerNext}
            transparent={false}
            depthWrite={true}
            roughness={0.16}
            metalness={0}
            ior={1.42}
            clearcoat={1}
            clearcoatRoughness={0.04}
            sheen={0.48}
            sheenRoughness={0.36}
            sheenColor="#FAF7F2"
            normalMap={normalMap}
            normalScale={new THREE.Vector2(1.05, 1.05)}
            envMapIntensity={1.1}
          />
        ) : (
          <MeshTransmissionMaterial
            ref={outerMatRef as any}
            color={colourPair.outerNext}
            background={transmissionBg}
            samples={samples}
            resolution={resolution}
            transmission={0.95}
            thickness={0.62}
            roughness={0.17}
            ior={1.38}
            chromaticAberration={0.018}
            anisotropicBlur={0.10}
            distortion={0.025}
            distortionScale={0.4}
            temporalDistortion={0}
            attenuationColor={colourPair.attenNext}
            attenuationDistance={0.95}
            clearcoat={1}
            clearcoatRoughness={0.05}
            sheen={0.34}
            sheenRoughness={0.42}
            sheenColor="#FAF7F2"
            normalMap={normalMap}
            normalScale={new THREE.Vector2(1.05, 1.05)}
            envMapIntensity={1.05}
          />
        )}
      </mesh>

      {/* 8-ring threaded neck, slanted applicator nozzle & glossy tip bead */}
      <group ref={threadGroupRef}>
        <mesh geometry={threadGeo} name="MOCHI threaded neck" renderOrder={2}>
          <meshPhysicalMaterial
            color={colourPair.neckTint}
            transparent
            opacity={0.78}
            roughness={0.20}
            ior={1.36}
            clearcoat={0.85}
            clearcoatRoughness={0.08}
            sheen={0.3}
            sheenColor="#FAF7F2"
          />
        </mesh>

        <mesh geometry={nozzleGeo} name="MOCHI applicator tip" renderOrder={2}>
          <meshPhysicalMaterial
            color={colourPair.neckTint}
            transparent
            opacity={0.82}
            roughness={0.14}
            ior={1.38}
            clearcoat={1}
            clearcoatRoughness={0.04}
          />
        </mesh>

        <mesh
          ref={beadMeshRef}
          geometry={beadGeo}
          position={[0.025, 1.66, 0.02]}
          rotation={[0.06, 0, -0.44]}
          visible={exposed}
          name="MOCHI jelly bead"
          renderOrder={3}
        >
          <meshPhysicalMaterial
            color={colourPair.beadTint}
            emissive={colourPair.beadTint}
            emissiveIntensity={0.14}
            roughness={0.03}
            metalness={0}
            ior={1.42}
            clearcoat={1}
            clearcoatRoughness={0.015}
            envMapIntensity={1.45}
            transparent
            opacity={0.96}
          />
        </mesh>
      </group>

      {/* Detachable milky-white dome cap */}
      <mesh
        ref={capMeshRef}
        geometry={capGeo}
        position={exposed ? MOCHI_CAP_EXPOSED_POS : [0, MOCHI_CAP_CLOSED_Y, 0]}
        rotation={exposed ? [0, -0.14, 0] : [0, 0, 0]}
        name="MOCHI milk cap"
        renderOrder={2}
        onPointerOver={onPointerOverTube}
        onPointerOut={onPointerOutTube}
      >
        <meshPhysicalMaterial
          color="#FAF7F2"
          roughness={0.26}
          metalness={0}
          sheen={0.42}
          sheenRoughness={0.4}
          sheenColor="#FFFDF9"
          clearcoat={0.62}
          clearcoatRoughness={0.09}
          envMapIntensity={1.05}
        />
      </mesh>
    </group>
  )
}

export default MochiTubeMesh
