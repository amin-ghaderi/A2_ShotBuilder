import type { Vec3 } from '@/types/scene'

export const DEG = 180 / Math.PI
export const RAD = Math.PI / 180

export function toDeg(radians: number) {
  return radians * DEG
}

export function toRad(degrees: number) {
  return degrees * RAD
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function wrapPi(radians: number) {
  let value = radians
  while (value > Math.PI) value -= Math.PI * 2
  while (value < -Math.PI) value += Math.PI * 2
  return value
}

export function dist(a: Vec3, b: Vec3) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}

export function formatDeg(value: number) {
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)
}

export function formatSigned(value: number, digits = 1) {
  const text = value.toFixed(digits)
  return value >= 0 ? `+${text}` : text
}

export function copyVec(value: Vec3): Vec3 {
  return [value[0], value[1], value[2]]
}
