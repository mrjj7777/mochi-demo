import React from 'react'
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion'
import { AuraBackdrop, COLORS, MochiFonts, getFlavour } from './shared'

export type AuraLoopProps = {
  flavourKey: string
}

export const AuraLoop: React.FC<AuraLoopProps> = ({ flavourKey }) => {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  const flavour = getFlavour(flavourKey)
  // Seamless 0..2PI cycle so frame 0 == frame N
  const phase = (frame / durationInFrames) * Math.PI * 2

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.cream }}>
      <MochiFonts />
      <AuraBackdrop ringColor={flavour.aura} glowColor={flavour.jelly} phase={phase} seed={3} />
      <div
        style={{
          position: 'absolute',
          left: 44,
          bottom: 36,
          fontFamily: "'Geist Mono Variable', monospace",
          fontSize: 13,
          letterSpacing: '0.14em',
          color: COLORS.ink,
          opacity: 0.56,
          textTransform: 'uppercase',
        }}
      >
        MOCHI · {flavour.name} — {flavour.mood.toUpperCase()}
      </div>
    </AbsoluteFill>
  )
}
