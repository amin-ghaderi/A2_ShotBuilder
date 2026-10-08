import type { AspectRatio, LightRole, LightType, Vec3 } from '@/types/scene'

export type WorkspaceId = 'still' | 'motion'

export type MotionObjectKind = 'person' | 'car' | 'tree' | 'table' | 'box' | 'sphere'

export type MotionSourceMode = 'build-3d' | 'import-video'

export type MotionAssetKind = 'image' | 'video' | 'audio'

export type MotionReferenceRole =
  | 'identity'
  | 'appearance'
  | 'environment'
  | 'object'
  | 'motion'
  | 'camera'
  | 'shot'
  | 'edit-source'
  | 'audio'
  | 'voice'

export type RetentionMarker =
  | 'fully_preserved'
  | 'partially_preserved'
  | 'attribute_transfer'
  | 'weak_reference'

export type AudioRetentionMarker = 'fully_copy' | 'partially_copy' | 'reference' | 'weak_reference'

export type MotionSelection =
  | { kind: 'none' }
  | { kind: 'object'; id: string }
  | { kind: 'camera' }
  | { kind: 'target' }
  | { kind: 'light'; id: string }

export type TransformMode = 'translate' | 'rotate' | 'scale'

export type EasingName = 'linear' | 'smooth'

export type TransformKeyframe = {
  time: number
  position: Vec3
  rotation: Vec3
  scale: Vec3
  easing: EasingName
}

export type CameraKeyframe = {
  time: number
  position: Vec3
  target: Vec3
  focalLength: number
  roll: number
  easing: EasingName
}

export type MotionObject = {
  id: string
  name: string
  kind: MotionObjectKind
  position: Vec3
  rotation: Vec3
  scale: Vec3
  subjectId?: string
  referenceIds: string[]
  keyframes: TransformKeyframe[]
}

export type MotionLight = {
  id: string
  name: string
  type: LightType
  role: LightRole
  enabled: boolean
  movable: boolean
  position: Vec3
  target: Vec3
  intensity: number
  color: string
  temperature: number
  softness: number
  angle: number
  keyframes: TransformKeyframe[]
}

export type MotionSubject = {
  id: string
  name: string
  kind: MotionObjectKind | 'environment' | 'custom'
  description: string
  referenceIds: string[]
}

export type MotionReference = {
  id: string
  kind: MotionAssetKind
  name: string
  filename: string
  mime: string
  dataUrl: string
  role: MotionReferenceRole
  description: string
  duration?: number
  trimStart: number
  trimEnd: number
}

export type ShotReferenceBinding = {
  referenceId: string
  subjectId?: string
  objectId?: string
  retention: RetentionMarker | AudioRetentionMarker
}

export type ImportedVideoState = {
  referenceId: string
  role: Extract<MotionReferenceRole, 'motion' | 'camera' | 'shot' | 'edit-source' | 'appearance'>
  trimStart: number
  trimEnd: number
}

export type MotionShot = {
  id: string
  name: string
  sourceMode: MotionSourceMode
  duration: number
  aspectRatio: AspectRatio
  currentTime: number
  playing: boolean
  trackTarget: boolean
  objects: MotionObject[]
  lights: MotionLight[]
  cameraKeys: CameraKeyframe[]
  framing: {
    aspectRatio: AspectRatio
  }
  importedVideo?: ImportedVideoState
  bindings: ShotReferenceBinding[]
  notes: {
    style: string
    action: string
    soundscape: string
    music: string
  }
  compiledPrompt?: string
}

export type WorkflowBindingMeta = {
  source: 'official-ref2va' | 'imported'
  filename?: string
  generationNodeType: 'MiniMaxH3ReferenceToVideo'
  lastDiagnostic?: string
}

export type MotionProject = {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  shots: MotionShot[]
  activeShotId: string
  references: MotionReference[]
  subjects: MotionSubject[]
  workflow: WorkflowBindingMeta
  selection: MotionSelection
  transformMode: TransformMode
}

export const REF2VA_LIMITS = {
  maxImages: 9,
  maxVideos: 3,
  maxAudios: 3,
  minDuration: 4,
  maxDuration: 15,
  fps: 24,
  minReliableChunk: 4,
  defaultChunk: 10,
} as const

export const H3_FRAME_EXPRESSION = 'max(5, round(a * 24)) + (5 - (max(5, round(a * 24)) % 17)) % 17'

export const MOTION_OBJECT_KINDS: { value: MotionObjectKind; label: string }[] = [
  { value: 'person', label: 'Person' },
  { value: 'car', label: 'Car' },
  { value: 'tree', label: 'Tree' },
  { value: 'table', label: 'Table' },
  { value: 'box', label: 'Box' },
  { value: 'sphere', label: 'Sphere' },
]
