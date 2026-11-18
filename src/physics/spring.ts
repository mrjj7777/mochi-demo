export type SpringPresetName = 'ui' | 'settle' | 'jelly' | 'heavy'

export type SpringConfig = {
  stiffness: number
  damping: number
  mass: number
}

export const SPRINGS: Record<SpringPresetName, SpringConfig> = {
  ui: { stiffness: 380, damping: 38, mass: 1 },
  settle: { stiffness: 170, damping: 26, mass: 1 },
  jelly: { stiffness: 120, damping: 9, mass: 1 },
  heavy: { stiffness: 90, damping: 20, mass: 2.5 },
}

export type SpringValue = {
  value: number
  velocity: number
  target: number
  setTarget: (target: number) => void
  setVelocity: (velocity: number) => void
  addImpulse: (deltaVelocity: number) => void
  snap: (value?: number) => void
  step: (dtSeconds: number) => number
  atRest: (epsilon?: number) => boolean
}

/** Interruptible semi-implicit Euler spring preserving velocity across target redirects. */
export function createSpring(preset: SpringPresetName | SpringConfig, initial = 0): SpringValue {
  const config = typeof preset === 'string' ? SPRINGS[preset] : preset
  const state = { value: initial, velocity: 0, target: initial }

  return {
    get value() { return state.value },
    set value(value: number) { state.value = value },
    get velocity() { return state.velocity },
    set velocity(velocity: number) { state.velocity = velocity },
    get target() { return state.target },
    set target(target: number) { state.target = target },
    setTarget(target: number) { state.target = target },
    setVelocity(velocity: number) { state.velocity = velocity },
    addImpulse(deltaVelocity: number) { state.velocity += deltaVelocity },
    snap(value = state.target) {
      state.value = value
      state.target = value
      state.velocity = 0
    },
    step(dtSeconds: number) {
      const dt = Math.min(Math.max(dtSeconds, 0), 0.05)
      if (dt === 0) return state.value
      const acceleration = ((state.target - state.value) * config.stiffness - state.velocity * config.damping) / config.mass
      state.velocity += acceleration * dt
      state.value += state.velocity * dt
      if (Math.abs(state.target - state.value) < 0.0001 && Math.abs(state.velocity) < 0.0001) {
        state.value = state.target
        state.velocity = 0
      }
      return state.value
    },
    atRest(epsilon = 0.0005) {
      return Math.abs(state.target - state.value) <= epsilon && Math.abs(state.velocity) <= epsilon
    },
  }
}

export type PointerSample = { x: number; y: number; time: number }

/** Tracks the last five pointer samples for release velocity hand-off (08-2.3). */
export class PointerHistory {
  private samples: PointerSample[] = []
  constructor(private readonly maxSamples = 5) {}

  add(x: number, y: number, time = performance.now()) {
    this.samples.push({ x, y, time })
    if (this.samples.length > this.maxSamples) {
      this.samples.splice(0, this.samples.length - this.maxSamples)
    }
  }

  reset() {
    this.samples = []
  }

  velocity(): { x: number; y: number } {
    if (this.samples.length < 2) return { x: 0, y: 0 }
    const first = this.samples[0]
    const last = this.samples[this.samples.length - 1]
    const elapsed = Math.max(8, last.time - first.time)
    return {
      x: ((last.x - first.x) * 1000) / elapsed,
      y: ((last.y - first.y) * 1000) / elapsed,
    }
  }
}

export function projectMomentum(position: number, velocity: number) {
  return position + (velocity * 0.998) / (1 - 0.998) / 1000
}

export function rubberBand(distance: number, limit: number) {
  if (limit <= 0) return 0
  const magnitude = Math.abs(distance)
  const offset = (1 - 1 / ((magnitude * 0.55) / limit + 1)) * limit
  return Math.sign(distance) * offset
}

export function rubberBandClamp(value: number, min: number, max: number, limit: number) {
  if (value < min) return min - rubberBand(min - value, limit)
  if (value > max) return max + rubberBand(value - max, limit)
  return value
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function hexToRgb(value: string): [number, number, number] {
  const clean = value.trim().replace('#', '')
  const full = clean.length === 3 ? clean.split('').map(char => char + char).join('') : clean
  return [0, 2, 4].map(index => Number.parseInt(full.slice(index, index + 2), 16) / 255) as [number, number, number]
}

export function lerpNumber(from: number, to: number, amount: number) {
  return from + (to - from) * amount
}

export function lerpRgb(
  from: [number, number, number],
  to: [number, number, number],
  amount: number,
): [number, number, number] {
  return [
    lerpNumber(from[0], to[0], amount),
    lerpNumber(from[1], to[1], amount),
    lerpNumber(from[2], to[2], amount),
  ]
}

export function publishScrollVelocity(velocity: number, root: HTMLElement = document.documentElement) {
  const bounded = clamp(velocity, -2.5, 2.5)
  root.style.setProperty('--scroll-velocity', String(bounded))
  root.style.setProperty('--motion-skew', `${bounded}deg`)
  root.style.setProperty('--product-stretch', String(1 + Math.min(0.03, Math.abs(bounded) * 0.012)))
  return bounded
}
