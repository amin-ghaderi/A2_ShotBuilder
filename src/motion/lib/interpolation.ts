import { clamp } from '@/lib/math'
import type { CameraKeyframe, EasingName, TransformKeyframe } from '@/motion/types'
import type { Vec3 } from '@/types/scene'

export function ease(t: number, easing: EasingName) {
  const x = clamp(t, 0, 1)
  if (easing === 'smooth') return x * x * (3 - 2 * x)
  return x
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

export function lerpVec(a: Vec3, b: Vec3, t: number): Vec3 {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]
}

export function sampleKeys<T extends { time: number; easing: EasingName }>(keys: T[], time: number) {
  if (keys.length === 0) return null
  const ordered = [...keys].sort((a, b) => a.time - b.time)
  if (time <= ordered[0].time) return { from: ordered[0], to: ordered[0], t: 0, easing: ordered[0].easing }
  const last = ordered[ordered.length - 1]
  if (time >= last.time) return { from: last, to: last, t: 0, easing: last.easing }
  for (let i = 0; i < ordered.length - 1; i += 1) {
    const from = ordered[i]
    const to = ordered[i + 1]
    if (time >= from.time && time <= to.time) {
      const span = Math.max(0.0001, to.time - from.time)
      return { from, to, t: (time - from.time) / span, easing: to.easing }
    }
  }
  return { from: last, to: last, t: 0, easing: last.easing }
}

export function evaluateCamera(keys: CameraKeyframe[], time: number) {
  const sample = sampleKeys(keys, time)
  if (!sample) {
    return { position: [0, 1.6, 3.6] as Vec3, target: [0, 1.4, 0] as Vec3, focalLength: 35, roll: 0 }
  }
  const t = ease(sample.t, sample.easing)
  return {
    position: lerpVec(sample.from.position, sample.to.position, t),
    target: lerpVec(sample.from.target, sample.to.target, t),
    focalLength: lerp(sample.from.focalLength, sample.to.focalLength, t),
    roll: lerp(sample.from.roll, sample.to.roll, t),
  }
}

export function evaluateTransform(
  rest: { position: Vec3; rotation: Vec3; scale: Vec3 },
  keys: TransformKeyframe[],
  time: number,
) {
  const sample = sampleKeys(keys, time)
  if (!sample) return rest
  const t = ease(sample.t, sample.easing)
  return {
    position: lerpVec(sample.from.position, sample.to.position, t),
    rotation: lerpVec(sample.from.rotation, sample.to.rotation, t),
    scale: lerpVec(sample.from.scale, sample.to.scale, t),
  }
}

export function upsertKey<T extends { time: number }>(keys: T[], next: T, snap = 0.05) {
  const existing = keys.findIndex((key) => Math.abs(key.time - next.time) <= snap)
  if (existing >= 0) {
    const copy = [...keys]
    copy[existing] = { ...next, time: keys[existing].time }
    return copy
  }
  return [...keys, next].sort((a, b) => a.time - b.time)
}

export function formatTimecode(seconds: number) {
  const safe = Math.max(0, seconds)
  const minutes = Math.floor(safe / 60)
  const remainder = safe - minutes * 60
  return `${String(minutes).padStart(2, '0')}:${remainder.toFixed(3).padStart(6, '0')}`
}

/** Python/Comfy `%` for negatives: (-3) % 17 === 14. JavaScript `%` is not the same. */
export function pythonModulo(value: number, modulus: number) {
  const m = modulus === 0 ? 1 : modulus
  return ((value % m) + m) % m
}

/** Official ComfyUI Ref2VA length expression, using 24 fps and Python modulo. */
export function h3FrameLength(durationSeconds: number) {
  const raw = Math.max(5, Math.round(durationSeconds * 24))
  return raw + pythonModulo(5 - (raw % 17), 17)
}
