import { clamp, copyVec, wrapPi } from '@/lib/math'
import { createDefaultProject, createDefaultShot } from '@/motion/lib/defaultProject'
import { uid } from '@/motion/lib/ids'
import { evaluateCamera, upsertKey } from '@/motion/lib/interpolation'
import { snapshotProject } from '@/motion/lib/projectSnapshot'
import { compileRef2VAPrompt } from '@/motion/lib/promptCompiler'
import { parseMotionProject } from '@/motion/lib/schema'
import type {
  CameraKeyframe,
  MotionObject,
  MotionObjectKind,
  MotionProject,
  MotionReference,
  MotionSelection,
  MotionShot,
  MotionSourceMode,
  ShotReferenceBinding,
  TransformMode,
  WorkflowBindingMeta,
} from '@/motion/types'
import { REF2VA_LIMITS } from '@/motion/types'
import type { AspectRatio, Vec3 } from '@/types/scene'
import { create } from 'zustand'

type MotionStore = MotionProject & {
  activeShot: () => MotionShot | undefined
  setSelection: (selection: MotionSelection) => void
  setTransformMode: (mode: TransformMode) => void
  setCurrentTime: (time: number) => void
  setPlaying: (playing: boolean) => void
  tickPlayback: (delta: number) => void
  setDuration: (duration: number) => void
  setAspectRatio: (aspectRatio: AspectRatio) => void
  setSourceMode: (mode: MotionSourceMode) => void
  setTrackTarget: (trackTarget: boolean) => void
  addObject: (kind: MotionObjectKind) => void
  removeObject: (id: string) => void
  updateObject: (id: string, patch: Partial<MotionObject>) => void
  setObjectTransform: (id: string, position: Vec3, rotation: Vec3, scale: Vec3) => void
  setCameraPose: (position: Vec3, target: Vec3) => void
  setFocalLength: (focalLength: number) => void
  insertCameraKeyframe: () => void
  deleteCameraKeyframe: (time: number) => void
  insertObjectKeyframe: (id: string) => void
  addLight: () => void
  updateLight: (id: string, patch: Partial<MotionShot['lights'][number]>) => void
  addShot: () => void
  duplicateShot: (id: string) => void
  deleteShot: (id: string) => void
  selectShot: (id: string) => void
  renameShot: (id: string, name: string) => void
  reorderShot: (id: string, direction: -1 | 1) => void
  addReference: (reference: Omit<MotionReference, 'id'>) => void
  updateReference: (id: string, patch: Partial<MotionReference>) => void
  removeReference: (id: string) => void
  bindReference: (binding: ShotReferenceBinding) => void
  unbindReference: (referenceId: string) => void
  setWorkflow: (workflow: WorkflowBindingMeta) => void
  setImportedVideo: (referenceId: string) => void
  setImportedTrim: (trimStart: number, trimEnd: number) => void
  setImportedRole: (role: NonNullable<MotionShot['importedVideo']>['role']) => void
  setNotes: (patch: Partial<MotionShot['notes']>) => void
  importProject: (raw: unknown) => string | null
  resetProject: () => void
  serialized: () => MotionProject
}

function patchShot(state: MotionProject, updater: (shot: MotionShot) => MotionShot): Partial<MotionProject> {
  return {
    updatedAt: new Date().toISOString(),
    shots: state.shots.map((shot) => (shot.id === state.activeShotId ? updater(shot) : shot)),
  }
}

export const useMotionStore = create<MotionStore>((set, get) => ({
  ...createDefaultProject(),

  activeShot: () => get().shots.find((shot) => shot.id === get().activeShotId),
  setSelection: (selection) => set({ selection }),
  setTransformMode: (transformMode) => set({ transformMode }),

  setCurrentTime: (time) =>
    set((state) =>
      patchShot(state, (shot) => ({ ...shot, currentTime: clamp(time, 0, shot.duration), playing: false })),
    ),

  setPlaying: (playing) =>
    set((state) =>
      patchShot(state, (shot) => ({
        ...shot,
        playing,
        currentTime: playing && shot.currentTime >= shot.duration - 0.01 ? 0 : shot.currentTime,
      })),
    ),

  tickPlayback: (delta) =>
    set((state) =>
      patchShot(state, (shot) => {
        if (!shot.playing) return shot
        const next = shot.currentTime + delta
        if (next >= shot.duration) return { ...shot, currentTime: shot.duration, playing: false }
        return { ...shot, currentTime: next }
      }),
    ),

  /**
   * Duration policy: clamp to 4–15s and keep currentTime in range.
   * Never delete camera, object, or light keys. Keys that sit on the previous
   * shot end (within 50ms) move with the new duration so the shot still has an
   * end pose. Every other key keeps its original time, including keys past the
   * new duration; they stay in the shot and become playable again if duration grows.
   */
  setDuration: (duration) =>
    set((state) =>
      patchShot(state, (shot) => {
        const next = clamp(duration, REF2VA_LIMITS.minDuration, REF2VA_LIMITS.maxDuration)
        const previous = shot.duration
        const retargetEnd = <T extends { time: number }>(keys: T[]) =>
          keys.map((key) => (Math.abs(key.time - previous) <= 0.05 ? { ...key, time: next } : key))
        return {
          ...shot,
          duration: next,
          currentTime: clamp(shot.currentTime, 0, next),
          cameraKeys: retargetEnd(shot.cameraKeys),
          objects: shot.objects.map((object) => ({ ...object, keyframes: retargetEnd(object.keyframes) })),
          lights: shot.lights.map((light) => ({ ...light, keyframes: retargetEnd(light.keyframes) })),
        }
      }),
    ),

  setAspectRatio: (aspectRatio) =>
    set((state) => patchShot(state, (shot) => ({ ...shot, aspectRatio, framing: { aspectRatio } }))),

  setSourceMode: (sourceMode) => set((state) => patchShot(state, (shot) => ({ ...shot, sourceMode }))),
  setTrackTarget: (trackTarget) => set((state) => patchShot(state, (shot) => ({ ...shot, trackTarget }))),

  addObject: (kind) =>
    set((state) =>
      patchShot(state, (shot) => {
        const id = uid('obj')
        const object: MotionObject = {
          id,
          name: kind[0].toUpperCase() + kind.slice(1),
          kind,
          position: [kind === 'person' ? 0 : 1.2, 0, kind === 'tree' ? -1.4 : 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          referenceIds: [],
          keyframes: [],
        }
        return { ...shot, objects: [...shot.objects, object] }
      }),
    ),

  removeObject: (id) =>
    set((state) => ({
      ...patchShot(state, (shot) => ({ ...shot, objects: shot.objects.filter((item) => item.id !== id) })),
      selection: state.selection.kind === 'object' && state.selection.id === id ? { kind: 'none' } : state.selection,
    })),

  updateObject: (id, patch) =>
    set((state) =>
      patchShot(state, (shot) => ({
        ...shot,
        objects: shot.objects.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      })),
    ),

  setObjectTransform: (id, position, rotation, scale) =>
    set((state) =>
      patchShot(state, (shot) => ({
        ...shot,
        objects: shot.objects.map((item) =>
          item.id === id
            ? {
                ...item,
                position: [clamp(position[0], -12, 12), Math.max(0, position[1]), clamp(position[2], -12, 12)],
                rotation: [rotation[0], wrapPi(rotation[1]), rotation[2]],
                scale: [clamp(scale[0], 0.2, 6), clamp(scale[1], 0.2, 6), clamp(scale[2], 0.2, 6)],
              }
            : item,
        ),
      })),
    ),

  setCameraPose: (position, target) =>
    set((state) =>
      patchShot(state, (shot) => {
        const live = evaluateCamera(shot.cameraKeys, shot.currentTime)
        const key: CameraKeyframe = {
          time: shot.currentTime,
          position: copyVec(position),
          target: copyVec(target),
          focalLength: live.focalLength,
          roll: live.roll,
          easing: 'smooth',
        }
        return { ...shot, cameraKeys: upsertKey(shot.cameraKeys, key) }
      }),
    ),

  setFocalLength: (focalLength) =>
    set((state) =>
      patchShot(state, (shot) => {
        const live = evaluateCamera(shot.cameraKeys, shot.currentTime)
        return {
          ...shot,
          cameraKeys: upsertKey(shot.cameraKeys, {
            time: shot.currentTime,
            position: live.position,
            target: live.target,
            focalLength: clamp(focalLength, 18, 200),
            roll: live.roll,
            easing: 'smooth',
          }),
        }
      }),
    ),

  insertCameraKeyframe: () =>
    set((state) =>
      patchShot(state, (shot) => {
        const live = evaluateCamera(shot.cameraKeys, shot.currentTime)
        return { ...shot, cameraKeys: upsertKey(shot.cameraKeys, { ...live, time: shot.currentTime, easing: 'smooth' }) }
      }),
    ),

  deleteCameraKeyframe: (time) =>
    set((state) =>
      patchShot(state, (shot) => ({
        ...shot,
        cameraKeys: shot.cameraKeys.length > 1 ? shot.cameraKeys.filter((key) => Math.abs(key.time - time) > 0.04) : shot.cameraKeys,
      })),
    ),

  insertObjectKeyframe: (id) =>
    set((state) =>
      patchShot(state, (shot) => ({
        ...shot,
        objects: shot.objects.map((item) =>
          item.id === id
            ? {
                ...item,
                keyframes: upsertKey(item.keyframes, {
                  time: shot.currentTime,
                  position: item.position,
                  rotation: item.rotation,
                  scale: item.scale,
                  easing: 'smooth',
                }),
              }
            : item,
        ),
      })),
    ),

  addLight: () =>
    set((state) =>
      patchShot(state, (shot) => {
        if (shot.lights.length >= 3) return shot
        return {
          ...shot,
          lights: [
            ...shot.lights,
            {
              id: uid('light'),
              name: 'Light',
              type: 'point',
              role: 'custom',
              enabled: true,
              movable: true,
              position: [0, 2.4, -1.6],
              target: [0, 1.4, 0],
              intensity: 40,
              color: '#fff4e5',
              temperature: 5600,
              softness: 0.6,
              angle: 0.5,
              keyframes: [],
            },
          ],
        }
      }),
    ),

  updateLight: (id, patch) =>
    set((state) =>
      patchShot(state, (shot) => ({
        ...shot,
        lights: shot.lights.map((light) => (light.id === id ? { ...light, ...patch } : light)),
      })),
    ),

  addShot: () =>
    set((state) => {
      const shot = createDefaultShot(`Shot ${state.shots.length + 1}`)
      return { shots: [...state.shots, shot], activeShotId: shot.id, selection: { kind: 'camera' } }
    }),

  duplicateShot: (id) =>
    set((state) => {
      const source = state.shots.find((shot) => shot.id === id)
      if (!source) return state
      const copy: MotionShot = {
        ...structuredClone(source),
        id: uid('shot'),
        name: `${source.name} copy`,
        playing: false,
      }
      return { shots: [...state.shots, copy], activeShotId: copy.id }
    }),

  deleteShot: (id) =>
    set((state) => {
      if (state.shots.length <= 1) return state
      const shots = state.shots.filter((shot) => shot.id !== id)
      return { shots, activeShotId: state.activeShotId === id ? shots[0].id : state.activeShotId }
    }),

  selectShot: (id) =>
    set((state) => ({
      activeShotId: id,
      shots: state.shots.map((shot) => ({ ...shot, playing: false })),
      selection: { kind: 'camera' },
    })),

  renameShot: (id, name) =>
    set((state) => {
      const trimmed = name.trim()
      if (!trimmed) return state
      return { shots: state.shots.map((shot) => (shot.id === id ? { ...shot, name: trimmed } : shot)) }
    }),

  reorderShot: (id, direction) =>
    set((state) => {
      const index = state.shots.findIndex((shot) => shot.id === id)
      const nextIndex = index + direction
      if (index < 0 || nextIndex < 0 || nextIndex >= state.shots.length) return state
      const shots = [...state.shots]
      const [moved] = shots.splice(index, 1)
      shots.splice(nextIndex, 0, moved)
      return { shots }
    }),

  addReference: (reference) =>
    set((state) => {
      const item: MotionReference = { ...reference, id: uid('ref') }
      return { references: [...state.references, item] }
    }),

  removeReference: (id) =>
    set((state) => ({
      references: state.references.filter((item) => item.id !== id),
      shots: state.shots.map((shot) => ({
        ...shot,
        bindings: shot.bindings.filter((binding) => binding.referenceId !== id),
        importedVideo: shot.importedVideo?.referenceId === id ? undefined : shot.importedVideo,
      })),
    })),

  updateReference: (id, patch) =>
    set((state) => ({
      references: state.references.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    })),

  bindReference: (binding) =>
    set((state) => {
      const objectId = binding.objectId ?? (state.selection.kind === 'object' ? state.selection.id : undefined)
      const shot = state.shots.find((item) => item.id === state.activeShotId)
      const object = objectId ? shot?.objects.find((item) => item.id === objectId) : undefined
      const subjectId =
        binding.subjectId ??
        object?.subjectId ??
        (object
          ? state.subjects.find((subject) => subject.kind === object.kind || (object.kind === 'person' && subject.kind === 'person'))?.id
          : undefined)
      const next = { ...binding, objectId, subjectId }
      return {
        subjects: state.subjects.map((subject) =>
          subject.id === subjectId
            ? { ...subject, referenceIds: [...new Set([...subject.referenceIds, next.referenceId])] }
            : subject,
        ),
        ...patchShot(state, (current) => ({
          ...current,
          bindings: [...current.bindings.filter((item) => item.referenceId !== next.referenceId), next],
          objects: current.objects.map((item) =>
            item.id === objectId
              ? {
                  ...item,
                  subjectId: subjectId ?? item.subjectId,
                  referenceIds: [...new Set([...item.referenceIds, next.referenceId])],
                }
              : item,
          ),
        })),
      }
    }),

  unbindReference: (referenceId) =>
    set((state) =>
      patchShot(state, (shot) => ({
        ...shot,
        bindings: shot.bindings.filter((item) => item.referenceId !== referenceId),
        objects: shot.objects.map((object) => ({
          ...object,
          referenceIds: object.referenceIds.filter((id) => id !== referenceId),
        })),
      })),
    ),

  setWorkflow: (workflow) => set({ workflow }),

  setImportedVideo: (referenceId) =>
    set((state) => {
      const reference = state.references.find((item) => item.id === referenceId)
      return {
        ...patchShot(state, (shot) => ({
          ...shot,
          sourceMode: 'import-video',
          importedVideo: {
            referenceId,
            role: 'motion',
            trimStart: 0,
            trimEnd: reference?.duration ?? 8,
          },
          bindings: [
            ...shot.bindings.filter((item) => item.referenceId !== referenceId),
            { referenceId, retention: 'weak_reference' },
          ],
        })),
      }
    }),

  setImportedTrim: (trimStart, trimEnd) =>
    set((state) =>
      patchShot(state, (shot) =>
        shot.importedVideo ? { ...shot, importedVideo: { ...shot.importedVideo, trimStart, trimEnd } } : shot,
      ),
    ),

  setImportedRole: (role) =>
    set((state) =>
      patchShot(state, (shot) =>
        shot.importedVideo ? { ...shot, importedVideo: { ...shot.importedVideo, role } } : shot,
      ),
    ),

  setNotes: (patch) => set((state) => patchShot(state, (shot) => ({ ...shot, notes: { ...shot.notes, ...patch } }))),

  importProject: (raw) => {
    try {
      const parsed = parseMotionProject(raw) as MotionProject
      set({
        ...parsed,
        shots: parsed.shots.map((shot) => ({ ...shot, playing: false })),
      })
      return null
    } catch (error) {
      return error instanceof Error ? error.message : 'Invalid project JSON'
    }
  },

  resetProject: () => set(createDefaultProject()),

  serialized: () => {
    const project = snapshotProject(get())
    const withPrompts: MotionProject = {
      ...project,
      shots: project.shots.map((shot) => ({ ...shot, compiledPrompt: compileRef2VAPrompt(project, shot) })),
    }
    return parseMotionProject(withPrompts) as MotionProject
  },
}))
