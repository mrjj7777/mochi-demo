import React from 'react'
import { staticFile, useCurrentFrame } from 'remotion'
import tokens from '../docs/design/tokens.json'

export type FlavourToken = (typeof tokens.flavours)[number]
export const FLAVOURS: FlavourToken[] = tokens.flavours
export const SPRINGS = tokens.motion.springs
export const COLORS = tokens.color

export function getFlavour(key: string): FlavourToken {
  return FLAVOURS.find(f => f.key === key) ?? FLAVOURS[0]
}

export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ]
}

export function mixHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a)
  const [br, bg, bb] = hexToRgb(b)
  const u = Math.max(0, Math.min(1, t))
  const r = Math.round(ar + (br - ar) * u)
  const g = Math.round(ag + (bg - ag) * u)
  const bl = Math.round(ab + (bb - ab) * u)
  return `#${[r, g, bl].map(v => v.toString(16).padStart(2, '0')).join('')}`
}

export const MochiFonts: React.FC = () => (
  <style>{`
    @font-face {
      font-family: 'Krona One';
      src: url('${staticFile('/fonts/krona-one-400-normal.ttf')}') format('truetype');
      font-weight: 400;
      font-style: normal;
    }
    @font-face {
      font-family: 'Instrument Serif';
      src: url('${staticFile('/fonts/instrument-serif-latin-400-italic.woff2')}') format('woff2');
      font-weight: 400;
      font-style: italic;
    }
    @font-face {
      font-family: 'Geist Mono Variable';
      src: url('${staticFile('/fonts/geist-mono-latin-wght-normal.woff2')}') format('woff2');
      font-weight: 100 900;
      font-style: normal;
    }
    * { box-sizing: border-box; }
  `}</style>
)

const GRAIN_SVG = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch"/></filter><rect width="180" height="180" filter="url(#n)" opacity="0.85"/></svg>`,
)

export const AuraBackdrop: React.FC<{
  ringColor: string
  glowColor: string
  phase?: number
  seed?: number
}> = ({ ringColor, glowColor, phase = 0, seed = 1 }) => {
  const frame = useCurrentFrame()
  const grainTick = Math.floor(frame / 4) // ~7.5-8 fps grain cadence
  const cx1 = 50 + Math.sin(phase) * 4.5
  const cy1 = 48 + Math.cos(phase) * 4.2
  const cx2 = 34 + Math.cos(phase + 1.4) * 6
  const cy2 = 62 + Math.sin(phase + 1.1) * 5
  const ringScale = 1 + Math.sin(phase) * 0.04

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: COLORS.cream,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: '-14%',
          transform: `scale(${ringScale})`,
          background: `
            radial-gradient(circle at ${cx1}% ${cy1}%, ${ringColor}8c 0%, ${ringColor}48 24%, ${ringColor}14 48%, transparent 72%),
            radial-gradient(circle at ${cx2}% ${cy2}%, ${glowColor}5c 0%, ${glowColor}24 28%, transparent 66%),
            radial-gradient(circle at 72% 28%, ${ringColor}36 0%, transparent 54%)
          `,
        }}
      />
      {/* Warm subtle left film light leak matching MOCHI photography */}
      <div
        style={{
          position: 'absolute',
          left: '-3%',
          top: 0,
          bottom: 0,
          width: '14%',
          background: 'linear-gradient(90deg, rgba(240,138,60,0.22) 0%, rgba(244,162,126,0.08) 45%, transparent 100%)',
          opacity: 0.72 + Math.sin(phase * 2) * 0.14,
        }}
      />
      {/* Deterministic 8fps tiled film grain layer */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url("data:image/svg+xml,${GRAIN_SVG}")`,
          backgroundSize: '180px 180px',
          backgroundPosition: `${((grainTick * 43 + seed * 19) % 180)}px ${((grainTick * 71 + seed * 31) % 180)}px`,
          opacity: 0.08,
          mixBlendMode: 'multiply',
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}
