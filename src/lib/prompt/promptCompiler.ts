import { subjectFrameOffset, analyzeCamera } from '@/lib/geometry/cameraAnalysis'
import { analyzeCrop, aspectPhrase, headroomPhrase } from '@/lib/geometry/framing'
import { analyzeLights } from '@/lib/geometry/lightAnalysis'
import {
  bodySentence,
  cameraPositionSentence,
  expressionSentence,
  gazeSentence,
  lateralityConstraint,
  lensSentence,
  lightSentence,
  moodSentence,
  rollSentence,
  verticalAngleConstraint,
} from '@/lib/prompt/promptFragments'
import type { BackgroundState, SceneData } from '@/types/scene'

const IDENTITY = `Use the uploaded photograph as the absolute visual and identity reference for the real person.

Create the exact same person from a new camera viewpoint.`

const PRESERVE = `Preserve the exact identity, facial geometry, age, skin texture, hairstyle, body proportions, clothing, and natural physical appearance of the reference person.

The output must be strictly photorealistic and look like a real camera photograph.

Do not create animation, illustration, anime, CGI appearance, artificial skin, facial redesign, beauty-filter effects, or unnecessary anatomical alterations.`

export function compilePrompt(state: SceneData) {
  const analysis = analyzeCamera(state.subject, state.shotCamera)
  const crop = analyzeCrop(state.subject, state.shotCamera)
  const lights = analyzeLights(state.subject, state.lights)
  const roll = rollSentence(state.shotCamera.roll)
  const cameraLine = [cameraPositionSentence(analysis), roll].filter(Boolean).join(' ')
  const laterality = lateralityConstraint(analysis.azimuth)
  const vertical = verticalAngleConstraint(analysis.elevation)
  const cameraBlock = [cameraLine, laterality, vertical].filter(Boolean).join('\n\n')

  const paragraphs = [
    IDENTITY,
    cameraBlock,
    lensSentence(state.shotCamera.focalLength),
    `${bodySentence(state.subject.bodyYaw)} ${gazeSentence(state.subject.gaze, state.subject.headYaw, state.subject.headPitch)}`,
    framingSentence(state, crop),
    lightingParagraph(lights),
    backgroundSentence(state.background),
    `${expressionSentence(state.expression, state.customExpression)} ${moodSentence(state.mood)}`,
    PRESERVE,
  ]

  return paragraphs.filter((paragraph) => paragraph.trim().length > 0).join('\n\n')
}

function framingSentence(state: SceneData, crop: ReturnType<typeof analyzeCrop>) {
  const headroom = headroomPhrase(crop.headroom)
  const placement = compositionPhrase(state)
  const parts = [
    `Frame the subject ${crop.phrase} in a ${aspectPhrase(state.framing.aspectRatio)} composition`,
  ]
  if (headroom) parts.push(headroom)
  let sentence = `${parts.join(', ')}.`
  if (placement) sentence += ` ${placement}`
  return sentence
}

function compositionPhrase(state: SceneData) {
  const offset = subjectFrameOffset(state.subject, state.shotCamera)
  if (offset.x > 0.12) return 'Place the subject to the right of center.'
  if (offset.x < -0.12) return 'Place the subject to the left of center.'
  return 'Keep the subject near the center of the frame.'
}

function lightingParagraph(lights: ReturnType<typeof analyzeLights>) {
  if (lights.length === 0) {
    return 'Use soft, even illumination without a distinct shaped key light.'
  }
  const order = { key: 0, fill: 1, rim: 2, custom: 3 }
  return [...lights]
    .sort((a, b) => order[a.light.role] - order[b.light.role] || b.light.intensity - a.light.intensity)
    .map(lightSentence)
    .join('\n\n')
}

function backgroundSentence(background: BackgroundState) {
  switch (background.mode) {
    case 'preserve':
      return 'Preserve the original background from the reference photograph. Do not replace or redesign the environment.'
    case 'plain-studio':
      return 'Use a plain, seamless studio background.'
    case 'dark-studio':
      return 'Use a dark minimal studio background.'
    case 'light-studio':
      return 'Use a light, clean studio background.'
    case 'neutral-gray':
      return 'Use a neutral gray seamless background.'
    case 'black':
      return 'Use a pure black background.'
    case 'white':
      return 'Use a clean white background.'
    case 'custom-color':
      return `Use a solid ${background.color} background.`
    case 'soft-gradient':
      return 'Use a soft gradient background, darker toward the floor and lighter above the subject.'
    case 'custom-description': {
      const text = background.description.trim()
      return text
        ? `Use this background: ${text}`
        : 'Replace the background with the custom environment described by the user.'
    }
  }
}
