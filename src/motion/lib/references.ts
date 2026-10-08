import {
  APPEARANCE_PICTURE_ROLES,
  REF2VA_LIMITS,
  STANDALONE_PICTURE_ROLES,
  defaultRetentionFor,
  type MotionAssetKind,
  type MotionObject,
  type MotionProject,
  type MotionReference,
  type MotionReferenceRole,
  type MotionShot,
  type ReferenceModality,
  type ReferenceSlot,
  type RetentionMarker,
  type AudioRetentionMarker,
  type ShotReferenceBinding,
} from '@/motion/types'

export type ResolvedTag = {
  slot: ReferenceSlot
  reference: MotionReference
  kind: MotionAssetKind
  index: number
  tag: string
  binding?: ShotReferenceBinding
}

export type ManifestEntry = {
  slotId: string
  assetId: string
  ownerType: 'object' | 'shot'
  ownerId: string
  ownerName: string
  filename: string
  exportFilename: string
  mime: string
  kind: MotionAssetKind
  modality: ReferenceModality
  role: MotionReferenceRole
  comfyTag: string
  slot: string
  audioFamily: 'none' | 'ref_audios' | 'ref_video_audios'
  loaderClass: 'LoadImage' | 'LoadVideo' | 'LoadAudio'
  loaderTitle: string
  loaderNodeId?: number
  pairedVideoSlot?: string
  mediaAssigned: boolean
  durationVerified: boolean
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

export function promptKind(modality: ReferenceModality): MotionAssetKind {
  if (modality === 'audio') return 'audio'
  if (modality === 'image') return 'image'
  return 'video'
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
  if (!filename && !mime) return ''
  const ext = extensionOf(filename, mime, kind)
  const stem = filename.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40)
  const prefix = kind === 'image' ? 'picture' : kind === 'video' ? 'video' : 'audio'
  return `a2-${prefix}-${index}${stem ? `-${stem}` : ''}.${ext}`
}

function slotAsReference(slot: ReferenceSlot, media?: MotionReference): MotionReference {
  return {
    id: slot.id,
    kind: promptKind(slot.modality),
    name: media?.name || slot.id,
    filename: media?.filename || '',
    mime: media?.mime || '',
    dataUrl: media?.dataUrl || '',
    role: slot.role,
    description: slot.description || media?.description || '',
    duration: media?.duration,
    trimStart: media?.trimStart ?? 0,
    trimEnd: media?.trimEnd ?? 0,
  }
}

export function migrateBindingsToSlots(project: MotionProject, shot: MotionShot): ReferenceSlot[] {
  return shot.bindings
    .map((binding, index) => {
      const media = project.references.find((item) => item.id === binding.referenceId)
      if (!media) return null
      const objectId = binding.objectId
      const slot: ReferenceSlot = {
        id: binding.referenceId,
        ownerType: objectId ? 'object' : 'shot',
        ownerId: objectId ?? shot.id,
        modality: media.kind === 'video' ? 'video' : media.kind,
        role: media.role,
        retention: binding.retention || defaultRetentionFor(media.role),
        order: index,
        description: media.description,
        useSynchronizedAudio: false,
        defineAudioLabel: false,
      }
      return slot
    })
    .filter((item): item is ReferenceSlot => Boolean(item))
}

export function shotSlots(project: MotionProject, shot: MotionShot): ReferenceSlot[] {
  const source = shot.referenceSlots?.length ? shot.referenceSlots : migrateBindingsToSlots(project, shot)
  return [...source].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
}

export function ownerNameForSlot(shot: MotionShot, slot: ReferenceSlot) {
  if (slot.ownerType === 'object') {
    return shot.objects.find((item) => item.id === slot.ownerId)?.name ?? 'Object'
  }
  if (slot.role === 'camera') return 'Camera motion'
  if (slot.role === 'environment') return 'Environment'
  if (slot.role === 'edit-source' || slot.role === 'continuation') return 'Source video'
  return shot.name
}

export function loaderTitleFor(shot: MotionShot, slot: ReferenceSlot, tag: string) {
  const owner = ownerNameForSlot(shot, slot)
  const label = tag.replace(/[<>]/g, '')
  return `${shot.name} | ${owner} | ${label} | ${slot.role}`.toUpperCase()
}

/** MiniMaxH3ReferenceToVideo numbers each modality by per-shot slot order. */
export function resolveShotTags(project: MotionProject, shot: MotionShot): ResolvedTag[] {
  const slots = shotSlots(project, shot)
  const counters = { image: 0, video: 0, audio: 0 }
  const tags: ResolvedTag[] = []
  slots.forEach((slot) => {
    const media = project.references.find((item) => item.id === slot.id)
    const kind = promptKind(slot.modality)
    counters[kind] += 1
    const index = counters[kind]
    const tag = kind === 'image' ? pictureTag(index) : kind === 'video' ? videoTag(index) : audioTag(index)
    const binding = shot.bindings.find((item) => item.referenceId === slot.id)
    tags.push({
      slot,
      reference: slotAsReference(slot, media),
      kind,
      index,
      tag,
      binding: binding ?? {
        referenceId: slot.id,
        objectId: slot.ownerType === 'object' ? slot.ownerId : undefined,
        retention: slot.retention,
      },
    })
    if (slot.defineAudioLabel && kind === 'video') {
      counters.audio += 1
      const audioIndex = counters.audio
      tags.push({
        slot: { ...slot, modality: 'audio', defineAudioLabel: true },
        reference: {
          ...slotAsReference(slot, media),
          kind: 'audio',
          role: 'audio',
        },
        kind: 'audio',
        index: audioIndex,
        tag: audioTag(audioIndex),
        binding: { referenceId: slot.id, retention: slot.retention },
      })
    }
  })
  return tags
}

export function objectsForReference(shot: MotionShot, referenceId: string, binding?: ShotReferenceBinding) {
  const owned = (shot.referenceSlots ?? []).find((slot) => slot.id === referenceId)
  if (owned?.ownerType === 'object') return shot.objects.filter((object) => object.id === owned.ownerId)
  return shot.objects.filter(
    (object) =>
      object.referenceIds.includes(referenceId) ||
      binding?.objectId === object.id ||
      (binding?.subjectId && object.subjectId === binding.subjectId),
  )
}

export function retentionFor(tag: ResolvedTag, fallback: RetentionMarker | AudioRetentionMarker) {
  return tag.slot.retention || tag.binding?.retention || fallback
}

export function validateReferenceLimits(project: MotionProject, shot: MotionShot) {
  const tags = resolveShotTags(project, shot)
  const images = tags.filter((item) => item.kind === 'image')
  const videos = tags.filter((item) => item.kind === 'video')
  const audios = tags.filter((item) => item.kind === 'audio' && item.slot.modality === 'audio')
  const problems: string[] = []
  const warnings: string[] = []
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
  let verifiedVideo = 0
  videos.forEach((item) => {
    const length = clipLength(item.reference) || item.reference.duration || 0
    if (length > 0) {
      verifiedVideo += 1
      if (length < REF2VA_LIMITS.minClipDuration || length > REF2VA_LIMITS.maxClipDuration) {
        problems.push(`${item.tag} clip length must stay between ${REF2VA_LIMITS.minClipDuration}s and ${REF2VA_LIMITS.maxClipDuration}s.`)
      }
      videoTotal += length
    } else {
      warnings.push(`${item.tag} file duration is unverified until the media is selected in ComfyUI (required ${REF2VA_LIMITS.minClipDuration}–${REF2VA_LIMITS.maxClipDuration}s, combined videos ≤ ${REF2VA_LIMITS.maxClipDuration}s).`)
    }
  })
  if (verifiedVideo > 0 && videoTotal > REF2VA_LIMITS.maxClipDuration) {
    problems.push(`Combined reference-video duration must not exceed ${REF2VA_LIMITS.maxClipDuration}s.`)
  }
  let audioTotal = 0
  audios.forEach((item) => {
    const length = clipLength(item.reference) || item.reference.duration || 0
    if (length > 0) {
      if (length < REF2VA_LIMITS.minClipDuration || length > REF2VA_LIMITS.maxClipDuration) {
        problems.push(`${item.tag} clip length must stay between ${REF2VA_LIMITS.minClipDuration}s and ${REF2VA_LIMITS.maxClipDuration}s.`)
      }
      audioTotal += length
    } else {
      warnings.push(`${item.tag} file duration is unverified until the media is selected in ComfyUI (required ${REF2VA_LIMITS.minClipDuration}–${REF2VA_LIMITS.maxClipDuration}s, combined audio ≤ ${REF2VA_LIMITS.maxClipDuration}s).`)
    }
  })
  if (audioTotal > REF2VA_LIMITS.maxClipDuration) {
    problems.push(`Combined standalone-audio duration must not exceed ${REF2VA_LIMITS.maxClipDuration}s.`)
  }
  return {
    images: images.length,
    videos: videos.length,
    audios: audios.length,
    mixed,
    problems,
    warnings,
    ok: problems.length === 0,
  }
}

export function manifestForShot(project: MotionProject, shot: MotionShot): ManifestEntry[] {
  const tags = resolveShotTags(project, shot).filter((item) => item.slot.modality !== 'audio' || item.kind === 'audio')
  const used = new Set<string>()
  const entries: ManifestEntry[] = []
  tags.forEach((item) => {
    if (item.kind === 'audio' && item.slot.modality !== 'audio') return
    const assigned = Boolean(item.reference.dataUrl || item.reference.filename)
    let name = assigned ? exportFilenameFor(item.kind, item.index, item.reference.filename, item.reference.mime) : ''
    if (name) {
      while (used.has(name)) name = name.replace(/(\.\w+)$/, `-${item.slot.id.slice(-4)}$1`)
      used.add(name)
    }
    const title = loaderTitleFor(shot, item.slot, item.tag)
    const owner = ownerNameForSlot(shot, item.slot)
    if (item.kind === 'image') {
      entries.push({
        slotId: item.slot.id,
        assetId: item.slot.id,
        ownerType: item.slot.ownerType,
        ownerId: item.slot.ownerId,
        ownerName: owner,
        filename: item.reference.filename,
        exportFilename: name,
        mime: item.reference.mime,
        kind: 'image',
        modality: 'image',
        role: item.slot.role,
        comfyTag: item.tag,
        slot: `ref_images.ref_image_${item.index - 1}`,
        audioFamily: 'none',
        loaderClass: 'LoadImage',
        loaderTitle: title,
        mediaAssigned: assigned,
        durationVerified: true,
        trimStart: item.reference.trimStart,
        trimEnd: item.reference.trimEnd,
        dataUrl: item.reference.dataUrl,
      })
      return
    }
    if (item.kind === 'video') {
      const synced = item.slot.modality === 'video_with_audio' || item.slot.useSynchronizedAudio
      entries.push({
        slotId: item.slot.id,
        assetId: item.slot.id,
        ownerType: item.slot.ownerType,
        ownerId: item.slot.ownerId,
        ownerName: owner,
        filename: item.reference.filename,
        exportFilename: name,
        mime: item.reference.mime,
        kind: 'video',
        modality: item.slot.modality,
        role: item.slot.role,
        comfyTag: item.tag,
        slot: `ref_videos.ref_video_${item.index - 1}`,
        audioFamily: synced ? 'ref_video_audios' : 'none',
        loaderClass: 'LoadVideo',
        loaderTitle: title,
        pairedVideoSlot: synced ? `ref_video_audios.ref_video_audio_${item.index - 1}` : undefined,
        mediaAssigned: assigned,
        durationVerified: Boolean(item.reference.duration || item.reference.trimEnd),
        trimStart: item.reference.trimStart,
        trimEnd: item.reference.trimEnd,
        dataUrl: item.reference.dataUrl,
      })
      return
    }
    entries.push({
      slotId: item.slot.id,
      assetId: item.slot.id,
      ownerType: item.slot.ownerType,
      ownerId: item.slot.ownerId,
      ownerName: owner,
      filename: item.reference.filename,
      exportFilename: name,
      mime: item.reference.mime,
      kind: 'audio',
      modality: 'audio',
      role: item.slot.role,
      comfyTag: item.tag,
      slot: `ref_audios.ref_audio_${item.index - 1}`,
      audioFamily: 'ref_audios',
      loaderClass: 'LoadAudio',
      loaderTitle: title,
      mediaAssigned: assigned,
      durationVerified: Boolean(item.reference.duration || item.reference.trimEnd),
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
    const matched = imageTags.filter((tag) => !claimed.has(tag.slot.id) && predicate(tag))
    matched.forEach((tag) => claimed.add(tag.slot.id))
    return matched
  }

  shot.objects.forEach((object) => {
    const pictures = takePictures((tag) => {
      if (isStandalonePictureRole(tag.slot.role)) return false
      if (tag.slot.ownerType === 'object') return tag.slot.ownerId === object.id
      const attached = objectsForReference(shot, tag.slot.id, tag.binding)
      return attached.some((item) => item.id === object.id)
    })
    const registry = project.subjects.find((subject) => subject.id === object.subjectId)
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

  takePictures((tag) => tag.slot.role === 'environment' && tag.slot.ownerType === 'shot').forEach((tag) => {
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

  takePictures((tag) => isAppearancePictureRole(tag.slot.role) && tag.slot.role !== 'environment' && tag.slot.ownerType === 'shot').forEach((tag) => {
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

export function slotsForOwner(shot: MotionShot, ownerType: 'object' | 'shot', ownerId: string) {
  return (shot.referenceSlots ?? []).filter((slot) => slot.ownerType === ownerType && slot.ownerId === ownerId).sort((a, b) => a.order - b.order)
}
