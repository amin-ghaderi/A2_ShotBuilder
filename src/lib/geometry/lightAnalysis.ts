import { temperatureClass } from '@/lib/color'
import { FACE_ANCHOR } from '@/lib/constants'
import { toDeg } from '@/lib/math'
import type { LightConfig, SubjectState } from '@/types/scene'
import { subjectAxes } from '@/lib/geometry/cameraAnalysis'

export type LightRelation = {
  side: 'subject-left' | 'subject-right' | 'centered'
  horizontalAngle: number
  verticalAngle: number
  relation: string
  frontBack: 'front' | 'back' | 'side'
  vertical: 'above' | 'below' | 'level'
  distance: number
  intensityClass: 'dominant' | 'strong' | 'moderate' | 'subtle'
  temperatureClass: ReturnType<typeof temperatureClass>
}

export type LightAnalysis = LightRelation & {
  light: LightConfig
}

export function analyzeLights(subject: SubjectState, lights: LightConfig[]): LightAnalysis[] {
  const enabled = lights.filter((light) => light.enabled)
  const maxIntensity = enabled.reduce((max, light) => Math.max(max, light.intensity), 0)

  return enabled.map((light) => ({
    light,
    ...analyzeLight(subject, light, maxIntensity),
  }))
}

export function analyzeLight(subject: SubjectState, light: LightConfig, maxIntensity = light.intensity): LightRelation {
  const dx = light.position[0] - subject.position[0]
  const dy = light.position[1] - (subject.position[1] + FACE_ANCHOR)
  const dz = light.position[2] - subject.position[2]
  const horizontal = Math.hypot(dx, dz)
  const { forwardX, forwardZ, rightX, rightZ } = subjectAxes(subject.bodyYaw)
  const horizontalAngle = toDeg(Math.atan2(dx * rightX + dz * rightZ, dx * forwardX + dz * forwardZ))
  const verticalAngle = toDeg(Math.atan2(dy, Math.max(horizontal, 0.0001)))
  const absHorizontal = Math.abs(horizontalAngle)

  const side: LightRelation['side'] =
    horizontalAngle > 10 ? 'subject-right' : horizontalAngle < -10 ? 'subject-left' : 'centered'
  const frontBack: LightRelation['frontBack'] =
    absHorizontal < 55 ? 'front' : absHorizontal > 125 ? 'back' : 'side'
  const vertical: LightRelation['vertical'] =
    verticalAngle > 8 ? 'above' : verticalAngle < -8 ? 'below' : 'level'

  const parts = [
    frontBack === 'side' ? 'side' : frontBack,
    side === 'centered' ? null : side === 'subject-right' ? 'right' : 'left',
    vertical === 'level' ? null : vertical,
  ].filter(Boolean)

  const ratio = maxIntensity > 0 ? light.intensity / maxIntensity : 0
  const intensityClass: LightRelation['intensityClass'] =
    ratio > 0.82 && light.intensity >= 45
      ? 'dominant'
      : ratio > 0.62 || light.intensity >= 62
        ? 'strong'
        : light.intensity >= 28
          ? 'moderate'
          : 'subtle'

  return {
    side,
    horizontalAngle,
    verticalAngle,
    relation: parts.join('-'),
    frontBack,
    vertical,
    distance: Math.hypot(dx, dy, dz),
    intensityClass,
    temperatureClass: temperatureClass(light.temperature),
  }
}
