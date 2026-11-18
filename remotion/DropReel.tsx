import React from 'react'
import { AbsoluteFill, Img, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { AuraBackdrop, COLORS, FLAVOURS, MochiFonts, SPRINGS } from './shared'

type FallingTube = {
  id: number
  flavourKey: string
  x: number
  yLand: number
  rot: number
  delay: number
  scale: number
}

// 18 tubes (3 per flavour) arranged deterministically into a lush layered pile
const PILE_TUBES: FallingTube[] = Array.from({ length: 18 }, (_, i) => {
  const flavour = FLAVOURS[i % FLAVOURS.length]
  const row = Math.floor(i / 6)
  const col = i % 6
  const jitter = Math.sin(i * 19.3) * 34
  return {
    id: i,
    flavourKey: flavour.key,
    x: 170 + col * 106 + (row % 2) * 32 + jitter,
    yLand: 745 - row * 72 + Math.cos(i * 7.1) * 18,
    rot: Math.sin(i * 11.7) * 52,
    delay: 8 + i * 5,
    scale: 0.72 + (i % 3) * 0.05,
  }
})

export const DropReel: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const headlineSpring = spring({ frame: Math.max(0, frame - 6), fps, config: SPRINGS.settle })

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.cream }}>
      <MochiFonts />
      <AuraBackdrop ringColor="#E46A8E" glowColor="#F2B632" phase={(frame / 180) * Math.PI * 2} seed={77} />

      <div
        style={{
          position: 'absolute',
          top: 72,
          left: 60,
          right: 60,
          zIndex: 2,
          transform: `translateY(${(1 - headlineSpring) * 28}px)`,
        }}
      >
        <div
          style={{
            fontFamily: "'Krona One', sans-serif",
            fontSize: 78,
            lineHeight: 0.92,
            letterSpacing: '-0.03em',
            color: COLORS.ink,
          }}
        >
          all six.
        </div>
        <div
          style={{
            marginTop: 18,
            fontFamily: "'Geist Mono Variable', monospace",
            fontSize: 22,
            color: COLORS.ink,
          }}
        >
          can’t pick?{' '}
          <span style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontSize: 42 }}>
            don’t.
          </span>
        </div>
      </div>

      {/* Aura floor contact glow */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: 108,
          width: 680,
          height: 68,
          transform: 'translateX(-50%)',
          background: 'radial-gradient(ellipse at center, rgba(228,106,142,0.34) 0%, transparent 72%)',
          filter: 'blur(14px)',
        }}
      />

      {PILE_TUBES.map(tube => {
        const t = Math.max(0, frame - tube.delay)
        const fall = spring({ frame: t, fps, config: SPRINGS.jelly })
        const y = -280 + fall * (tube.yLand + 280)
        // Subtle landing squash right after impact
        const impactVel = Math.max(0, 1 - Math.abs(fall - 1) * 10)
        const scaleY = 1 - impactVel * 0.08 * Math.sin(t * 0.5)
        const scaleX = 1 / Math.sqrt(Math.max(0.8, scaleY))
        const rot = tube.rot * Math.min(1, fall * 1.15)

        return (
          <div
            key={tube.id}
            style={{
              position: 'absolute',
              left: tube.x,
              top: y,
              width: 200,
              height: 250,
              transform: `translate(-50%, -50%) rotate(${rot}deg) scale(${tube.scale * scaleX}, ${tube.scale * scaleY})`,
              zIndex: 4 + tube.id,
            }}
          >
            <Img
              src={staticFile(`/media/cutouts/mochi-${tube.flavourKey}.png`)}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>
        )
      })}
    </AbsoluteFill>
  )
}
