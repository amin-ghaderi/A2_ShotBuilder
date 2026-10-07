export type Vec3 = [number, number, number]

export type GazeMode = 'camera' | 'original'

export type LightType = 'spot' | 'point' | 'directional'

export type LightRole = 'key' | 'fill' | 'rim' | 'custom'

export type FramingPreset =
  | 'extreme-close-up'
  | 'face-close-up'
  | 'head-shoulders'
  | 'chest-up'
  | 'torso-up'
  | 'waist-up'
  | 'three-quarter'
  | 'full-body'
  | 'custom'

export type NamedFramingPreset = Exclude<FramingPreset, 'custom'>

export type AspectRatio = '1:1' | '4:5' | '3:2' | '16:9' | '9:16'

export type BackgroundMode =
  | 'preserve'
  | 'plain-studio'
  | 'dark-studio'
  | 'light-studio'
  | 'neutral-gray'
  | 'black'
  | 'white'
  | 'custom-color'
  | 'soft-gradient'
  | 'custom-description'

export type ExpressionId =
  | 'original'
  | 'neutral'
  | 'slight-smile'
  | 'smile'
  | 'serious'
  | 'confident'
  | 'determined'
  | 'calm'
  | 'thoughtful'
  | 'surprised'
  | 'sad'
  | 'angry'
  | 'custom'

export type MoodId =
  | 'natural'
  | 'professional'
  | 'editorial'
  | 'cinematic'
  | 'powerful'
  | 'dramatic'
  | 'elegant'
  | 'friendly'
  | 'casual'
  | 'playful'
  | 'mysterious'

export type AimPoint = 'face' | 'chest' | 'torso' | 'custom'

export type TransformMode = 'translate' | 'rotate'

export type Selection =
  | { kind: 'none' }
  | { kind: 'subject' }
  | { kind: 'camera' }
  | { kind: 'target' }
  | { kind: 'light'; id: string }

export type SubjectState = {
  position: Vec3
  rotation: Vec3
  bodyYaw: number
  headYaw: number
  headPitch: number
  gaze: GazeMode
}

export type ShotCameraState = {
  position: Vec3
  target: Vec3
  focalLength: number
  roll: number
  aim: AimPoint
}

export type LightConfig = {
  id: string
  name: string
  type: LightType
  role: LightRole
  enabled: boolean
  position: Vec3
  rotation: Vec3
  target: Vec3
  intensity: number
  color: string
  temperature: number
  softness: number
  angle: number
}

export type FramingState = {
  preset: FramingPreset
  aspectRatio: AspectRatio
  compositionX: number
  compositionY: number
  headroom: number
}

export type BackgroundState = {
  mode: BackgroundMode
  color: string
  description: string
  gradientTop: string
  gradientBottom: string
}

export type GuideState = {
  thirds: boolean
  cross: boolean
  safe: boolean
  headroom: boolean
}

export type SceneData = {
  subject: SubjectState
  shotCamera: ShotCameraState
  lights: LightConfig[]
  framing: FramingState
  background: BackgroundState
  expression: ExpressionId
  customExpression: string
  mood: MoodId
  guides: GuideState
  selection: Selection
  transformMode: TransformMode
}
