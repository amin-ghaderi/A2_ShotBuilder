import type { MotionProject } from '@/motion/types'

export function snapshotProject(state: MotionProject): MotionProject {
  return {
    id: state.id,
    name: state.name,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt,
    shots: state.shots.map((shot) => ({ ...shot, playing: false })),
    activeShotId: state.activeShotId,
    references: state.references,
    subjects: state.subjects,
    workflow: state.workflow,
    selection: state.selection,
    transformMode: state.transformMode,
  }
}
