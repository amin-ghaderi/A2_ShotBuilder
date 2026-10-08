import { analyzeCamera } from '@/lib/geometry/cameraAnalysis'
import { formatDeg } from '@/lib/math'
import { evaluateCamera, evaluateTransform, formatTimecode } from '@/motion/lib/interpolation'
import type { CameraKeyframe, MotionObject, MotionShot } from '@/motion/types'
import type { ShotCameraState, SubjectState, Vec3 } from '@/types/scene'

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

function groundAxes(position: Vec3, target: Vec3) {
  const gx = target[0] - position[0]
  const gz = target[2] - position[2]
  const length = Math.hypot(gx, gz) || 1
  const forwardX = gx / length
  const forwardZ = gz / length
  return { forwardX, forwardZ, rightX: -forwardZ, rightZ: forwardX }
}

function liveObject(object: MotionObject, time: number) {
  return evaluateTransform(object, object.keyframes, time)
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
  const axes = groundAxes(start.position, start.target)
  const dx = end.position[0] - start.position[0]
  const dz = end.position[2] - start.position[2]
  const dolly = dx * axes.forwardX + dz * axes.forwardZ
  const truck = dx * axes.rightX + dz * axes.rightZ
  const crane = end.position[1] - start.position[1]
  const positionHold = travel < 0.08
  const targetTravel = Math.hypot(end.target[0] - start.target[0], end.target[1] - start.target[1], end.target[2] - start.target[2])

  const parts: string[] = []
  if (positionHold && Math.abs(azimuthDelta) < 4 && Math.abs(elevationDelta) < 4 && targetTravel < 0.08) {
    parts.push(`the camera holds, looking ${startA.frontBackRelation} of the tracked figure at ${startA.distance.toFixed(2)}m`)
  } else {
    if (!positionHold && Math.abs(azimuthDelta) >= 8 && Math.hypot(dolly, truck) < travel * 0.85) {
      parts.push(`the camera orbits ${formatDeg(Math.abs(azimuthDelta))}° toward the subject's ${azimuthDelta > 0 ? 'right' : 'left'}`)
    } else if (Math.abs(azimuthDelta) >= 4 && !positionHold) {
      parts.push(`the camera arcs ${formatDeg(Math.abs(azimuthDelta))}° toward the subject's ${azimuthDelta > 0 ? 'right' : 'left'}`)
    }
    if (dolly <= -0.12) parts.push('the camera dollies in along its look direction')
    else if (dolly >= 0.12) parts.push('the camera dollies out along its look direction')
    if (truck <= -0.12) parts.push('the camera trucks left')
    else if (truck >= 0.12) parts.push('the camera trucks right')
    if (crane >= 0.12) parts.push('the camera cranes up')
    else if (crane <= -0.12) parts.push('the camera cranes down')
    if (positionHold && targetTravel >= 0.08) {
      const startLook = groundAxes(start.position, start.target)
      const endLook = groundAxes(end.position, end.target)
      const pan = Math.atan2(endLook.forwardX, endLook.forwardZ) - Math.atan2(startLook.forwardX, startLook.forwardZ)
      if (Math.abs(pan) >= 0.04) parts.push(`the camera pans ${pan > 0 ? 'right' : 'left'}`)
      if (Math.abs(end.target[1] - start.target[1]) >= 0.08) {
        parts.push(end.target[1] > start.target[1] ? 'the camera tilts up' : 'the camera tilts down')
      }
    }
    if (Math.abs(elevationDelta) >= 4) {
      parts.push(`camera elevation changes from ${startA.elevation.toFixed(1)}° to ${endA.elevation.toFixed(1)}°`)
    }
  }
  if (Math.abs(zoom) >= 4) {
    parts.push(`focal length moves from ${Math.round(start.focalLength)}mm to ${Math.round(end.focalLength)}mm`)
  } else {
    parts.push(`using a ${Math.round(start.focalLength)}mm lens`)
  }
  if (shot.trackTarget) {
    const aim = person ? `${person.name}` : 'the aim point'
    parts.push(`keeping the tracked aim on ${aim}`)
  }
  return parts.join(', ')
}

export function cameraSpanSentences(shot: MotionShot) {
  const keys = [...shot.cameraKeys].sort((a, b) => a.time - b.time)
  if (keys.length < 2) {
    return [`From ${formatTimecode(0)} to ${formatTimecode(shot.duration)}, ${describeCameraSegment(shot, 0, shot.duration)}.`]
  }
  return keys.slice(0, -1).map((from, index) => {
    const to = keys[index + 1]
    return `From ${formatTimecode(from.time)} to ${formatTimecode(to.time)}, ${describeCameraSegment(shot, from.time, to.time)}.`
  })
}

export function spatialLayout(shot: MotionShot, time: number, named: Array<{ object: MotionObject; tag: string }>) {
  if (named.length === 0) return ''
  const camera = evaluateCamera(shot.cameraKeys, time)
  const axes = groundAxes(camera.position, camera.target)
  const phrases: string[] = []
  const live = named.map((item) => ({ ...item, pose: liveObject(item.object, time) }))
  live.forEach((item, index) => {
    const dx = item.pose.position[0] - camera.position[0]
    const dz = item.pose.position[2] - camera.position[2]
    const along = dx * axes.forwardX + dz * axes.forwardZ
    const across = dx * axes.rightX + dz * axes.rightZ
    const side = Math.abs(across) < 0.35 ? 'near the lens axis' : across > 0 ? 'to the camera right' : 'to the camera left'
    const depth = along < 0 ? 'closer to the camera' : 'deeper in the frame'
    phrases.push(`${item.tag} stands ${side}, ${Math.abs(across).toFixed(1)}m off axis and ${depth}`)
    if (index > 0) {
      const origin = live[0]
      const gap = Math.hypot(item.pose.position[0] - origin.pose.position[0], item.pose.position[2] - origin.pose.position[2])
      const relX = item.pose.position[0] - origin.pose.position[0]
      const relZ = item.pose.position[2] - origin.pose.position[2]
      const right = relX * axes.rightX + relZ * axes.rightZ
      const relation = Math.abs(right) < 0.35 ? 'in line with' : right > 0 ? 'to the camera-right of' : 'to the camera-left of'
      phrases.push(`${item.tag} is approximately ${gap.toFixed(1)}m ${relation} ${origin.tag}`)
    }
  })
  return phrases.join('. ')
}

export function lightingSentence(shot: MotionShot) {
  const active = shot.lights.filter((light) => light.enabled)
  if (active.length === 0) return 'The 3D guide has no enabled lights; keep the lighting unstated beyond natural exposure.'
  return active
    .map((light) => {
      const height = light.position[1] >= 2.2 ? 'from above' : 'near eye height'
      const side = light.position[0] < -0.4 ? 'the left' : light.position[0] > 0.4 ? 'the right' : 'the center'
      return `the ${light.role} ${light.type} light from ${side} ${height} is on`
    })
    .join('; ')
}
