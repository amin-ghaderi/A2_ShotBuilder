import { migrateBindingsToSlots } from '@/motion/lib/references'
import type { MotionProject } from '@/motion/types'
import { z } from 'zod'

const vec3 = z.tuple([z.number(), z.number(), z.number()])

const keyframe = z.object({
  time: z.number(),
  position: vec3,
  rotation: vec3,
  scale: vec3,
  easing: z.enum(['linear', 'smooth']),
})

export const motionProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  activeShotId: z.string(),
  selection: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('none') }),
    z.object({ kind: z.literal('object'), id: z.string() }),
    z.object({ kind: z.literal('camera') }),
    z.object({ kind: z.literal('target') }),
    z.object({ kind: z.literal('light'), id: z.string() }),
  ]),
  transformMode: z.enum(['translate', 'rotate', 'scale']),
  workflow: z.object({
    source: z.enum(['official-ref2va', 'imported']),
    filename: z.string().optional(),
    generationNodeType: z.literal('MiniMaxH3ReferenceToVideo'),
    lastDiagnostic: z.string().optional(),
  }),
  subjects: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      kind: z.string(),
      description: z.string(),
      referenceIds: z.array(z.string()),
    }),
  ),
  references: z.array(
    z.object({
      id: z.string(),
      kind: z.enum(['image', 'video', 'audio']),
      name: z.string(),
      filename: z.string(),
      mime: z.string(),
      dataUrl: z.string(),
      role: z.string(),
      description: z.string(),
      duration: z.number().optional(),
      trimStart: z.number(),
      trimEnd: z.number(),
    }),
  ),
  shots: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      sourceMode: z.enum(['build-3d', 'import-video']),
      duration: z.number(),
      aspectRatio: z.enum(['1:1', '4:5', '3:2', '16:9', '9:16']),
      currentTime: z.number(),
      playing: z.boolean(),
      trackTarget: z.boolean(),
      objects: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          kind: z.enum(['person', 'car', 'tree', 'table', 'box', 'sphere']),
          position: vec3,
          rotation: vec3,
          scale: vec3,
          subjectId: z.string().optional(),
          referenceIds: z.array(z.string()),
          keyframes: z.array(keyframe),
        }),
      ),
      lights: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          type: z.enum(['spot', 'point', 'directional']),
          role: z.enum(['key', 'fill', 'rim', 'custom']),
          enabled: z.boolean(),
          movable: z.boolean(),
          position: vec3,
          target: vec3,
          intensity: z.number(),
          color: z.string(),
          temperature: z.number(),
          softness: z.number(),
          angle: z.number(),
          keyframes: z.array(keyframe),
        }),
      ),
      cameraKeys: z.array(
        z.object({
          time: z.number(),
          position: vec3,
          target: vec3,
          focalLength: z.number(),
          roll: z.number(),
          easing: z.enum(['linear', 'smooth']),
        }),
      ),
      framing: z.object({ aspectRatio: z.enum(['1:1', '4:5', '3:2', '16:9', '9:16']) }),
      importedVideo: z
        .object({
          referenceId: z.string(),
          role: z.enum(['motion', 'camera', 'shot', 'edit-source', 'appearance']),
          trimStart: z.number(),
          trimEnd: z.number(),
        })
        .optional(),
      bindings: z.array(
        z.object({
          referenceId: z.string(),
          subjectId: z.string().optional(),
          objectId: z.string().optional(),
          retention: z.string(),
        }),
      ),
      notes: z.object({
        style: z.string(),
        action: z.string(),
        soundscape: z.string(),
        music: z.string(),
      }),
      compiledPrompt: z.string().optional(),
      referenceSlots: z
        .array(
          z.object({
            id: z.string(),
            ownerType: z.enum(['object', 'shot']),
            ownerId: z.string(),
            modality: z.enum(['image', 'video', 'video_with_audio', 'audio']),
            role: z.string(),
            retention: z.string(),
            order: z.number(),
            description: z.string().optional().default(''),
            useSynchronizedAudio: z.boolean().optional().default(false),
            defineAudioLabel: z.boolean().optional().default(false),
          }),
        )
        .optional()
        .default([]),
    }),
  ),
})

export function parseMotionProject(input: unknown): MotionProject {
  const parsed = motionProjectSchema.parse(input)
  const project = parsed as MotionProject
  return {
    ...project,
    shots: project.shots.map((shot) => ({
      ...shot,
      referenceSlots: shot.referenceSlots.length > 0 ? shot.referenceSlots : migrateBindingsToSlots(project, shot),
    })),
  }
}
