import { analyzeCamera } from '@/lib/geometry/cameraAnalysis'
import { analyzeCrop } from '@/lib/geometry/framing'
import { analyzeLights } from '@/lib/geometry/lightAnalysis'
import { FRAMING_SPECS } from '@/lib/constants'
import { toDeg } from '@/lib/math'
import type { SceneData } from '@/types/scene'

export function compileSceneCode(state: SceneData) {
  const camera = analyzeCamera(state.subject, state.shotCamera)
  const crop = analyzeCrop(state.subject, state.shotCamera)
  const azimuth =
    camera.azimuth >= 0
      ? `R${camera.azimuth.toFixed(1)}`
      : `L${Math.abs(camera.azimuth).toFixed(1)}`
  const body = Math.round(wrap(toDeg(state.subject.bodyYaw)))
  const gaze = state.subject.gaze === 'camera' ? 'CAM' : 'ORIG'
  const lights = analyzeLights(state.subject, state.lights).map((light, index) => {
    const horizontal = Math.abs(light.horizontalAngle) < 8
      ? 'C0'
      : light.horizontalAngle >= 0
        ? `R${Math.abs(light.horizontalAngle).toFixed(0)}`
        : `L${Math.abs(light.horizontalAngle).toFixed(0)}`
    return `L${index + 1}:${horizontal},H${light.verticalAngle.toFixed(0)},${light.light.role.toUpperCase()}`
  })

  const core = [
    `CAM:${azimuth},E${camera.elevation.toFixed(1)},D${camera.distance.toFixed(2)}`,
    `LN:${Math.round(state.shotCamera.focalLength)}`,
    `BODY:${body}`,
    `GAZE:${gaze}`,
    `FRAME:${FRAMING_SPECS[crop.preset].code}`,
    `AR:${state.framing.aspectRatio}`,
  ]

  return [...core, ...lights].join(' | ')
}

function wrap(degrees: number) {
  let value = degrees
  while (value > 180) value -= 360
  while (value < -180) value += 360
  return value
}
