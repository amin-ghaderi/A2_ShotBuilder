import { FACE_ANCHOR, EYE_HEIGHT } from '@/lib/constants'
import { dist, toDeg } from '@/lib/math'
import type { ShotCameraState, SubjectState, Vec3 } from '@/types/scene'

export type HorizontalRelation = 'left' | 'right' | 'center'
export type VerticalRelation = 'above' | 'below' | 'level'
export type FrontBackRelation = 'front' | 'behind' | 'side'

export type CameraAnalysis = {
  azimuth: number
  elevation: number
  viewElevation: number
  lookPitch: number
  distance: number
  subjectDistance: number
  horizontalRelation: HorizontalRelation
  verticalRelation: VerticalRelation
  frontBackRelation: FrontBackRelation
  roll: number
}

/**
 * Subject faces +Z at yaw 0. Positive azimuth means the camera sits on the
 * subject's right. Positive elevation means the camera is above eye level.
 * Angles are degrees and stay continuous — they are not snapped to presets.
 */
export function analyzeCamera(subject: SubjectState, camera: ShotCameraState): CameraAnalysis {
  const dx = camera.position[0] - subject.position[0]
  const dz = camera.position[2] - subject.position[2]
  const horizontal = Math.hypot(dx, dz)
  const { forwardX, forwardZ, rightX, rightZ } = subjectAxes(subject.bodyYaw)
  const azimuth = toDeg(Math.atan2(dx * rightX + dz * rightZ, dx * forwardX + dz * forwardZ))
  const eyeY = subject.position[1] + EYE_HEIGHT
  const elevation = toDeg(Math.atan2(camera.position[1] - eyeY, Math.max(horizontal, 0.0001)))

  const toTargetX = camera.position[0] - camera.target[0]
  const toTargetZ = camera.position[2] - camera.target[2]
  const targetHorizontal = Math.hypot(toTargetX, toTargetZ)
  const viewElevation = toDeg(
    Math.atan2(camera.position[1] - camera.target[1], Math.max(targetHorizontal, 0.0001)),
  )
  const lookPitch = toDeg(
    Math.atan2(camera.target[1] - camera.position[1], Math.max(targetHorizontal, 0.0001)),
  )

  const absAzimuth = Math.abs(azimuth)
  const horizontalRelation: HorizontalRelation =
    azimuth > 8 ? 'right' : azimuth < -8 ? 'left' : 'center'
  const verticalRelation: VerticalRelation =
    elevation > 6 ? 'above' : elevation < -6 ? 'below' : 'level'
  const frontBackRelation: FrontBackRelation =
    absAzimuth < 55 ? 'front' : absAzimuth > 125 ? 'behind' : 'side'

  return {
    azimuth,
    elevation,
    viewElevation,
    lookPitch,
    distance: dist(camera.position, camera.target),
    subjectDistance: Math.hypot(dx, camera.position[1] - (subject.position[1] + FACE_ANCHOR), dz),
    horizontalRelation,
    verticalRelation,
    frontBackRelation,
    roll: camera.roll,
  }
}

export function positionFromViewAngles(
  target: Vec3,
  azimuthDeg: number,
  elevationDeg: number,
  distance: number,
  bodyYaw: number,
): Vec3 {
  const azimuth = (azimuthDeg * Math.PI) / 180
  const elevation = (elevationDeg * Math.PI) / 180
  const horizontal = distance * Math.cos(elevation)
  const { forwardX, forwardZ, rightX, rightZ } = subjectAxes(bodyYaw)
  return [
    target[0] + forwardX * Math.cos(azimuth) * horizontal + rightX * Math.sin(azimuth) * horizontal,
    target[1] + distance * Math.sin(elevation),
    target[2] + forwardZ * Math.cos(azimuth) * horizontal + rightZ * Math.sin(azimuth) * horizontal,
  ]
}

/** Positive X means the subject sits on the right side of the frame. */
export function subjectFrameOffset(subject: SubjectState, camera: ShotCameraState) {
  const forwardX = camera.target[0] - camera.position[0]
  const forwardY = camera.target[1] - camera.position[1]
  const forwardZ = camera.target[2] - camera.position[2]
  const forwardLength = Math.hypot(forwardX, forwardY, forwardZ) || 1
  const fx = forwardX / forwardLength
  const fy = forwardY / forwardLength
  const fz = forwardZ / forwardLength

  let rightX = fy * 0 - fz * 1
  let rightY = fz * 0 - fx * 0
  let rightZ = fx * 1 - fy * 0
  const rightLength = Math.hypot(rightX, rightY, rightZ) || 1
  rightX /= rightLength
  rightY /= rightLength
  rightZ /= rightLength

  const upX = rightY * fz - rightZ * fy
  const upY = rightZ * fx - rightX * fz
  const upZ = rightX * fy - rightY * fx

  const sx = subject.position[0] - camera.target[0]
  const sy = subject.position[1] + FACE_ANCHOR - camera.target[1]
  const sz = subject.position[2] - camera.target[2]

  return {
    x: sx * rightX + sy * rightY + sz * rightZ,
    y: sx * upX + sy * upY + sz * upZ,
    right: [rightX, rightY, rightZ] as Vec3,
  }
}

export function subjectAxes(bodyYaw: number) {
  return {
    forwardX: Math.sin(bodyYaw),
    forwardZ: Math.cos(bodyYaw),
    rightX: -Math.cos(bodyYaw),
    rightZ: Math.sin(bodyYaw),
  }
}
