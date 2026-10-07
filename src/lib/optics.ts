import { clamp } from '@/lib/math'

/** Vertical film height used for full-frame lens conversion, in millimeters. */
export const FILM_HEIGHT_MM = 24

type FocalCamera = {
  aspect: number
  filmGauge: number
  setFocalLength: (focalLength: number) => void
}

/**
 * Applies a still-photography focal length to a perspective camera.
 * Vertical coverage stays locked to a 24mm film height, so changing the
 * frame aspect crops the sides instead of secretly zooming.
 */
export function applyFocalLength(camera: FocalCamera, focalLength: number, aspect: number) {
  const safeAspect = Number.isFinite(aspect) && aspect > 0.05 ? aspect : 1
  camera.aspect = safeAspect
  camera.filmGauge = safeAspect >= 1 ? FILM_HEIGHT_MM * safeAspect : FILM_HEIGHT_MM
  camera.setFocalLength(clamp(focalLength, 18, 200))
}

export function verticalFovRadians(focalLength: number) {
  return 2 * Math.atan(FILM_HEIGHT_MM / (2 * clamp(focalLength, 18, 200)))
}

/** Visible height, in meters, on a plane `distance` meters from the lens. */
export function visibleHeightAtDistance(focalLength: number, distance: number) {
  return 2 * Math.max(0.05, distance) * Math.tan(verticalFovRadians(focalLength) / 2)
}

export function distanceForSpan(focalLength: number, spanMeters: number) {
  const tangent = Math.tan(verticalFovRadians(focalLength) / 2)
  if (tangent <= 0.0001) return spanMeters
  return spanMeters / (2 * tangent)
}
