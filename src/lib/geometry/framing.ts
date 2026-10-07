import { positionFromViewAngles } from '@/lib/geometry/cameraAnalysis'
import { EYE_HEIGHT, FACE_ANCHOR, FRAMING_SPECS, HEAD_TOP } from '@/lib/constants'
import { clamp, toDeg } from '@/lib/math'
import { distanceForSpan, visibleHeightAtDistance } from '@/lib/optics'
import type { NamedFramingPreset, SceneData, ShotCameraState, SubjectState, Vec3 } from '@/types/scene'

export type CropAnalysis = {
  preset: NamedFramingPreset
  phrase: string
  bottom: number
  top: number
  headroom: number
  distance: number
}

export function analyzeCrop(subject: SubjectState, camera: ShotCameraState): CropAnalysis {
  const distance = Math.max(0.05, Math.hypot(
    camera.position[0] - camera.target[0],
    camera.position[1] - camera.target[1],
    camera.position[2] - camera.target[2],
  ))
  const visible = visibleHeightAtDistance(camera.focalLength, distance)
  const bottom = camera.target[1] - visible / 2
  const top = camera.target[1] + visible / 2
  const base = subject.position[1]
  const preset = classifyCrop(bottom - base, top - base)
  return {
    preset,
    phrase: FRAMING_SPECS[preset].phrase,
    bottom,
    top,
    headroom: top - (base + HEAD_TOP),
    distance,
  }
}

export function classifyCrop(bottom: number, top: number): NamedFramingPreset {
  let best: NamedFramingPreset = 'full-body'
  let bestScore = Number.POSITIVE_INFINITY
  for (const [id, spec] of Object.entries(FRAMING_SPECS) as [NamedFramingPreset, (typeof FRAMING_SPECS)[NamedFramingPreset]][]) {
    const score = Math.abs(spec.bottom - bottom) + Math.abs(spec.top - top)
    if (score < bestScore) {
      best = id
      bestScore = score
    }
  }
  return best
}

export function cameraForPreset(
  subject: SubjectState,
  focalLength: number,
  preset: NamedFramingPreset,
  azimuth: number,
  viewElevation: number,
) {
  const spec = FRAMING_SPECS[preset]
  const base = subject.position[1]
  const bottom = base + spec.bottom
  const top = base + spec.top
  const target: Vec3 = [subject.position[0], (bottom + top) / 2, subject.position[2]]
  const distance = clamp(distanceForSpan(focalLength, top - bottom), 0.35, 20)
  const position = positionFromViewAngles(target, azimuth, viewElevation, distance, subject.bodyYaw)
  return { position, target }
}

export function eyeLevelElevation(targetY: number, distance: number) {
  return toDeg(Math.asin(clamp((EYE_HEIGHT - targetY) / Math.max(distance, 0.35), -1, 1)))
}

export function measureHeadroom(camera: ShotCameraState, subject: SubjectState) {
  return analyzeCrop(subject, camera).headroom
}

export function defaultViewElevation(focalLength: number, preset: NamedFramingPreset) {
  const spec = FRAMING_SPECS[preset]
  const targetY = (spec.bottom + spec.top) / 2
  const distance = distanceForSpan(focalLength, spec.top - spec.bottom)
  return eyeLevelElevation(targetY, distance)
}

export function aspectPhrase(ratio: SceneData['framing']['aspectRatio']) {
  switch (ratio) {
    case '1:1':
      return 'square 1:1'
    case '4:5':
      return 'vertical 4:5'
    case '3:2':
      return 'classic 3:2'
    case '16:9':
      return 'widescreen 16:9'
    case '9:16':
      return 'vertical 9:16'
  }
}

export function headroomPhrase(headroom: number) {
  if (headroom > 0.28) return 'with generous headroom'
  if (headroom > 0.16) return 'with comfortable headroom'
  if (headroom < -0.04) return 'with the top of the head cropped'
  if (headroom < 0.03) return 'with the top of the head close to the upper frame edge'
  return null
}

export const FACE_REFERENCE_Y = FACE_ANCHOR
