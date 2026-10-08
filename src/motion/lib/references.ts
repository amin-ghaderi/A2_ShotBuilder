import {
  APPEARANCE_PICTURE_ROLES,
  REF2VA_LIMITS,
  STANDALONE_PICTURE_ROLES,
  type MotionAssetKind,
  type MotionObject,
  type MotionProject,
  type MotionReference,
  type MotionReferenceRole,
  type MotionShot,
  type RetentionMarker,
  type AudioRetentionMarker,
  type ShotReferenceBinding,
} from '@/motion/types'

export type ResolvedTag = {
  reference: MotionReference
  kind: MotionAssetKind
  index: number
  tag: string
  binding?: ShotReferenceBinding
}

export type ManifestEntry = {
  assetId: string
  filename: string
  exportFilename: string
  mime: string
  kind: MotionAssetKind
  role: MotionReferenceRole
  comfyTag: string
  slot: string
  audioFamily: 'none' | 'ref_audios' | 'ref_video_audios'
  loaderClass: 'LoadImage' | 'LoadVideo' | 'LoadAudio'
  pairedVideoSlot?: string
  trimStart: number
  trimEnd: number
  dataUrl: string
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

export function isStandalonePictureRole(role: MotionReferenceRole) {
  return STANDALONE_PICTURE_ROLES.includes(role)
}

export function isAppearancePictureRole(role: MotionReferenceRole) {
  return APPEARANCE_PICTURE_ROLES.includes(role)
}

export function clipLength(reference: MotionReference) {
  if (reference.kind === 'image') return 0
  const end = reference.trimEnd || reference.duration || 0
  const start = reference.trimStart || 0
  return Math.max(0, end - start)
}

function extensionOf(filename: string, mime: string, kind: MotionAssetKind) {
  const fromName = /\.([a-zA-Z0-9]+)$/.exec(filename)?.[1]
  if (fromName) return fromName.toLowerCase()
  if (mime.includes('png')) return 'png'
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg'
  if (mime.includes('webp')) return 'webp'
  if (mime.includes('mp4')) return 'mp4'
  if (mime.includes('webm')) return 'webm'
  if (mime.includes('wav')) return 'wav'
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3'
  if (kind === 'image') return 'png'
  if (kind === 'video') return 'mp4'
  return 'wav'
}

export function exportFilenameFor(kind: MotionAssetKind, index: number, filename: string, mime: string) {
  const ext = extensionOf(filename, mime, kind)
  const stem = filename.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40)
  const prefix = kind === 'image' ? 'picture' : kind === 'video' ? 'video' : 'audio'
  return `a2-${prefix}-${index}${stem ? `-${stem}` : ''}.${ext}`
}

/** MiniMaxH3ReferenceToVideo numbers each modality by connection order. */
export function resolveShotTags(project: MotionProject, shot: MotionShot): ResolvedTag[] {
  const bound = shot.bindings
    .map((binding) => {
      const reference = project.references.find((item) => item.id === binding.referenceId)
      return reference ? { reference, binding } : null
    })
    .filter((item): item is { reference: MotionReference; binding: ShotReferenceBinding } => Boolean(item))

  const counters = { image: 0, video: 0, audio: 0 }
  return bound.map(({ reference, binding }) => {
    counters[reference.kind] += 1
    const index = counters[reference.kind]
    const tag =
      reference.kind === 'image' ? pictureTag(index) : reference.kind === 'video' ? videoTag(index) : audioTag(index)
    return { reference, kind: reference.kind, index, tag, binding }
  })
}

export function objectsForReference(shot: MotionShot, referenceId: string, binding?: ShotReferenceBinding) {
  return shot.objects.filter(
    (object) =>
      object.referenceIds.includes(referenceId) ||
      binding?.objectId === object.id ||
      (binding?.subjectId && object.subjectId === binding.subjectId),
  )
}

export function retentionFor(tag: ResolvedTag, fallback: RetentionMarker | AudioRetentionMarker) {
  return tag.binding?.retention ?? fallback
}

export function validateReferenceLimits(project: MotionProject, shot: MotionShot) {
  const tags = resolveShotTags(project, shot)
  const images = tags.filter((item) => item.kind === 'image')
  const videos = tags.filter((item) => item.kind === 'video')
  const audios = tags.filter((item) => item.kind === 'audio')
  const problems: string[] = []
  if (images.length > REF2VA_LIMITS.maxImages) problems.push(`Ref2VA accepts at most ${REF2VA_LIMITS.maxImages} picture references.`)
  if (videos.length > REF2VA_LIMITS.maxVideos) problems.push(`Ref2VA accepts at most ${REF2VA_LIMITS.maxVideos} video references.`)
  if (audios.length > REF2VA_LIMITS.maxAudios) problems.push(`Ref2VA accepts at most ${REF2VA_LIMITS.maxAudios} standalone audio references.`)
  const mixed = images.length + videos.length + audios.length
  if (mixed > REF2VA_LIMITS.maxMixedFiles) {
    problems.push(`Ref2VA accepts at most ${REF2VA_LIMITS.maxMixedFiles} mixed reference files.`)
  }
  if (audios.length > 0 && images.length + videos.length === 0) {
    problems.push('Standalone audio cannot be the sole Ref2VA input; add an image or video reference.')
  }
  if (shot.duration < REF2VA_LIMITS.minDuration || shot.duration > REF2VA_LIMITS.maxDuration) {
    problems.push(`Single-shot Ref2VA duration must stay between ${REF2VA_LIMITS.minDuration}s and ${REF2VA_LIMITS.maxDuration}s.`)
  }
  let videoTotal = 0
  videos.forEach((item) => {
    const length = clipLength(item.reference) || item.reference.duration || 0
    if (length > 0 && (length < REF2VA_LIMITS.minClipDuration || length > REF2VA_LIMITS.maxClipDuration)) {
      problems.push(`${item.tag} clip length must stay between ${REF2VA_LIMITS.minClipDuration}s and ${REF2VA_LIMITS.maxClipDuration}s.`)
    }
    videoTotal += length || 0
  })
  if (videoTotal > REF2VA_LIMITS.maxClipDuration) {
    problems.push(`Combined reference-video duration must not exceed ${REF2VA_LIMITS.maxClipDuration}s.`)
  }
  let audioTotal = 0
  audios.forEach((item) => {
    const length = clipLength(item.reference) || item.reference.duration || 0
    if (length > 0 && (length < REF2VA_LIMITS.minClipDuration || length > REF2VA_LIMITS.maxClipDuration)) {
      problems.push(`${item.tag} clip length must stay between ${REF2VA_LIMITS.minClipDuration}s and ${REF2VA_LIMITS.maxClipDuration}s.`)
    }
    audioTotal += length || 0
  })
  if (audioTotal > REF2VA_LIMITS.maxClipDuration) {
    problems.push(`Combined standalone-audio duration must not exceed ${REF2VA_LIMITS.maxClipDuration}s.`)
  }
  tags.forEach((item) => {
    if (!item.reference.dataUrl) problems.push(`${item.tag} (${item.reference.filename}) has no packed media data. Re-upload the file.`)
  })
  return { images: images.length, videos: videos.length, audios: audios.length, mixed, problems, ok: problems.length === 0 }
}

export function manifestForShot(project: MotionProject, shot: MotionShot): ManifestEntry[] {
  const tags = resolveShotTags(project, shot)
  const used = new Set<string>()
  const entries: ManifestEntry[] = []
  tags.forEach((item) => {
    let name = exportFilenameFor(item.kind, item.index, item.reference.filename, item.reference.mime)
    while (used.has(name)) name = name.replace(/(\.\w+)$/, `-${item.reference.id.slice(-4)}$1`)
    used.add(name)
    if (item.kind === 'image') {
      entries.push({
        assetId: item.reference.id,
        filename: item.reference.filename,
        exportFilename: name,
        mime: item.reference.mime,
        kind: 'image',
        role: item.reference.role,
        comfyTag: item.tag,
        slot: `ref_images.ref_image_${item.index - 1}`,
        audioFamily: 'none',
        loaderClass: 'LoadImage',
        trimStart: item.reference.trimStart,
        trimEnd: item.reference.trimEnd,
        dataUrl: item.reference.dataUrl,
      })
      return
    }
    if (item.kind === 'video') {
      entries.push({
        assetId: item.reference.id,
        filename: item.reference.filename,
        exportFilename: name,
        mime: item.reference.mime,
        kind: 'video',
        role: item.reference.role,
        comfyTag: item.tag,
        slot: `ref_videos.ref_video_${item.index - 1}`,
        audioFamily: 'ref_video_audios',
        loaderClass: 'LoadVideo',
        pairedVideoSlot: `ref_video_audios.ref_video_audio_${item.index - 1}`,
        trimStart: item.reference.trimStart,
        trimEnd: item.reference.trimEnd,
        dataUrl: item.reference.dataUrl,
      })
      return
    }
    entries.push({
      assetId: item.reference.id,
      filename: item.reference.filename,
      exportFilename: name,
      mime: item.reference.mime,
      kind: 'audio',
      role: item.reference.role,
      comfyTag: item.tag,
      slot: `ref_audios.ref_audio_${item.index - 1}`,
      audioFamily: 'ref_audios',
      loaderClass: 'LoadAudio',
      trimStart: item.reference.trimStart,
      trimEnd: item.reference.trimEnd,
      dataUrl: item.reference.dataUrl,
    })
  })
  return entries
}

export type PromptSubject = {
  n: number
  tag: string
  kind: MotionObject['kind'] | 'environment' | 'custom'
  object?: MotionObject
  pictureTags: string[]
  description: string
  retention: RetentionMarker | AudioRetentionMarker
}

export function collectPromptSubjects(project: MotionProject, shot: MotionShot, tags: ResolvedTag[]): PromptSubject[] {
  const imageTags = tags.filter((item) => item.kind === 'image')
  const claimed = new Set<string>()
  const subjects: PromptSubject[] = []

  const takePictures = (predicate: (tag: ResolvedTag) => boolean) => {
    const matched = imageTags.filter((tag) => !claimed.has(tag.reference.id) && predicate(tag))
    matched.forEach((tag) => claimed.add(tag.reference.id))
    return matched
  }

  shot.objects.forEach((object) => {
    const pictures = takePictures((tag) => {
      if (isStandalonePictureRole(tag.reference.role)) return false
      const attached = objectsForReference(shot, tag.reference.id, tag.binding)
      if (attached.some((item) => item.id === object.id)) return true
      if (tag.binding?.subjectId && (object.subjectId === tag.binding.subjectId || project.subjects.some((subject) => subject.id === tag.binding?.subjectId && (subject.kind === object.kind || (object.kind === 'person' && subject.kind === 'person'))))) {
        return attached.length === 0 || attached.some((item) => item.id === object.id)
      }
      return false
    })
    const registry = project.subjects.find((subject) => subject.id === object.subjectId || (object.kind === 'person' && subject.kind === 'person' && pictures.length > 0))
    const noun =
      object.kind === 'person'
        ? 'the person'
        : object.kind === 'car'
          ? 'the vehicle'
          : object.kind === 'tree'
            ? 'the tree'
            : object.kind === 'table'
              ? 'the table'
              : `the ${object.kind}`
    const desc = (registry?.description || object.name || noun).trim()
    const n = subjects.length + 1
    const fallback: RetentionMarker = pictures[0] ? (retentionFor(pictures[0], 'fully_preserved') as RetentionMarker) : 'fully_preserved'
    subjects.push({
      n,
      tag: subjectTag(n),
      kind: object.kind,
      object,
      pictureTags: pictures.map((item) => item.tag),
      description: desc,
      retention: fallback,
    })
  })

  const personSubject = subjects.find((item) => item.kind === 'person' && item.pictureTags.length === 0)
  if (personSubject) {
    takePictures((tag) => tag.reference.role === 'identity' || tag.reference.role === 'appearance').forEach((tag) => {
      personSubject.pictureTags.push(tag.tag)
      personSubject.retention = retentionFor(tag, 'fully_preserved') as RetentionMarker
    })
  }

  takePictures((tag) => tag.reference.role === 'environment').forEach((tag) => {
    const n = subjects.length + 1
    subjects.push({
      n,
      tag: subjectTag(n),
      kind: 'environment',
      pictureTags: [tag.tag],
      description: 'the environment',
      retention: retentionFor(tag, 'fully_preserved') as RetentionMarker,
    })
  })

  takePictures((tag) => isAppearancePictureRole(tag.reference.role) && tag.reference.role !== 'environment').forEach((tag) => {
    const n = subjects.length + 1
    subjects.push({
      n,
      tag: subjectTag(n),
      kind: 'custom',
      pictureTags: [tag.tag],
      description: 'the referenced figure',
      retention: retentionFor(tag, 'fully_preserved') as RetentionMarker,
    })
  })

  return subjects
}

export function promptLabels(text: string) {
  const gather = (prefix: 'Subject' | 'Picture' | 'Video' | 'Audio') => {
    const found = new Set<string>()
    const pattern = new RegExp(`<${prefix} \\d+>`, 'g')
    for (const match of text.matchAll(pattern)) found.add(match[0])
    return [...found]
  }
  return {
    subjects: gather('Subject'),
    pictures: gather('Picture'),
    videos: gather('Video'),
    audios: gather('Audio'),
  }
}
