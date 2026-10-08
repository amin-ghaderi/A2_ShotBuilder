import { REF2VA_LIMITS, type MotionAssetKind, type MotionProject, type MotionReference, type MotionShot } from '@/motion/types'

export type ResolvedTag = {
  reference: MotionReference
  kind: MotionAssetKind
  index: number
  tag: string
}

export function pictureTag(n: number) {
  return `<Picture ${n}>`
}

export function videoTag(n: number) {
  return `<Video ${n}>`
}

export function audioTag(n: number) {
  return `<Audio ${n}>`
}

export function subjectTag(n: number) {
  return `<Subject ${n}>`
}

/** MiniMaxH3ReferenceToVideo numbers each modality by connection order. */
export function resolveShotTags(project: MotionProject, shot: MotionShot): ResolvedTag[] {
  const bound = shot.bindings
    .map((binding) => project.references.find((item) => item.id === binding.referenceId))
    .filter((item): item is MotionReference => Boolean(item))

  const counters = { image: 0, video: 0, audio: 0 }
  return bound.map((reference) => {
    counters[reference.kind] += 1
    const index = counters[reference.kind]
    const tag =
      reference.kind === 'image' ? pictureTag(index) : reference.kind === 'video' ? videoTag(index) : audioTag(index)
    return { reference, kind: reference.kind, index, tag }
  })
}

export function validateReferenceLimits(project: MotionProject, shot: MotionShot) {
  const tags = resolveShotTags(project, shot)
  const images = tags.filter((item) => item.kind === 'image').length
  const videos = tags.filter((item) => item.kind === 'video').length
  const audios = tags.filter((item) => item.kind === 'audio').length
  const problems: string[] = []
  if (images > REF2VA_LIMITS.maxImages) problems.push(`Ref2VA accepts at most ${REF2VA_LIMITS.maxImages} picture references.`)
  if (videos > REF2VA_LIMITS.maxVideos) problems.push(`Ref2VA accepts at most ${REF2VA_LIMITS.maxVideos} video references.`)
  if (audios > REF2VA_LIMITS.maxAudios) problems.push(`Ref2VA accepts at most ${REF2VA_LIMITS.maxAudios} standalone audio references.`)
  if (shot.duration < REF2VA_LIMITS.minDuration || shot.duration > REF2VA_LIMITS.maxDuration) {
    problems.push(`Single-shot Ref2VA duration must stay between ${REF2VA_LIMITS.minDuration}s and ${REF2VA_LIMITS.maxDuration}s.`)
  }
  return { images, videos, audios, problems, ok: problems.length === 0 }
}

export function manifestForShot(project: MotionProject, shot: MotionShot) {
  return resolveShotTags(project, shot).map((item) => ({
    assetId: item.reference.id,
    filename: item.reference.filename,
    mime: item.reference.mime,
    kind: item.kind,
    role: item.reference.role,
    comfyTag: item.tag,
    slot:
      item.kind === 'image'
        ? `ref_images.ref_image_${item.index - 1}`
        : item.kind === 'video'
          ? `ref_videos.ref_video_${item.index - 1}`
          : `ref_audios.ref_audio_${item.index - 1}`,
    trimStart: item.reference.trimStart,
    trimEnd: item.reference.trimEnd,
  }))
}
