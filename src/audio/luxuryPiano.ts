/**
 * Luxury Concert Grand Piano Engine (Real Yamaha C5 Salamander Samples)
 * Plays a serene, seamless 16-bar hotel-lounge grand piano composition built
 * directly around JJ's exact D-minor / F-major / Bbmaj9 pentatonic motif:
 *   A4 -> C5 -> D5 -> F5 -> G5 -> A5 -> C6 -> A5 -> G5 -> F5 -> D5
 * Zero drums, zero synth oscillators — 100% real studio-recorded piano samples
 * through a custom stereo marble-atrium convolution reverb and warm felt EQ.
 */

const SAMPLE_LIST: Array<{ midi: number; file: string }> = [
  { midi: 36, file: 'C2.mp3' },
  { midi: 45, file: 'A2.mp3' },
  { midi: 48, file: 'C3.mp3' },
  { midi: 51, file: 'Ds3.mp3' },
  { midi: 54, file: 'Fs3.mp3' },
  { midi: 57, file: 'A3.mp3' },
  { midi: 60, file: 'C4.mp3' },
  { midi: 63, file: 'Ds4.mp3' },
  { midi: 66, file: 'Fs4.mp3' },
  { midi: 69, file: 'A4.mp3' },
  { midi: 72, file: 'C5.mp3' },
  { midi: 75, file: 'Ds5.mp3' },
  { midi: 78, file: 'Fs5.mp3' },
  { midi: 81, file: 'A5.mp3' },
  { midi: 84, file: 'C6.mp3' },
]

const NOTE_MAP: Record<string, number> = {
  C: 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  F: 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11,
}

function noteToMidi(note: string): number {
  const match = /^([A-G][#b]?)(-?\d)$/.exec(note)
  if (!match) return 60
  const [, pitch, oct] = match
  return (Number(oct) + 1) * 12 + (NOTE_MAP[pitch] ?? 0)
}

type ScoreNote = {
  /** Beat position (0..64 across 16 bars of 4/4 at ~72 BPM) */
  beat: number
  note: string
  /** Soft velocity 0..1 */
  vel: number
  /** Duration in seconds before soft damper release */
  dur: number
}

function rollChord(beat: number, notes: string[], vel: number, dur: number, spreadBeats = 0.09): ScoreNote[] {
  return notes.map((note, idx) => ({
    beat: beat + idx * spreadBeats,
    note,
    vel: vel * (idx === 0 ? 1.05 : 0.86 + idx * 0.03),
    dur,
  }))
}

/**
 * 16-bar (64-beat) luxury hotel grand piano arrangement built directly on JJ's melody:
 * Opening & closing motif: A4 -> C5 -> D5 -> F5 -> G5 -> A5 -> C6 -> A5 -> G5 -> F5 -> D5
 */
const LUXURY_SCORE: ScoreNote[] = [
  // === PHRASE A (Bars 1–4): JJ's signature motif over Bbmaj9 -> Am9 -> Dm9 ===
  ...rollChord(0, ['Bb2', 'F3', 'A3', 'C4', 'D4'], 0.34, 4.6),
  { beat: 0.5, note: 'A4', vel: 0.42, dur: 2.2 },
  { beat: 1.25, note: 'C5', vel: 0.45, dur: 2.2 },
  { beat: 2.0, note: 'D5', vel: 0.48, dur: 2.4 },
  { beat: 2.75, note: 'F5', vel: 0.5, dur: 2.4 },
  { beat: 3.5, note: 'G5', vel: 0.48, dur: 2.4 },

  ...rollChord(4, ['A2', 'E3', 'G3', 'C4'], 0.32, 4.4),
  { beat: 4.25, note: 'A5', vel: 0.52, dur: 2.8 },
  { beat: 5.25, note: 'C6', vel: 0.48, dur: 3.2 },
  { beat: 6.5, note: 'A5', vel: 0.42, dur: 2.6 },
  { beat: 7.25, note: 'G5', vel: 0.38, dur: 2.4 },

  ...rollChord(8, ['D2', 'A2', 'E3', 'F3', 'C4'], 0.36, 5.4),
  { beat: 8.5, note: 'F5', vel: 0.44, dur: 2.8 },
  { beat: 9.5, note: 'E5', vel: 0.4, dur: 3.0 },
  { beat: 10.75, note: 'D5', vel: 0.44, dur: 3.6 },
  { beat: 12.25, note: 'A4', vel: 0.34, dur: 3.2 },
  { beat: 13.5, note: 'C5', vel: 0.32, dur: 3.0 },
  { beat: 14.75, note: 'E5', vel: 0.3, dur: 2.8 },

  // === PHRASE B (Bars 5–8): Dreamy hotel-atrium answer over Gm9 -> C9sus4 -> Fmaj9 -> A7sus4 ===
  ...rollChord(16, ['G2', 'D3', 'F3', 'A3', 'Bb3'], 0.34, 4.6),
  { beat: 16.5, note: 'D5', vel: 0.44, dur: 2.2 },
  { beat: 17.25, note: 'F5', vel: 0.46, dur: 2.2 },
  { beat: 18.0, note: 'G5', vel: 0.48, dur: 2.4 },
  { beat: 18.75, note: 'A5', vel: 0.5, dur: 2.6 },

  ...rollChord(20, ['C2', 'G2', 'Bb3', 'D4', 'F4'], 0.33, 4.6),
  { beat: 20.5, note: 'C6', vel: 0.48, dur: 3.0 },
  { beat: 21.75, note: 'A5', vel: 0.42, dur: 2.6 },
  { beat: 22.5, note: 'G5', vel: 0.4, dur: 2.4 },
  { beat: 23.25, note: 'F5', vel: 0.38, dur: 2.6 },

  ...rollChord(24, ['F2', 'C3', 'G3', 'A3', 'E4'], 0.35, 4.8),
  { beat: 24.75, note: 'G5', vel: 0.42, dur: 2.6 },
  { beat: 25.75, note: 'A5', vel: 0.44, dur: 2.8 },
  { beat: 27.0, note: 'E5', vel: 0.38, dur: 3.0 },

  ...rollChord(28, ['A2', 'E3', 'G3', 'D4'], 0.31, 4.4),
  { beat: 28.75, note: 'D5', vel: 0.4, dur: 2.8 },
  { beat: 30.0, note: 'C5', vel: 0.36, dur: 2.8 },
  { beat: 31.0, note: 'A4', vel: 0.34, dur: 2.6 },

  // === PHRASE C (Bars 9–12): Spacious felt-piano bloom over Bbmaj9 -> C6/9 -> Dm11 -> Am9 ===
  ...rollChord(32, ['Bb2', 'F3', 'A3', 'D4'], 0.33, 4.8),
  { beat: 33.0, note: 'F4', vel: 0.36, dur: 2.4 },
  { beat: 33.75, note: 'A4', vel: 0.4, dur: 2.4 },
  { beat: 34.5, note: 'C5', vel: 0.44, dur: 2.6 },
  { beat: 35.25, note: 'D5', vel: 0.46, dur: 2.8 },

  ...rollChord(36, ['C3', 'G3', 'A3', 'D4', 'E4'], 0.33, 4.6),
  { beat: 36.75, note: 'G5', vel: 0.44, dur: 2.6 },
  { beat: 37.75, note: 'F5', vel: 0.42, dur: 2.6 },
  { beat: 38.75, note: 'E5', vel: 0.4, dur: 2.8 },

  ...rollChord(40, ['D2', 'A2', 'F3', 'G3', 'C4'], 0.35, 5.2),
  { beat: 40.75, note: 'A4', vel: 0.4, dur: 2.4 },
  { beat: 41.5, note: 'D5', vel: 0.44, dur: 2.6 },
  { beat: 42.5, note: 'F5', vel: 0.46, dur: 3.0 },
  { beat: 43.75, note: 'E5', vel: 0.38, dur: 2.8 },

  ...rollChord(44, ['A2', 'E3', 'B3', 'C4'], 0.3, 4.4),
  { beat: 45.0, note: 'G5', vel: 0.4, dur: 2.8 },
  { beat: 46.25, note: 'E5', vel: 0.36, dur: 2.8 },
  { beat: 47.25, note: 'C5', vel: 0.34, dur: 2.4 },

  // === PHRASE D (Bars 13–16): JJ's signature closing cascade over Bbmaj9 -> Gm9 -> Am7 -> Dm9 ===
  ...rollChord(48, ['Bb2', 'F3', 'A3', 'C4', 'D4'], 0.35, 4.6),
  { beat: 48.5, note: 'D5', vel: 0.45, dur: 2.2 },
  { beat: 49.25, note: 'F5', vel: 0.48, dur: 2.2 },
  { beat: 50.0, note: 'G5', vel: 0.5, dur: 2.4 },
  { beat: 50.75, note: 'A5', vel: 0.52, dur: 2.6 },

  ...rollChord(52, ['G2', 'D3', 'F3', 'A3', 'Bb3'], 0.34, 4.6),
  { beat: 52.25, note: 'C6', vel: 0.5, dur: 2.8 },
  { beat: 53.25, note: 'A5', vel: 0.46, dur: 2.4 },
  { beat: 54.0, note: 'G5', vel: 0.44, dur: 2.4 },
  { beat: 54.75, note: 'F5', vel: 0.42, dur: 2.4 },

  ...rollChord(56, ['A2', 'E3', 'G3', 'C4'], 0.32, 4.4),
  { beat: 56.25, note: 'D5', vel: 0.46, dur: 2.8 },
  { beat: 57.5, note: 'G5', vel: 0.42, dur: 2.6 },
  { beat: 58.75, note: 'F5', vel: 0.38, dur: 2.4 },
  { beat: 59.5, note: 'E5', vel: 0.36, dur: 2.4 },

  ...rollChord(60, ['D2', 'A2', 'F3', 'C4', 'E4', 'A4'], 0.34, 6.0, 0.11),
  { beat: 61.5, note: 'D5', vel: 0.4, dur: 4.5 },
]

const TOTAL_BEATS = 64
const BPM = 72
const SEC_PER_BEAT = 60 / BPM

function createConcertHallImpulse(ctx: AudioContext, seconds = 3.5, decay = 2.6): AudioBuffer {
  const rate = ctx.sampleRate
  const length = Math.floor(rate * seconds)
  const impulse = ctx.createBuffer(2, length, rate)

  for (let ch = 0; ch < 2; ch += 1) {
    const data = impulse.getChannelData(ch)
    let lp = 0
    for (let i = 0; i < length; i += 1) {
      const t = i / length
      const env = Math.pow(1 - t, decay)
      const white = Math.random() * 2 - 1
      // Warm velvet low-pass inside the reverb tail so high frequencies glow like a marble hall
      lp = lp * 0.68 + white * 0.32
      data[i] = lp * env * 0.55
    }
    // Subtle early hotel-atrium reflections
    const earlyMs = ch === 0 ? [18, 37, 63, 94] : [22, 43, 71, 102]
    earlyMs.forEach((ms, idx) => {
      const pos = Math.floor((ms / 1000) * rate)
      if (pos < length) data[pos] += (0.28 - idx * 0.05) * (ch === 0 ? 1 : -1)
    })
  }
  return impulse
}

class LuxuryPianoEngine {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null
  private dryBus: GainNode | null = null
  private wetBus: GainNode | null = null
  private buffers = new Map<number, AudioBuffer>()
  private loadingPromise: Promise<void> | null = null
  private playing = false
  private schedulerId = 0
  private nextLoopStart = 0
  private scheduledUntil = 0
  private listeners = new Set<(playing: boolean) => void>()
  private visibilityBound = false

  private bindVisibility() {
    if (this.visibilityBound || typeof document === 'undefined') return
    this.visibilityBound = true
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx || !this.playing) return
      if (document.visibilityState === 'hidden') {
        this.ctx.suspend().catch(() => {})
      } else {
        this.ctx
          .resume()
          .then(() => {
            if (!this.ctx) return
            this.scheduledUntil = this.ctx.currentTime
            this.nextLoopStart = this.ctx.currentTime + 0.1
            this.scheduleAhead()
          })
          .catch(() => {})
      }
    })
  }

  subscribe(fn: (playing: boolean) => void) {
    this.listeners.add(fn)
    fn(this.playing)
    return () => {
      this.listeners.delete(fn)
    }
  }

  private emit() {
    this.listeners.forEach(fn => fn(this.playing))
  }

  isPlaying() {
    return this.playing
  }

  private ensureContext() {
    if (this.ctx) return this.ctx
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new AudioCtx()
    this.ctx = ctx

    // Warm felt-grand EQ + gentle compression + stereo concert hall convolution reverb
    const master = ctx.createGain()
    master.gain.value = 0.0001

    const lowWarmth = ctx.createBiquadFilter()
    lowWarmth.type = 'lowshelf'
    lowWarmth.frequency.value = 190
    lowWarmth.gain.value = 2.4

    const highVelvet = ctx.createBiquadFilter()
    highVelvet.type = 'highshelf'
    highVelvet.frequency.value = 3600
    highVelvet.gain.value = -3.8

    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -16
    comp.knee.value = 18
    comp.ratio.value = 3
    comp.attack.value = 0.025
    comp.release.value = 0.25

    const dry = ctx.createGain()
    dry.gain.value = 0.62

    const wet = ctx.createGain()
    wet.gain.value = 0.48

    const convolver = ctx.createConvolver()
    convolver.buffer = createConcertHallImpulse(ctx, 3.6, 2.5)

    dry.connect(lowWarmth)
    wet.connect(convolver)
    convolver.connect(lowWarmth)

    lowWarmth.connect(highVelvet)
    highVelvet.connect(comp)
    comp.connect(master)
    master.connect(ctx.destination)

    this.masterGain = master
    this.dryBus = dry
    this.wetBus = wet
    return ctx
  }

  private async loadSamples(ctx: AudioContext) {
    if (this.buffers.size >= SAMPLE_LIST.length) return
    if (this.loadingPromise) return this.loadingPromise

    this.loadingPromise = Promise.all(
      SAMPLE_LIST.map(async sample => {
        try {
          const res = await fetch(`/media/audio/piano/${sample.file}`)
          if (!res.ok) return
          const arr = await res.arrayBuffer()
          const decoded = await ctx.decodeAudioData(arr)
          this.buffers.set(sample.midi, decoded)
        } catch {
          // Skip individual decode failure gracefully
        }
      }),
    ).then(() => {})

    return this.loadingPromise
  }

  private findClosestSample(targetMidi: number): { midi: number; buffer: AudioBuffer } | null {
    let bestMidi = -1
    let bestDist = Number.POSITIVE_INFINITY
    for (const midi of this.buffers.keys()) {
      const d = Math.abs(midi - targetMidi)
      if (d < bestDist) {
        bestDist = d
        bestMidi = midi
      }
    }
    const buf = this.buffers.get(bestMidi)
    return buf ? { midi: bestMidi, buffer: buf } : null
  }

  private triggerNote(noteName: string, when: number, vel: number, dur: number) {
    const ctx = this.ctx
    if (!ctx || !this.dryBus || !this.wetBus) return
    const targetMidi = noteToMidi(noteName)
    const sample = this.findClosestSample(targetMidi)
    if (!sample) return

    const src = ctx.createBufferSource()
    src.buffer = sample.buffer
    src.playbackRate.value = Math.pow(2, (targetMidi - sample.midi) / 12)

    // Natural grand-piano stereo imaging: bass gently left, treble gently right
    const panner = ctx.createStereoPanner()
    panner.pan.value = Math.max(-0.28, Math.min(0.28, ((targetMidi - 60) / 30) * 0.24))

    const env = ctx.createGain()
    const humanVel = vel * (0.94 + Math.random() * 0.12)
    const startTime = Math.max(ctx.currentTime + 0.01, when + (Math.random() - 0.5) * 0.014)
    env.gain.setValueAtTime(0.0001, startTime)
    env.gain.linearRampToValueAtTime(humanVel, startTime + 0.012)
    env.gain.setValueAtTime(humanVel, startTime + Math.max(0.25, dur * 0.65))
    env.gain.exponentialRampToValueAtTime(0.0001, startTime + dur + 1.15)

    src.connect(env)
    env.connect(panner)
    panner.connect(this.dryBus)
    panner.connect(this.wetBus)

    src.start(startTime)
    src.stop(startTime + dur + 1.3)
  }

  private scheduleAhead = () => {
    const ctx = this.ctx
    if (!ctx || !this.playing) return

    const horizon = ctx.currentTime + 1.8
    const loopDur = TOTAL_BEATS * SEC_PER_BEAT

    while (this.scheduledUntil < horizon) {
      const windowStart = this.scheduledUntil
      const windowEnd = Math.min(horizon, this.nextLoopStart + loopDur)

      for (const item of LUXURY_SCORE) {
        const noteTime = this.nextLoopStart + item.beat * SEC_PER_BEAT
        if (noteTime >= windowStart && noteTime < windowEnd) {
          this.triggerNote(item.note, noteTime, item.vel, item.dur)
        }
      }

      this.scheduledUntil = windowEnd
      if (this.scheduledUntil >= this.nextLoopStart + loopDur - 0.001) {
        this.nextLoopStart += loopDur
      }
    }
  }

  async start() {
    this.bindVisibility()
    const ctx = this.ensureContext()
    if (ctx.state === 'suspended') {
      await ctx.resume()
    }
    await this.loadSamples(ctx)
    if (this.buffers.size === 0) return

    if (!this.playing) {
      this.playing = true
      this.nextLoopStart = ctx.currentTime + 0.12
      this.scheduledUntil = ctx.currentTime
      this.scheduleAhead()
      this.schedulerId = window.setInterval(this.scheduleAhead, 350)

      if (this.masterGain) {
        const now = ctx.currentTime
        this.masterGain.gain.cancelScheduledValues(now)
        this.masterGain.gain.setValueAtTime(Math.max(0.0001, this.masterGain.gain.value), now)
        this.masterGain.gain.linearRampToValueAtTime(0.56, now + 1.35)
      }
      this.emit()
    }
  }

  stop() {
    if (!this.playing) return
    this.playing = false
    if (this.schedulerId) {
      window.clearInterval(this.schedulerId)
      this.schedulerId = 0
    }
    if (this.ctx && this.masterGain) {
      const now = this.ctx.currentTime
      this.masterGain.gain.cancelScheduledValues(now)
      this.masterGain.gain.setValueAtTime(Math.max(0.0001, this.masterGain.gain.value), now)
      this.masterGain.gain.linearRampToValueAtTime(0.0001, now + 0.55)
    }
    this.emit()
  }

  async toggle() {
    if (this.playing) {
      this.stop()
    } else {
      await this.start()
    }
  }
}

export const luxuryPiano = new LuxuryPianoEngine()
