import React from 'react'
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { AuraBackdrop, COLORS, FLAVOURS, MochiFonts, SPRINGS, mixHex } from './shared'

export const FlavourReel: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const segmentFrames = 50
  const showcaseFrames = FLAVOURS.length * segmentFrames // 300
  const isFinale = frame >= showcaseFrames

  if (isFinale) {
    const finaleFrame = frame - showcaseFrames
    const pop = spring({ frame: finaleFrame, fps, config: SPRINGS.jelly })
    const scaleY = 0.86 + pop * 0.14
    const scaleX = 1 / Math.sqrt(scaleY)
    return (
      <AbsoluteFill style={{ backgroundColor: COLORS.cream }}>
        <MochiFonts />
        <AuraBackdrop ringColor="#2FA4A8" glowColor="#E46A8E" phase={(frame / 360) * Math.PI * 2} seed={21} />
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', gap: 20 }}>
          <div
            style={{
              fontFamily: "'Krona One', sans-serif",
              fontSize: 112,
              letterSpacing: '-0.03em',
              color: COLORS.ink,
              transform: `scale(${scaleX * (0.85 + pop * 0.15)}, ${scaleY * (0.85 + pop * 0.15)})`,
            }}
          >
            MOCHI
          </div>
          <div
            style={{
              fontFamily: "'Geist Mono Variable', monospace",
              fontSize: 16,
              letterSpacing: '0.16em',
              color: COLORS.ink,
              opacity: interpolate(finaleFrame, [8, 22], [0, 0.78], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
            }}
          >
            LIP JELLY — DROP 01 — SIX MOODS
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
    )
  }

  const index = Math.min(FLAVOURS.length - 1, Math.floor(frame / segmentFrames))
  const localFrame = frame - index * segmentFrames
  const curr = FLAVOURS[index]
  const prev = FLAVOURS[Math.max(0, index - 1)]

  const auraMix = interpolate(localFrame, [0, 18], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const ring = mixHex(prev.aura, curr.aura, index === 0 ? 1 : auraMix)
  const glow = mixHex(prev.jelly, curr.jelly, index === 0 ? 1 : auraMix)

  const enter = spring({ frame: localFrame, fps, config: SPRINGS.jelly })
  const exit = localFrame > segmentFrames - 10 ? interpolate(localFrame, [segmentFrames - 10, segmentFrames], [0, 1]) : 0

  const yOffset = (1 - enter) * -140 + exit * 60
  const squashY = 0.88 + enter * 0.12 - exit * 0.04
  const squashX = 1 / Math.sqrt(Math.max(0.75, squashY))
  const rotateDeg = exit * 8

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.cream }}>
      <MochiFonts />
      <AuraBackdrop ringColor={ring} glowColor={glow} phase={(frame / 180) * Math.PI * 2} seed={31 + index} />

      {/* Top metadata */}
      <div
        style={{
          position: 'absolute',
          top: 56,
          left: 48,
          right: 48,
          display: 'flex',
          justifyContent: 'space-between',
          fontFamily: "'Geist Mono Variable', monospace",
          fontSize: 15,
          letterSpacing: '0.12em',
          color: COLORS.ink,
        }}
      >
        <span>06 FLAVOURS — 9 ML</span>
        <span>{curr.index}/06</span>
      </div>

      {/* Giant flavour word behind tube */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            fontFamily: "'Krona One', sans-serif",
            fontSize: 108,
            letterSpacing: '-0.04em',
            color: curr.jelly,
            opacity: (1 - exit) * 0.88,
            transform: `translateY(${(1 - enter) * 24}px)`,
            textTransform: 'lowercase',
          }}
        >
          {curr.key}
        </div>
      </div>

      {/* Aura-tinted contact shadow */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: 228,
          width: 280 * enter,
          height: 36,
          transform: 'translateX(-50%)',
          background: `radial-gradient(ellipse at center, ${curr.aura}66 0%, transparent 70%)`,
          filter: 'blur(9px)',
          opacity: 1 - exit,
        }}
      />

      {/* Real transparent cutout */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 480,
          height: 600,
          transform: `translate(-50%, -52%) translateY(${yOffset}px) rotate(${rotateDeg}deg) scale(${squashX}, ${squashY})`,
          opacity: 1 - exit,
        }}
      >
        <Img
          src={staticFile(`/media/cutouts/mochi-${curr.key}.png`)}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      </div>

      {/* Line-masked mood line */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 120,
          overflow: 'hidden',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontFamily: "'Krona One', sans-serif",
            fontSize: 34,
            color: COLORS.ink,
            transform: `translateY(${(1 - Math.min(1, enter)) * 110}%)`,
          }}
        >
          {curr.key} —{' '}
          <span style={{ fontFamily: "'Instrument Serif', serif", fontStyle: 'italic', fontSize: 44 }}>
            {curr.mood}
          </span>
        </div>
      </div>
    </AbsoluteFill>
  )
}
