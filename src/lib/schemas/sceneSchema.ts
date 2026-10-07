import { z } from 'zod'

const vec3 = z.tuple([z.number(), z.number(), z.number()])

export const sceneSchema = z.object({
  subject: z.object({
    position: vec3,
    rotation: vec3,
    bodyYaw: z.number(),
    headYaw: z.number(),
    headPitch: z.number(),
    gaze: z.enum(['camera', 'original']),
  }),
  shotCamera: z.object({
    position: vec3,
    target: vec3,
    focalLength: z.number().min(18).max(200),
    roll: z.number(),
    aim: z.enum(['face', 'chest', 'torso', 'custom']),
  }),
  lights: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string(),
        type: z.enum(['spot', 'point', 'directional']),
        role: z.enum(['key', 'fill', 'rim', 'custom']),
        enabled: z.boolean(),
        position: vec3,
        rotation: vec3,
        target: vec3,
        intensity: z.number().min(0).max(100),
        color: z.string(),
        temperature: z.number(),
        softness: z.number().min(0).max(1),
        angle: z.number(),
      }),
    )
    .max(3),
  framing: z.object({
    preset: z.enum([
      'extreme-close-up',
      'face-close-up',
      'head-shoulders',
      'chest-up',
      'torso-up',
      'waist-up',
      'three-quarter',
      'full-body',
      'custom',
    ]),
    aspectRatio: z.enum(['1:1', '4:5', '3:2', '16:9', '9:16']),
    compositionX: z.number(),
    compositionY: z.number(),
    headroom: z.number(),
  }),
  background: z.object({
    mode: z.enum([
      'preserve',
      'plain-studio',
      'dark-studio',
      'light-studio',
      'neutral-gray',
      'black',
      'white',
      'custom-color',
      'soft-gradient',
      'custom-description',
    ]),
    color: z.string(),
    description: z.string(),
    gradientTop: z.string(),
    gradientBottom: z.string(),
  }),
  expression: z.enum([
    'original',
    'neutral',
    'slight-smile',
    'smile',
    'serious',
    'confident',
    'determined',
    'calm',
    'thoughtful',
    'surprised',
    'sad',
    'angry',
    'custom',
  ]),
  customExpression: z.string(),
  mood: z.enum([
    'natural',
    'professional',
    'editorial',
    'cinematic',
    'powerful',
    'dramatic',
    'elegant',
    'friendly',
    'casual',
    'playful',
    'mysterious',
  ]),
  guides: z.object({
    thirds: z.boolean(),
    cross: z.boolean(),
    safe: z.boolean(),
    headroom: z.boolean(),
  }),
  selection: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('none') }),
    z.object({ kind: z.literal('subject') }),
    z.object({ kind: z.literal('camera') }),
    z.object({ kind: z.literal('target') }),
    z.object({ kind: z.literal('light'), id: z.string() }),
  ]),
  transformMode: z.enum(['translate', 'rotate']),
})

export type ParsedScene = z.infer<typeof sceneSchema>

export function parseScene(input: unknown) {
  return sceneSchema.parse(input)
}
