import type { ExpressionId, MoodId } from '@/types/scene'
import { formatDeg, toDeg } from '@/lib/math'
import type { CameraAnalysis } from '@/lib/geometry/cameraAnalysis'
import type { LightAnalysis } from '@/lib/geometry/lightAnalysis'

/** Degrees from eye level. Below this, the shot is treated as approximately eye-level. */
export const VERTICAL_EYE_LEVEL_DEG = 6
/** Degrees from eye level. At or beyond this, the shot is a clear low or high angle. */
export const VERTICAL_CLEAR_ANGLE_DEG = 10

export type VerticalCameraBand = 'eye-level' | 'slight-low' | 'clear-low' | 'slight-high' | 'clear-high'

export function verticalCameraBand(elevation: number): VerticalCameraBand {
  if (elevation <= -VERTICAL_CLEAR_ANGLE_DEG) return 'clear-low'
  if (elevation >= VERTICAL_CLEAR_ANGLE_DEG) return 'clear-high'
  if (elevation <= -VERTICAL_EYE_LEVEL_DEG) return 'slight-low'
  if (elevation >= VERTICAL_EYE_LEVEL_DEG) return 'slight-high'
  return 'eye-level'
}

/** Degrees of |azimuth|. Below this, the camera is treated as frontal — no L/R block. */
export const LATERAL_FRONT_DEG = 6
/** Degrees of |azimuth|. At or beyond this, use the full anatomical disambiguation. */
export const LATERAL_CLEAR_DEG = 15

export function cameraPositionSentence(analysis: CameraAnalysis) {
  const placement = sidePhrase(analysis.azimuth)
  const height = elevationPhrase(analysis.elevation, analysis.lookPitch)
  const distance = distancePhrase(analysis.distance)
  return `Position the camera ${placement}, and ${height}, from ${distance}.`
}

export function lateralityConstraint(azimuth: number) {
  const abs = Math.abs(azimuth)
  if (abs < LATERAL_FRONT_DEG || abs > 155) return null
  const isRight = azimuth > 0
  const anatomical = isRight ? 'right' : 'left'
  const viewer = isRight ? 'left' : 'right'
  if (abs < LATERAL_CLEAR_DEG) {
    return `The camera is only slightly toward the subject's anatomical ${anatomical} side. Do not interpret this as the viewer's ${anatomical} or reverse the camera laterality.`
  }
  return [
    `This camera position must reveal more of the subject's ${anatomical} cheek and ${anatomical} side of the face.`,
    `For a forward-facing subject, the subject's anatomical ${anatomical} appears on the viewer's ${viewer} side of the resulting image.`,
    'Do not mirror or reverse this left/right camera direction.',
  ].join(' ')
}

export function verticalAngleConstraint(elevation: number) {
  const band = verticalCameraBand(elevation)
  if (band === 'eye-level') return null
  if (band === 'clear-low') {
    return [
      'This must read clearly as a low-angle shot from below.',
      "The camera is positioned below the subject's eye level and tilted upward toward the subject.",
      'The final image must visibly read as a shot from below.',
      'Do not interpret this as an eye-level shot.',
      'Do not create a high-angle or top-down view.',
    ].join('\n')
  }
  if (band === 'clear-high') {
    return [
      'This must read clearly as a high-angle shot from above.',
      "The camera is positioned above the subject's eye level and angled downward toward the subject.",
      'The final image must visibly read as a shot from above.',
      'Do not interpret this as an eye-level shot.',
      'Do not create a low-angle upward-looking view.',
    ].join('\n')
  }
  if (band === 'slight-low') {
    return 'The camera sits slightly below eye level with a mild upward look. Keep this as a subtle low viewpoint; do not raise it to a high-angle or top-down shot.'
  }
  return 'The camera sits slightly above eye level with a mild downward look. Keep this as a subtle high viewpoint; do not drop it to a low-angle upward-looking shot.'
}

export function lensSentence(focalLength: number) {
  const rounded = Math.round(focalLength)
  const article = /^(8|11|18)/.test(String(rounded)) ? 'an' : 'a'
  let character = 'natural photographic perspective'
  if (focalLength < 28) character = 'wide-angle perspective and expanded spatial depth'
  else if (focalLength < 40) character = 'moderate wide-angle perspective'
  else if (focalLength < 60) character = 'natural standard-lens perspective'
  else if (focalLength < 110) character = 'natural photographic portrait perspective'
  else character = 'compressed telephoto perspective'
  return `Use ${article} ${rounded}mm lens with ${character}.`
}

export function bodySentence(bodyYaw: number) {
  const degrees = wrapDegrees(toDeg(bodyYaw))
  const abs = Math.abs(degrees)
  if (abs < 8) return "Keep the subject's body facing approximately forward."
  const direction = degrees > 0 ? 'left' : 'right'
  return `Turn the subject's body approximately ${Math.round(abs)} degrees to their ${direction}.`
}

export function gazeSentence(gaze: 'camera' | 'original', headYaw: number, headPitch: number) {
  if (gaze === 'camera') return 'Make the subject look directly into the camera.'
  const yaw = wrapDegrees(toDeg(headYaw))
  const pitch = wrapDegrees(toDeg(headPitch))
  const parts = ["Keep the subject's original gaze direction. Do not redirect the eyes toward the camera."]
  if (Math.abs(yaw) >= 8) {
    parts.push(
      `Keep the head turned approximately ${Math.round(Math.abs(yaw))} degrees to the subject's ${yaw > 0 ? 'left' : 'right'} relative to the body.`,
    )
  }
  if (Math.abs(pitch) >= 8) {
    parts.push(`Tilt the head ${pitch > 0 ? 'up' : 'down'} approximately ${Math.round(Math.abs(pitch))} degrees.`)
  }
  return parts.join(' ')
}

export function rollSentence(roll: number) {
  const degrees = toDeg(roll)
  if (Math.abs(degrees) < 2) return null
  const direction = degrees > 0 ? 'counterclockwise' : 'clockwise'
  return `Roll the camera approximately ${formatDeg(Math.abs(degrees))} degrees ${direction}.`
}

export function lightSentence(analysis: LightAnalysis) {
  const { light } = analysis
  const placement = lightPlacement(analysis)
  const temperature = `with a ${analysis.temperatureClass} color temperature around ${Math.round(light.temperature)}K`
  const softness = light.softness > 0.55 ? 'soft' : light.softness < 0.25 ? 'hard' : 'moderately soft'

  if (light.role === 'key') {
    const weight = analysis.intensityClass === 'subtle' ? 'gentle' : 'dominant'
    return `Use a ${weight} ${softness} key light positioned ${placement}, ${temperature}.`
  }
  if (light.role === 'fill') {
    return `Use a softer fill light positioned ${placement}, ${temperature}.`
  }
  if (light.role === 'rim') {
    return `Add a subtle rim light positioned ${placement}, ${temperature}, for separation.`
  }
  const kind = light.type === 'directional' ? 'directional' : light.type === 'point' ? 'point' : 'spot'
  return `Add a ${softness} ${kind} light positioned ${placement}, ${temperature}.`
}

const EXPRESSION: Record<Exclude<ExpressionId, 'custom'>, string> = {
  original: "Preserve the subject's original facial expression from the reference photograph.",
  neutral: 'Give the subject a relaxed neutral expression.',
  'slight-smile': 'Give the subject a subtle, natural smile.',
  smile: 'Give the subject a genuine smile.',
  serious: 'Give the subject a serious expression.',
  confident: 'Give the subject a natural confident expression.',
  determined: 'Give the subject a determined expression.',
  calm: 'Give the subject a calm expression.',
  thoughtful: 'Give the subject a thoughtful expression.',
  surprised: 'Give the subject a surprised expression.',
  sad: 'Give the subject a sad expression.',
  angry: 'Give the subject an angry expression.',
}

export function expressionSentence(expression: ExpressionId, custom: string) {
  if (expression === 'custom') {
    const text = custom.trim()
    return text
      ? `Give the subject this expression: ${text}.`
      : 'Keep the facial expression natural and understated.'
  }
  return EXPRESSION[expression]
}

const MOOD: Record<MoodId, string> = {
  natural: 'Keep the overall mood natural.',
  professional: 'Maintain a professional mood.',
  editorial: 'Maintain a professional editorial mood.',
  cinematic: 'The overall mood should feel cinematic.',
  powerful: 'The overall mood should feel powerful.',
  dramatic: 'The overall mood should feel dramatic.',
  elegant: 'The overall mood should feel elegant.',
  friendly: 'The overall mood should feel friendly.',
  casual: 'The overall mood should feel casual.',
  playful: 'The overall mood should feel playful.',
  mysterious: 'The overall mood should feel mysterious.',
}

export function moodSentence(mood: MoodId) {
  return `${MOOD[mood]} Do not change the camera angle, lens, or lighting positions described above.`
}

function anatomicalSide(azimuth: number) {
  return azimuth > 0 ? 'right' : 'left'
}

function sidePhrase(azimuth: number) {
  const abs = Math.abs(azimuth)
  if (abs < LATERAL_FRONT_DEG) return 'directly in front of the subject'
  const side = anatomicalSide(azimuth)
  if (abs > 155) return 'behind the subject'
  if (abs > 125) {
    return `behind and to the subject's anatomical ${side} side, approximately ${formatDeg(abs)} degrees from the front`
  }
  if (abs > 75) {
    return `at the subject's anatomical ${side} side, approximately ${formatDeg(abs)} degrees from the front, beside the subject's ${side} shoulder`
  }
  if (abs >= LATERAL_CLEAR_DEG) {
    return `approximately ${formatDeg(abs)} degrees to the subject's anatomical ${side} side, beside the subject's ${side} shoulder`
  }
  return `approximately ${formatDeg(abs)} degrees to the subject's anatomical ${side} side`
}

function elevationPhrase(elevation: number, lookPitch: number) {
  const band = verticalCameraBand(elevation)
  const abs = Math.abs(elevation)
  if (band === 'eye-level') return 'approximately at eye level, looking toward the subject'
  const height =
    elevation > 0
      ? `approximately ${formatDeg(abs)} degrees above natural eye level`
      : `approximately ${formatDeg(abs)} degrees below natural eye level`
  const look =
    band === 'clear-low' || band === 'slight-low' || lookPitch > 6
      ? 'looking upward toward the subject'
      : band === 'clear-high' || band === 'slight-high' || lookPitch < -6
        ? 'looking downward toward the subject'
        : 'looking toward the subject'
  return `${height}, ${look}`
}

function distancePhrase(meters: number) {
  const value = `${Math.max(meters, 0).toFixed(2)}m`
  if (meters < 0.9) return `an extreme close distance of ${value}`
  if (meters < 1.7) return `a close portrait distance of ${value}`
  if (meters < 4.2) return `a moderate portrait distance of ${value}`
  if (meters < 7) return `a medium distance of ${value}`
  return `a wider full-length distance of ${value}`
}

function lightPlacement(analysis: LightAnalysis) {
  const abs = Math.abs(analysis.horizontalAngle)
  const sideName = anatomicalSide(analysis.horizontalAngle)
  const side =
    abs < LATERAL_FRONT_DEG
      ? 'in front of the subject'
      : abs > 155
        ? 'behind the subject'
        : abs >= LATERAL_CLEAR_DEG
          ? `approximately ${formatDeg(abs)} degrees on the subject's anatomical ${sideName} side, near the ${sideName} shoulder/${sideName} side of the face`
          : `approximately ${formatDeg(abs)} degrees on the subject's anatomical ${sideName} side`
  const vertical =
    Math.abs(analysis.verticalAngle) < 8
      ? 'near face level'
      : `approximately ${formatDeg(Math.abs(analysis.verticalAngle))} degrees ${analysis.verticalAngle > 0 ? 'above' : 'below'} the face`
  const kind = analysis.light.type === 'directional' ? ' as a directional source' : ''
  return `${side} and ${vertical}${kind}`
}

function wrapDegrees(degrees: number) {
  let value = degrees
  while (value > 180) value -= 360
  while (value < -180) value += 360
  return value
}
