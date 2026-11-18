import React from 'react'
import { Composition } from 'remotion'
import { AuraLoop } from './AuraLoop'
import { DropReel } from './DropReel'
import { FlavourReel } from './FlavourReel'
import { SqueezeSequence } from './SqueezeSequence'
import { FLAVOURS } from './shared'

export const MochiRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="SqueezeSequence"
        component={SqueezeSequence}
        durationInFrames={90}
        fps={30}
        width={768}
        height={960}
      />
      <Composition
        id="FlavourReel"
        component={FlavourReel}
        durationInFrames={360}
        fps={30}
        width={720}
        height={1280}
      />
      <Composition
        id="DropReel"
        component={DropReel}
        durationInFrames={180}
        fps={30}
        width={864}
        height={1080}
      />
      {FLAVOURS.map(f => (
        <Composition
          key={f.key}
          id={`AuraLoop-${f.key}`}
          component={AuraLoop}
          durationInFrames={120}
          fps={30}
          width={1280}
          height={720}
          defaultProps={{ flavourKey: f.key }}
        />
      ))}
    </>
  )
}
