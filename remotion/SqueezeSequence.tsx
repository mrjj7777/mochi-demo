import React from 'react'
import { AbsoluteFill, Img, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { AuraBackdrop, COLORS, MochiFonts, SPRINGS, getFlavour } from './shared'

// Pre-encoded 128x128 radial/Gaussian displacement gradient centered in the middle third of the tube:
// Red channel = X displacement (128 neutral, <128 pulls left, >128 pulls right -> inward middle dent)
// Green channel = Y displacement (128 neutral)
const DENT_MAP_SVG = encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="160" height="200" viewBox="0 0 160 200">
  <rect width="160" height="200" fill="rgb(128,128,0)"/>
  <defs>
    <radialGradient id="gL" cx="30%" cy="54%" r="34%">
      <stop offset="0%" stop-color="rgb(220,128,0)" stop-opacity="0.95"/>
      <stop offset="65%" stop-color="rgb(175,128,0)" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="rgb(128,128,0)" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="gR" cx="70%" cy="54%" r="34%">
      <stop offset="0%" stop-color="rgb(36,128,0)" stop-opacity="0.95"/>
      <stop offset="65%" stop-color="rgb(80,128,0)" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="rgb(128,128,0)" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="160" height="200" fill="url(#gL)"/>
  <rect width="160" height="200" fill="url(#gR)" style="mix-blend-mode:normal"/>
</svg>
`)

export const SqueezeSequence: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()
  const cherry = getFlavour('cherry')

  // Press ramps up cleanly 0..42, peaks at ~44, releases at 50 with SPRINGS.jelly wobble!
  const pressIn = spring({ frame, fps, config: SPRINGS.settle, durationInFrames: 42 })
  const releaseOut =
    frame >= 48
      ? spring({ frame: frame - 48, fps, config: SPRINGS.jelly })
      : 0

  const squeeze = Math.max(0, pressIn - releaseOut)
  const dentScale = squeeze * 58
  const bodyScaleX = 1 + squeeze * 0.04
  const bodyScaleY = 1 - squeeze * 0.06
  const beadScale = 0.2 + squeeze * 0.95
  const textCompression = 1 - squeeze * 0.22
  const phase = (frame / durationInFrames) * Math.PI * 2

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.cream }}>
      <MochiFonts />
      <AuraBackdrop ringColor={cherry.aura} glowColor={cherry.jelly} phase={phase} seed={11} />

      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <filter
            id="mochi-squeeze-dent"
            x="-10%"
            y="-10%"
            width="120%"
            height="120%"
            colorInterpolationFilters="sRGB"
          >
            <feImage
              href={`data:image/svg+xml,${DENT_MAP_SVG}`}
              x="0"
              y="0"
              width="100%"
              height="100%"
              result="dentMap"
              preserveAspectRatio="none"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="dentMap"
              scale={dentScale}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      {/* Title reacting synchronously to squeeze pressure */}
      <div
        style={{
          position: 'absolute',
          top: 56,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontFamily: "'Krona One', sans-serif",
          fontSize: 44,
          letterSpacing: '-0.03em',
          color: COLORS.ink,
          transform: `scaleX(${textCompression})`,
        }}
      >
        one squeeze.
      </div>

      {/* Contact shadow tinted with teal aura */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: 108,
          width: 310 + squeeze * 24,
          height: 36,
          transform: 'translateX(-50%)',
          background: `radial-gradient(ellipse at center, ${cherry.aura}55 0%, transparent 70%)`,
          filter: 'blur(8px)',
        }}
      />

      {/* Real transparent cherry cutout with middle dent + volume-preserving squash */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: 92,
          width: 600,
          height: 750,
          transform: `translateX(-50%) scale(${bodyScaleX}, ${bodyScaleY})`,
          transformOrigin: '50% 94%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            filter: dentScale > 0.2 ? 'url(#mochi-squeeze-dent)' : undefined,
          }}
        >
          <Img
            src={staticFile('/media/cutouts/mochi-cherry.png')}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </div>

        {/* Swelling glossy cherry jelly bead resting on the slanted applicator tip */}
        <div
          style={{
            position: 'absolute',
            left: '43.4%',
            top: '10.6%',
            width: 30,
            height: 32,
            borderRadius: '54% 46% 52% 48%',
            transform: `translate(-50%, -50%) scale(${beadScale})`,
            opacity: Math.max(0, Math.min(0.94, (squeeze - 0.05) * 1.4)),
            background: 'radial-gradient(circle at 32% 28%, rgba(255,145,165,0.92) 0%, #b3122e 45%, #5a0210 100%)',
            boxShadow: 'inset 3px 3px 6px rgba(255,255,255,0.5)',
          }}
        />
      </div>

      <div
        style={{
          position: 'absolute',
          left: 44,
          right: 44,
          bottom: 36,
          display: 'flex',
          justifyContent: 'space-between',
          fontFamily: "'Geist Mono Variable', monospace",
          fontSize: 12,
          letterSpacing: '0.12em',
          color: COLORS.ink,
          opacity: 0.72,
        }}
      >
        <span>9 ML · SILICONE TUBE</span>
        <span>JELLY, NOT STICKY</span>
      </div>
    </AbsoluteFill>
  )
}
