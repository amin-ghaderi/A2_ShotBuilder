import { kelvinToHex } from '@/lib/color'
import { uid } from '@/motion/lib/ids'
import type { MotionProject, MotionShot } from '@/motion/types'

export function createDefaultShot(name = 'Shot 1'): MotionShot {
  const person = uid('obj')
  const key = uid('light')
  const fill = uid('light')
  return {
    id: uid('shot'),
    name,
    sourceMode: 'build-3d',
    duration: 8,
    aspectRatio: '16:9',
    currentTime: 0,
    playing: false,
    trackTarget: true,
    objects: [
      {
        id: person,
        name: 'Person',
        kind: 'person',
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        referenceIds: [],
        keyframes: [],
      },
    ],
    lights: [
      {
        id: key,
        name: 'Key',
        type: 'spot',
        role: 'key',
        enabled: true,
        movable: false,
        position: [-1.6, 2.6, 2.2],
        target: [0, 1.4, 0],
        intensity: 74,
        color: kelvinToHex(4300),
        temperature: 4300,
        softness: 0.7,
        angle: 0.55,
        keyframes: [],
      },
      {
        id: fill,
        name: 'Fill',
        type: 'point',
        role: 'fill',
        enabled: true,
        movable: false,
        position: [1.8, 1.7, 2.1],
        target: [0, 1.4, 0],
        intensity: 28,
        color: kelvinToHex(5600),
        temperature: 5600,
        softness: 0.85,
        angle: 0.7,
        keyframes: [],
      },
    ],
    cameraKeys: [
      {
        time: 0,
        position: [0.15, 1.58, 3.55],
        target: [0, 1.42, 0],
        focalLength: 35,
        roll: 0,
        easing: 'smooth',
      },
      {
        time: 8,
        position: [1.35, 1.48, 2.85],
        target: [0, 1.38, 0],
        focalLength: 50,
        roll: 0,
        easing: 'smooth',
      },
    ],
    framing: { aspectRatio: '16:9' },
    bindings: [],
    notes: {
      style: 'The target video uses a photoreal live-action look with natural studio lighting.',
      action: '',
      soundscape: 'Quiet indoor room tone continues throughout the shot.',
      music: 'N/A',
    },
  }
}

export function createDefaultProject(): MotionProject {
  const shot = createDefaultShot()
  const now = new Date().toISOString()
  return {
    id: uid('project'),
    name: 'Untitled motion',
    createdAt: now,
    updatedAt: now,
    shots: [shot],
    activeShotId: shot.id,
    references: [],
    subjects: [
      {
        id: uid('sub'),
        name: 'Lead',
        kind: 'person',
        description: 'the person standing in the scene',
        referenceIds: [],
      },
    ],
    workflow: {
      source: 'official-ref2va',
      generationNodeType: 'MiniMaxH3ReferenceToVideo',
    },
    selection: { kind: 'camera' },
    transformMode: 'translate',
  }
}
