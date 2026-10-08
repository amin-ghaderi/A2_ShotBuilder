import { cameraSpanSentences, lightingSentence, spatialLayout } from '@/motion/lib/cameraLanguage'
import { formatTimecode } from '@/motion/lib/interpolation'
import {
  collectPromptSubjects,
  isStandalonePictureRole,
  promptLabels,
  resolveShotTags,
  retentionFor,
  type PromptSubject,
  type ResolvedTag,
} from '@/motion/lib/references'
import type { MotionProject, MotionShot } from '@/motion/types'

function taskPrefix(tags: ResolvedTag[]) {
  const types: string[] = []
  const hasEdit = tags.some((item) => item.kind === 'video' && (item.reference.role === 'edit-source' || item.reference.role === 'shot'))
  const hasKeyframe = tags.some((item) => item.kind === 'image' && isStandalonePictureRole(item.reference.role))
  const hasAudioCopy = tags.some((item) => item.kind === 'audio' && item.reference.role === 'audio')
  const hasAudioRef = tags.some((item) => item.kind === 'audio' && item.reference.role === 'voice')
  const hasGuidance = tags.length > 0
  if (hasEdit) types.push('video editing')
  if (hasKeyframe) types.push('keyframe completion')
  if (hasGuidance && !hasEdit) types.push('reference generation')
  if (hasAudioCopy) types.push('audio reuse')
  if (hasAudioRef) types.push('audio reference')
  if (types.length === 0) types.push('reference generation')
  return `[${[...new Set(types)].join(' + ')}]`
}

function subjectDefinitionLine(subject: PromptSubject) {
  const noun =
    subject.kind === 'person'
      ? 'the person'
      : subject.kind === 'car'
        ? 'the vehicle'
        : subject.kind === 'environment'
          ? 'the environment'
          : subject.description
  const pictures = subject.pictureTags.join(' and ')
  if (pictures) return `${subject.tag} is ${noun} shown in ${pictures}.`
  return `${subject.tag} is ${noun} constructed in the 3D shot guide.`
}

function extraDefinitionLines(tags: ResolvedTag[]) {
  const lines: string[] = []
  tags.forEach((tag) => {
    if (tag.kind === 'image' && isStandalonePictureRole(tag.reference.role)) {
      lines.push(`${tag.tag} is a composition/keyframe anchor for [Shot 1].`)
    }
    if (tag.kind === 'video') {
      const role =
        tag.reference.role === 'edit-source'
          ? 'the source video for the target video edit'
          : tag.reference.role === 'camera'
            ? 'a camera-trajectory reference'
            : tag.reference.role === 'motion'
              ? 'a motion and action reference'
              : 'a video reference'
      lines.push(`${tag.tag} is ${role}.`)
    }
    if (tag.kind === 'audio') {
      const role = tag.reference.role === 'voice' ? 'a voice-timbre reference' : 'a standalone audio reference'
      lines.push(`${tag.tag} is ${role}.`)
    }
  })
  return lines
}

function retentionLines(subjects: PromptSubject[], tags: ResolvedTag[]) {
  const lines = subjects.map(
    (subject) =>
      `${subject.tag} (appears in [Shot 1]): ${subject.retention} - retain the defined ${subject.kind === 'environment' ? 'environment' : 'identity'} from the cited references or the 3D layout.`,
  )
  tags.forEach((tag) => {
    if (tag.kind === 'image' && isStandalonePictureRole(tag.reference.role)) {
      lines.push(`${tag.tag} ([Shot 1] composition): ${retentionFor(tag, 'fully_preserved')} - keep viewpoint and placement from this still.`)
    }
    if (tag.kind === 'video') {
      const marker = tag.reference.role === 'edit-source' ? retentionFor(tag, 'partially_preserved') : retentionFor(tag, 'weak_reference')
      lines.push(`${tag.tag} (cut and pacing structure): ${marker} - follow the stated ${tag.reference.role} role only.`)
    }
    if (tag.kind === 'audio') {
      const marker = tag.reference.role === 'audio' ? retentionFor(tag, 'fully_copy') : retentionFor(tag, 'reference')
      lines.push(
        `${tag.tag}: ${marker} - ${String(marker).includes('copy') ? 'reuse the audible signal where the shot specifies' : 'reference timbre, rhythm, or texture without copying unprovided dialogue'}.`,
      )
    }
  })
  return lines
}

function firstUse(subjects: PromptSubject[], tags: ResolvedTag[]) {
  const bits: string[] = []
  subjects.forEach((subject) => {
    if (subject.pictureTags.length) bits.push(`${subject.tag} takes its appearance from ${subject.pictureTags.join(' and ')}`)
    else bits.push(`${subject.tag} is present from the 3D layout`)
  })
  tags
    .filter((tag) => tag.kind === 'image' && isStandalonePictureRole(tag.reference.role))
    .forEach((tag) => bits.push(`the shot's composition follows ${tag.tag}`))
  tags.filter((tag) => tag.kind === 'video').forEach((tag) => bits.push(`${tag.tag} supplies the stated ${tag.reference.role} guidance`))
  tags.filter((tag) => tag.kind === 'audio').forEach((tag) => bits.push(`${tag.tag} is the ${tag.reference.role} audio cue`))
  return bits.join('. ')
}

export function compileRef2VAPrompt(project: MotionProject, shot: MotionShot) {
  const tags = resolveShotTags(project, shot)
  const subjects = collectPromptSubjects(project, shot, tags)
  const prefix = taskPrefix(tags)
  const video = tags.find((item) => item.kind === 'video')
  const lead = subjects[0]?.tag
  const summaryCore =
    video && (video.reference.role === 'edit-source' || video.reference.role === 'shot')
      ? `The target video is an edited version of ${video.tag}.`
      : `The target video is a ${shot.duration.toFixed(1)}-second ${shot.aspectRatio} shot${lead ? ` of ${lead}` : ''}.`
  const summaryRefs = [
    ...subjects.map((item) => item.tag),
    ...tags.filter((tag) => tag.kind === 'image' && isStandalonePictureRole(tag.reference.role)).map((tag) => tag.tag),
    ...tags.filter((tag) => tag.kind === 'video' || tag.kind === 'audio').map((tag) => tag.tag),
  ]
  const summary = `${prefix} ${summaryCore} ${summaryRefs.join(', ') || 'No bound reference assets are present, so the 3D camera path is the motion specification.'}`

  const named = subjects.filter((item) => item.object).map((item) => ({ object: item.object!, tag: item.tag }))
  const layout = spatialLayout(shot, 0, named)
  const lights = lightingSentence(shot)
  const action = shot.notes.action.trim()
  const style = shot.notes.style.trim() || 'The target video uses a photoreal live-action look with natural studio lighting.'
  const camera = cameraSpanSentences(shot).join(' ')
  const uses = firstUse(subjects, tags)

  const detailed = [
    style,
    `[Shot 1] A continuous ${shot.duration.toFixed(1)}-second take opens on the 3D-guided layout. ${layout || 'The frame holds the current 3D arrangement.'}. ${lights}. ${uses}. ${camera} ${action} Do not invent unprovided dialogue, extra characters, or events.`
      .replace(/\s+/g, ' ')
      .trim(),
  ]

  if (shot.sourceMode === 'import-video' && shot.importedVideo) {
    const tag = tags.find((item) => item.reference.id === shot.importedVideo?.referenceId)
    if (tag) {
      detailed.push(
        `${tag.tag} is used only as a ${shot.importedVideo.role} reference, trimmed from ${formatTimecode(shot.importedVideo.trimStart)} to ${formatTimecode(shot.importedVideo.trimEnd)}. The 3D scene is not reconstructed from this video.`,
      )
    }
  }

  const soundscape =
    shot.notes.soundscape.trim() ||
    (tags.some((tag) => tag.kind === 'audio' && tag.reference.role === 'audio')
      ? `Environmental sound follows ${tags
          .filter((tag) => tag.kind === 'audio')
          .map((tag) => tag.tag)
          .join(' and ')}.`
      : 'N/A')
  const musicTags = tags.filter((tag) => tag.kind === 'audio' && tag.reference.role === 'audio').map((tag) => tag.tag)
  const music = shot.notes.music.trim() || (musicTags.length ? `${musicTags.join(' and ')} is defined as reusable audio; use it as audience-only score only if that matches its stated role.` : 'N/A')

  const definitions = [...subjects.map(subjectDefinitionLine), ...extraDefinitionLines(tags)]
  if (definitions.length === 0) {
    definitions.push('No bound reference subjects are defined; the 3D layout is the only composition guide.')
  }

  return [
    `subject_definitions:\n${definitions.join('\n')}`,
    `summary:\n${summary}`,
    `retention_analysis:\n${retentionLines(subjects, tags).join('\n')}`,
    `detailed_description:\n${detailed.join('\n')}`,
    `overall_soundscape:\n${soundscape}`,
    `non_diegetic_music:\n${music}`,
  ].join('\n\n')
}

export function compileShotCode(project: MotionProject, shot: MotionShot) {
  const tags = resolveShotTags(project, shot)
    .map((item) => item.tag)
    .join(',')
  return `SHOT:${shot.name} | T:${shot.duration.toFixed(1)}s | AR:${shot.aspectRatio} | KEYS:${shot.cameraKeys.length} | ${tags || 'NO-REF'}`
}

export function unresolvedPromptLabels(project: MotionProject, shot: MotionShot) {
  const text = compileRef2VAPrompt(project, shot)
  const tags = resolveShotTags(project, shot)
  const subjects = collectPromptSubjects(project, shot, tags)
  const used = promptLabels(text)
  const definedPictures = new Set([
    ...subjects.flatMap((item) => item.pictureTags),
    ...tags.filter((tag) => tag.kind === 'image' && isStandalonePictureRole(tag.reference.role)).map((tag) => tag.tag),
  ])
  const definedVideos = new Set(tags.filter((tag) => tag.kind === 'video').map((tag) => tag.tag))
  const definedAudios = new Set(tags.filter((tag) => tag.kind === 'audio').map((tag) => tag.tag))
  const definedSubjects = new Set(subjects.map((item) => item.tag))
  return {
    pictures: used.pictures.filter((tag) => !definedPictures.has(tag)),
    videos: used.videos.filter((tag) => !definedVideos.has(tag)),
    audios: used.audios.filter((tag) => !definedAudios.has(tag)),
    subjects: used.subjects.filter((tag) => !definedSubjects.has(tag)),
  }
}
