import type {
  AimPoint,
  AspectRatio,
  BackgroundMode,
  ExpressionId,
  GazeMode,
  LightRole,
  LightType,
  MoodId,
  NamedFramingPreset,
} from '@/types/scene'

/** Subject faces +Z. Their right is -X when yaw is 0. Heights are meters from the feet. */
export const EYE_HEIGHT = 1.64
export const HEAD_TOP = 1.78
export const FACE_ANCHOR = 1.55

export const AIM_HEIGHT: Record<AimPoint, number> = {
  face: 1.62,
  chest: 1.32,
  torso: 1.16,
  custom: 1.4,
}

export const ASPECT_VALUES: Record<AspectRatio, number> = {
  '1:1': 1,
  '4:5': 4 / 5,
  '3:2': 3 / 2,
  '16:9': 16 / 9,
  '9:16': 9 / 16,
}

export const ASPECT_RATIOS: AspectRatio[] = ['1:1', '4:5', '3:2', '16:9', '9:16']

export const LENS_PRESETS = [24, 35, 50, 85, 135] as const

export type FramingSpec = {
  bottom: number
  top: number
  label: string
  code: string
  phrase: string
}

export const FRAMING_SPECS: Record<NamedFramingPreset, FramingSpec> = {
  'extreme-close-up': {
    bottom: 1.52,
    top: 1.7,
    label: 'Extreme Close-Up',
    code: 'ECU',
    phrase: 'in an extreme close-up on the eyes and face',
  },
  'face-close-up': {
    bottom: 1.4,
    top: 1.9,
    label: 'Face Close-Up',
    code: 'FACE',
    phrase: 'in a close-up on the face',
  },
  'head-shoulders': {
    bottom: 1.22,
    top: 1.96,
    label: 'Head & Shoulders',
    code: 'HS',
    phrase: 'from the head and shoulders',
  },
  'chest-up': {
    bottom: 1.08,
    top: 1.98,
    label: 'Chest Up',
    code: 'CHEST',
    phrase: 'from the chest upward',
  },
  'torso-up': {
    bottom: 0.94,
    top: 1.98,
    label: 'Torso Up',
    code: 'TORSO',
    phrase: 'from the torso upward',
  },
  'waist-up': {
    bottom: 0.78,
    top: 2.02,
    label: 'Waist Up',
    code: 'WAIST',
    phrase: 'from the waist upward',
  },
  'three-quarter': {
    bottom: 0.34,
    top: 2.06,
    label: 'Three-Quarter',
    code: '3Q',
    phrase: 'in a three-quarter body view',
  },
  'full-body': {
    bottom: -0.06,
    top: 2.08,
    label: 'Full Body',
    code: 'FULL',
    phrase: 'in a full-body view',
  },
}

export const FRAMING_PRESETS = Object.keys(FRAMING_SPECS) as NamedFramingPreset[]

export const BACKGROUND_OPTIONS: { value: BackgroundMode; label: string }[] = [
  { value: 'preserve', label: 'Preserve Original' },
  { value: 'plain-studio', label: 'Plain Studio' },
  { value: 'dark-studio', label: 'Dark Studio' },
  { value: 'light-studio', label: 'Light Studio' },
  { value: 'neutral-gray', label: 'Neutral Gray' },
  { value: 'black', label: 'Black' },
  { value: 'white', label: 'White' },
  { value: 'custom-color', label: 'Custom Color' },
  { value: 'soft-gradient', label: 'Soft Gradient' },
  { value: 'custom-description', label: 'Custom Description' },
]

export const EXPRESSION_OPTIONS: { value: ExpressionId; label: string }[] = [
  { value: 'original', label: 'Keep Original' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'slight-smile', label: 'Slight Smile' },
  { value: 'smile', label: 'Smile' },
  { value: 'serious', label: 'Serious' },
  { value: 'confident', label: 'Confident' },
  { value: 'determined', label: 'Determined' },
  { value: 'calm', label: 'Calm' },
  { value: 'thoughtful', label: 'Thoughtful' },
  { value: 'surprised', label: 'Surprised' },
  { value: 'sad', label: 'Sad' },
  { value: 'angry', label: 'Angry' },
  { value: 'custom', label: 'Custom' },
]

export const MOOD_OPTIONS: { value: MoodId; label: string }[] = [
  { value: 'natural', label: 'Natural' },
  { value: 'professional', label: 'Professional' },
  { value: 'editorial', label: 'Editorial' },
  { value: 'cinematic', label: 'Cinematic' },
  { value: 'powerful', label: 'Powerful' },
  { value: 'dramatic', label: 'Dramatic' },
  { value: 'elegant', label: 'Elegant' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'casual', label: 'Casual' },
  { value: 'playful', label: 'Playful' },
  { value: 'mysterious', label: 'Mysterious' },
]

export const LIGHT_TYPES: { value: LightType; label: string }[] = [
  { value: 'spot', label: 'Spot' },
  { value: 'point', label: 'Point' },
  { value: 'directional', label: 'Directional' },
]

export const LIGHT_ROLES: { value: LightRole; label: string }[] = [
  { value: 'key', label: 'Key' },
  { value: 'fill', label: 'Fill' },
  { value: 'rim', label: 'Rim' },
  { value: 'custom', label: 'Custom' },
]

export const GAZE_OPTIONS: { value: GazeMode; label: string }[] = [
  { value: 'original', label: 'Keep Original Gaze' },
  { value: 'camera', label: 'Look at Camera' },
]

export const AIM_OPTIONS: { value: AimPoint; label: string }[] = [
  { value: 'face', label: 'Face' },
  { value: 'chest', label: 'Chest' },
  { value: 'torso', label: 'Torso' },
  { value: 'custom', label: 'Custom' },
]

export const BACKGROUND_VISUALS: Record<
  BackgroundMode,
  { scene: string; floor: string; wall: string }
> = {
  preserve: { scene: '#2c2e33', floor: '#34363c', wall: '#2a2c31' },
  'plain-studio': { scene: '#8d8d92', floor: '#9a9aa0', wall: '#86868c' },
  'dark-studio': { scene: '#121418', floor: '#1c1f27', wall: '#101216' },
  'light-studio': { scene: '#e4e0d8', floor: '#d8d4cc', wall: '#e7e3db' },
  'neutral-gray': { scene: '#8a8a8a', floor: '#7a7a7a', wall: '#909090' },
  black: { scene: '#050505', floor: '#0c0c0c', wall: '#050505' },
  white: { scene: '#f3f3f3', floor: '#e7e7e7', wall: '#f6f6f6' },
  'custom-color': { scene: '#6e6a64', floor: '#5c5853', wall: '#6e6a64' },
  'soft-gradient': { scene: '#2a3142', floor: '#1a1c22', wall: '#243044' },
  'custom-description': { scene: '#6e6a64', floor: '#5a564f', wall: '#6a655e' },
}
