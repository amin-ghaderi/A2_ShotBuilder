import { analyzeCamera } from '@/lib/geometry/cameraAnalysis'
import { formatDeg, formatSigned } from '@/lib/math'
import { evaluateCamera, formatTimecode } from '@/motion/lib/interpolation'
import type { CameraKeyframe, MotionObject, MotionShot } from '@/motion/types'
import type { ShotCameraState, SubjectState } from '@/types/scene'

function subjectProxy(object: MotionObject | undefined): SubjectState {
  const position = object?.position ?? ([0, 0, 0] as const)
  return {
    position: [position[0], position[1], position[2]],
    rotation: [0, object?.rotation[1] ?? 0, 0],
    bodyYaw: object?.rotation[1] ?? 0,
    headYaw: 0,
    headPitch: 0,
    gaze: 'original',
  }
}

function asCamera(key: { position: CameraKeyframe['position']; target: CameraKeyframe['target']; focalLength: number; roll: number }): ShotCameraState {
  return {
    position: key.position,
    target: key.target,
    focalLength: key.focalLength,
    roll: key.roll,
    aim: 'custom',
  }
}

export function describeCameraSegment(shot: MotionShot, fromTime: number, toTime: number) {
  const start = evaluateCamera(shot.cameraKeys, fromTime)
  const end = evaluateCamera(shot.cameraKeys, toTime)
  const person = shot.objects.find((item) => item.kind === 'person') ?? shot.objects[0]
  const startA = analyzeCamera(subjectProxy(person), asCamera(start))
  const endA = analyzeCamera(subjectProxy(person), asCamera(end))
  const travel = Math.hypot(
    end.position[0] - start.position[0],
    end.position[1] - start.position[1],
    end.position[2] - start.position[2],
  )
  const azimuthDelta = endA.azimuth - startA.azimuth
  const elevationDelta = endA.elevation - startA.elevation
  const zoom = end.focalLength - start.focalLength

  const parts: string[] = []
  if (travel < 0.08 && Math.abs(azimuthDelta) < 4 && Math.abs(elevationDelta) < 4) {
    parts.push(`the camera holds at ${formatSigned(startA.azimuth)}° azimuth and ${formatSigned(startA.elevation)}° elevation, ${startA.distance.toFixed(2)}m from the subject`)
  } else {
    if (Math.abs(azimuthDelta) >= 4) {
      parts.push(`the camera orbits ${formatDeg(Math.abs(azimuthDelta))}° toward the subject's ${azimuthDelta > 0 ? 'right' : 'left'}`)
    }
    if (end.position[2] < start.position[2] - 0.12) parts.push('the camera dollies in')
    else if (end.position[2] > start.position[2] + 0.12) parts.push('the camera dollies out')
    if (Math.abs(end.position[1] - start.position[1]) >= 0.12) {
      parts.push(end.position[1] > start.position[1] ? 'the camera rises' : 'the camera lowers')
    }
    if (Math.abs(elevationDelta) >= 4) {
      parts.push(`elevation changes from ${formatSigned(startA.elevation)}° to ${formatSigned(endA.elevation)}°`)
    }
  }
  if (Math.abs(zoom) >= 4) {
    parts.push(`focal length moves from ${Math.round(start.focalLength)}mm to ${Math.round(end.focalLength)}mm`)
  } else {
    parts.push(`using a ${Math.round(start.focalLength)}mm lens`)
  }
  if (shot.trackTarget) parts.push('keeping the aim point on the subject')
  return parts.join(', ')
}

export function cameraSpanSentences(shot: MotionShot) {
  const keys = [...shot.cameraKeys].sort((a, b) => a.time - b.time)
  if (keys.length < 2) {
    return [`From 00:00.000 to ${formatTimecode(shot.duration)}, ${describeCameraSegment(shot, 0, shot.duration)}.`]
  }
  const sentences: string[] = []
  for (let i = 0; i < keys.length - 1; i += 1) {
    const from = keys[i]
    const to = keys[i + 1]
    sentences.push(
      `From ${formatTimecode(from.time)} to ${formatTimecode(to.time)}, ${describeCameraSegment(shot, from.time, to.time)}.`,
    )
  }
  return sentences
}
