import { kelvinToHex } from '@/lib/color'
import { AIM_HEIGHT } from '@/lib/constants'
import { analyzeCamera, positionFromViewAngles, subjectFrameOffset } from '@/lib/geometry/cameraAnalysis'
import { analyzeCrop, cameraForPreset, defaultViewElevation } from '@/lib/geometry/framing'
import { clamp, copyVec, dist, wrapPi } from '@/lib/math'
import { parseScene } from '@/lib/schemas/sceneSchema'
import type {
  AimPoint,
  AspectRatio,
  BackgroundState,
  ExpressionId,
  GazeMode,
  GuideState,
  LightConfig,
  LightRole,
  MoodId,
  NamedFramingPreset,
  SceneData,
  Selection,
  ShotCameraState,
  SubjectState,
  TransformMode,
  Vec3,
} from '@/types/scene'
import { create } from 'zustand'

export type SceneStore = SceneData & {
  select: (selection: Selection) => void
  setTransformMode: (mode: TransformMode) => void
  setShotCameraPosition: (position: Vec3) => void
  setShotCameraTarget: (target: Vec3) => void
  setShotCameraPose: (position: Vec3, target: Vec3) => void
  setFocalLength: (focalLength: number) => void
  setRoll: (roll: number) => void
  pointAtSubject: (aim: AimPoint) => void
  setTargetHeight: (height: number) => void
  scaleDistance: (factor: number) => void
  shiftComposition: (direction: 'left' | 'right') => void
  moveFraming: (direction: 'up' | 'down') => void
  centerSubject: () => void
  applyFramingPreset: (preset: NamedFramingPreset) => void
  setAspectRatio: (aspectRatio: AspectRatio) => void
  setBodyYaw: (bodyYaw: number) => void
  setSubjectPosition: (position: Vec3) => void
  setSubjectTransform: (position: Vec3, bodyYaw: number) => void
  setHeadYaw: (headYaw: number) => void
  setHeadPitch: (headPitch: number) => void
  setGaze: (gaze: GazeMode) => void
  updateLight: (id: string, patch: Partial<LightConfig>) => void
  addLight: () => void
  removeLight: (id: string) => void
  setBackground: (patch: Partial<BackgroundState>) => void
  setExpression: (expression: ExpressionId) => void
  setCustomExpression: (customExpression: string) => void
  setMood: (mood: MoodId) => void
  toggleGuide: (guide: keyof GuideState) => void
  resetScene: () => void
}

export function createDefaultScene(): SceneData {
  const subject: SubjectState = {
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    bodyYaw: 0,
    headYaw: 0,
    headPitch: 0,
    gaze: 'original',
  }
  const focalLength = 85
  const preset: NamedFramingPreset = 'torso-up'
  const viewElevation = defaultViewElevation(focalLength, preset)
  const posed = cameraForPreset(subject, focalLength, preset, 0, viewElevation)
  const shotCamera: ShotCameraState = {
    position: posed.position,
    target: posed.target,
    focalLength,
    roll: 0,
    aim: 'chest',
  }
  const face: Vec3 = [0, AIM_HEIGHT.face, 0]
  const keyColor = kelvinToHex(4300)
  const fillColor = kelvinToHex(5600)

  const scene: SceneData = {
    subject,
    shotCamera,
    lights: [
      {
        id: 'light-key',
        name: 'Key',
        type: 'spot',
        role: 'key',
        enabled: true,
        position: positionFromViewAngles(face, 36, 32, 2.45, 0),
        rotation: [0, 0, 0],
        target: [0, 1.48, 0],
        intensity: 78,
        color: keyColor,
        temperature: 4300,
        softness: 0.72,
        angle: 0.55,
      },
      {
        id: 'light-fill',
        name: 'Fill',
        type: 'point',
        role: 'fill',
        enabled: true,
        position: positionFromViewAngles(face, -40, 8, 2.7, 0),
        rotation: [0, 0, 0],
        target: [0, 1.45, 0],
        intensity: 32,
        color: fillColor,
        temperature: 5600,
        softness: 0.85,
        angle: 0.7,
      },
    ],
    framing: {
      preset,
      aspectRatio: '4:5',
      compositionX: 0,
      compositionY: shotCamera.target[1] - 1.46,
      headroom: 0,
    },
    background: {
      mode: 'dark-studio',
      color: '#1a1c22',
      description: '',
      gradientTop: '#445068',
      gradientBottom: '#14161c',
    },
    expression: 'original',
    customExpression: '',
    mood: 'natural',
    guides: {
      thirds: false,
      cross: false,
      safe: false,
      headroom: false,
    },
    selection: { kind: 'camera' },
    transformMode: 'translate',
  }
  scene.framing.headroom = analyzeCrop(subject, shotCamera).headroom
  return parseScene(scene)
}

function withCamera(state: SceneData, camera: Partial<ShotCameraState>, framing: Partial<SceneData['framing']> = {}) {
  const shotCamera: ShotCameraState = {
    ...state.shotCamera,
    ...camera,
    position: camera.position ? copyVec(camera.position) : state.shotCamera.position,
    target: camera.target ? copyVec(camera.target) : state.shotCamera.target,
  }
  shotCamera.position = [
    clamp(shotCamera.position[0], -20, 20),
    clamp(shotCamera.position[1], 0.08, 12),
    clamp(shotCamera.position[2], -20, 20),
  ]
  shotCamera.target = [
    clamp(shotCamera.target[0], -8, 8),
    clamp(shotCamera.target[1], 0.05, 3.2),
    clamp(shotCamera.target[2], -8, 8),
  ]
  const separation = dist(shotCamera.position, shotCamera.target)
  if (separation < 0.35) {
    const analysis = analyzeCamera(state.subject, shotCamera)
    shotCamera.position = positionFromViewAngles(
      shotCamera.target,
      analysis.azimuth,
      analysis.viewElevation,
      0.35,
      state.subject.bodyYaw,
    )
  }
  return {
    shotCamera,
    framing: {
      ...state.framing,
      ...framing,
      headroom: analyzeCrop(state.subject, shotCamera).headroom,
      compositionX: shotCamera.target[0] - state.subject.position[0],
      compositionY: shotCamera.target[1] - (state.subject.position[1] + AIM_HEIGHT.chest),
    },
  }
}

export const useSceneStore = create<SceneStore>((set) => ({
  ...createDefaultScene(),

  select: (selection) => set({ selection }),
  setTransformMode: (transformMode) => set({ transformMode }),

  setShotCameraPosition: (position) =>
    set((state) => withCamera(state, { position }, { preset: 'custom' })),

  setShotCameraTarget: (target) =>
    set((state) => withCamera(state, { target, aim: 'custom' }, { preset: 'custom' })),

  setShotCameraPose: (position, target) =>
    set((state) => withCamera(state, { position, target, aim: 'custom' }, { preset: 'custom' })),

  setFocalLength: (focalLength) =>
    set((state) => withCamera(state, { focalLength: clamp(focalLength, 18, 200) }, { preset: 'custom' })),

  setRoll: (roll) => set((state) => withCamera(state, { roll: clamp(roll, -Math.PI, Math.PI) })),

  pointAtSubject: (aim) =>
    set((state) => {
      const height = state.subject.position[1] + AIM_HEIGHT[aim]
      const target: Vec3 = [state.subject.position[0], aim === 'custom' ? state.shotCamera.target[1] : height, state.subject.position[2]]
      return withCamera(state, { target, aim }, { preset: 'custom' })
    }),

  setTargetHeight: (height) =>
    set((state) => {
      const target: Vec3 = [state.shotCamera.target[0], height, state.shotCamera.target[2]]
      return withCamera(state, { target, aim: 'custom' }, { preset: 'custom' })
    }),

  scaleDistance: (factor) =>
    set((state) => {
      const { position, target } = state.shotCamera
      const offset: Vec3 = [position[0] - target[0], position[1] - target[1], position[2] - target[2]]
      const current = Math.max(0.001, Math.hypot(offset[0], offset[1], offset[2]))
      const next = clamp(current * factor, 0.35, 18)
      const scale = next / current
      const nextPosition: Vec3 = [target[0] + offset[0] * scale, target[1] + offset[1] * scale, target[2] + offset[2] * scale]
      return withCamera(state, { position: nextPosition }, { preset: 'custom' })
    }),

  shiftComposition: (direction) =>
    set((state) => {
      const { right } = subjectFrameOffset(state.subject, state.shotCamera)
      const sign = direction === 'left' ? 1 : -1
      const step = 0.08 * sign
      const target = state.shotCamera.target
      const next: Vec3 = [target[0] + right[0] * step, target[1] + right[1] * step, target[2] + right[2] * step]
      return withCamera(state, { target: next, aim: 'custom' }, { preset: 'custom' })
    }),

  moveFraming: (direction) =>
    set((state) => {
      const target = state.shotCamera.target
      const next: Vec3 = [target[0], target[1] + (direction === 'up' ? 0.07 : -0.07), target[2]]
      return withCamera(state, { target: next, aim: 'custom' }, { preset: 'custom' })
    }),

  centerSubject: () =>
    set((state) => {
      const target: Vec3 = [state.subject.position[0], state.shotCamera.target[1], state.subject.position[2]]
      return withCamera(state, { target, aim: state.shotCamera.aim === 'custom' ? 'custom' : state.shotCamera.aim })
    }),

  applyFramingPreset: (preset) =>
    set((state) => {
      const analysis = analyzeCamera(state.subject, state.shotCamera)
      const posed = cameraForPreset(
        state.subject,
        state.shotCamera.focalLength,
        preset,
        analysis.azimuth,
        analysis.viewElevation,
      )
      return withCamera(state, { position: posed.position, target: posed.target }, { preset })
    }),

  setAspectRatio: (aspectRatio) => set((state) => ({ framing: { ...state.framing, aspectRatio } })),

  setBodyYaw: (bodyYaw) =>
    set((state) => ({
      subject: { ...state.subject, bodyYaw: wrapPi(bodyYaw), rotation: [0, wrapPi(bodyYaw), 0] },
    })),

  setSubjectPosition: (position) =>
    set((state) => ({
      subject: {
        ...state.subject,
        position: [clamp(position[0], -6, 6), 0, clamp(position[2], -6, 6)],
      },
    })),

  setSubjectTransform: (position, bodyYaw) =>
    set((state) => {
      const yaw = wrapPi(bodyYaw)
      return {
        subject: {
          ...state.subject,
          bodyYaw: yaw,
          rotation: [0, yaw, 0] as Vec3,
          position: [clamp(position[0], -6, 6), 0, clamp(position[2], -6, 6)],
        },
      }
    }),

  setHeadYaw: (headYaw) => set((state) => ({ subject: { ...state.subject, headYaw: wrapPi(headYaw) } })),
  setHeadPitch: (headPitch) =>
    set((state) => ({ subject: { ...state.subject, headPitch: clamp(headPitch, -1.1, 1.1) } })),
  setGaze: (gaze) => set((state) => ({ subject: { ...state.subject, gaze } })),

  updateLight: (id, patch) =>
    set((state) => ({
      lights: state.lights.map((light) => (light.id === id ? { ...light, ...patch } : light)),
    })),

  addLight: () =>
    set((state) => {
      if (state.lights.length >= 3) return state
      const used = new Set(state.lights.map((light) => light.role))
      const role: LightRole = (['key', 'fill', 'rim'] as const).find((item) => !used.has(item)) ?? 'custom'
      const id = `light-${crypto.randomUUID().slice(0, 8)}`
      const anchor: Vec3 = [state.subject.position[0], state.subject.position[1] + 1.5, state.subject.position[2]]
      const placement =
        role === 'rim'
          ? positionFromViewAngles(anchor, 168, 38, 2.3, state.subject.bodyYaw)
          : role === 'fill'
            ? positionFromViewAngles(anchor, -38, 10, 2.6, state.subject.bodyYaw)
            : positionFromViewAngles(anchor, 34, 30, 2.4, state.subject.bodyYaw)
      const temperature = role === 'rim' ? 6800 : role === 'fill' ? 5600 : 4300
      const light: LightConfig = {
        id,
        name: role === 'key' ? 'Key' : role === 'fill' ? 'Fill' : role === 'rim' ? 'Rim' : 'Light',
        type: role === 'fill' ? 'point' : 'spot',
        role,
        enabled: true,
        position: placement,
        rotation: [0, 0, 0],
        target: [state.subject.position[0], 1.48, state.subject.position[2]],
        intensity: role === 'key' ? 74 : role === 'fill' ? 30 : 42,
        color: kelvinToHex(temperature),
        temperature,
        softness: role === 'rim' ? 0.35 : 0.7,
        angle: role === 'rim' ? 0.42 : 0.58,
      }
      return {
        lights: [...state.lights, light],
        selection: { kind: 'light', id },
      }
    }),

  removeLight: (id) =>
    set((state) => ({
      lights: state.lights.filter((light) => light.id !== id),
      selection: state.selection.kind === 'light' && state.selection.id === id ? { kind: 'none' } : state.selection,
    })),

  setBackground: (patch) => set((state) => ({ background: { ...state.background, ...patch } })),
  setExpression: (expression) => set({ expression }),
  setCustomExpression: (customExpression) => set({ customExpression }),
  setMood: (mood) => set({ mood }),
  toggleGuide: (guide) => set((state) => ({ guides: { ...state.guides, [guide]: !state.guides[guide] } })),
  resetScene: () => set(createDefaultScene()),
}))

export function selectionKey(selection: Selection) {
  if (selection.kind === 'light') return `light:${selection.id}`
  if (selection.kind === 'none') return null
  return selection.kind
}
