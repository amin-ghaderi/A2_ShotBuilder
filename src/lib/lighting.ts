import type { LightType } from '@/types/scene'

/** Maps the 0–100 studio strength slider onto Three.js physical light units. */
export function physicalIntensity(type: LightType, intensity: number) {
  const unit = Math.max(0, intensity) / 100
  if (type === 'directional') return unit * 5
  if (type === 'point') return unit * 1200
  return unit * 3500
}
