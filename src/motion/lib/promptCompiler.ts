import { cameraSpanSentences, describeCameraSegment } from '@/motion/lib/cameraLanguage'
import { formatTimecode } from '@/motion/lib/interpolation'
import { resolveShotTags, subjectTag, type ResolvedTag } from '@/motion/lib/references'
import type { MotionProject, MotionShot } from '@/motion/types'

function taskPrefix(tags: ResolvedTag[]) {
  const types: string[] = []
  const hasEdit = tags.some((item) => item.kind === 'video' && (item.reference.role === 'edit-source' || item.reference.role === 'shot'))
  const hasKeyframe = tags.some((item) => item.kind === 'image' && (item.reference.role === 'shot' || item.reference.role === 'camera'))
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

function subjectLines(project: MotionProject, shot: MotionShot, tags: ResolvedTag[]) {
  const lines: string[] = []

  project.subjects.forEach((subject) => {
    const refs = tags.filter(
      (tag) =>
        subject.referenceIds.includes(tag.reference.id) ||
        shot.bindings.some((binding) => binding.subjectId === subject.id && binding.referenceId === tag.reference.id),
    )
    const attached = shot.objects.some((object) => object.subjectId === subject.id || (object.kind === 'person' && subject.kind === 'person'))
    if (refs.length === 0 && !attached) return
    const n = lines.length + 1
    const sources = refs.map((item) => item.tag).join(' and ')
    const desc = subject.description.trim() || subject.name
    if (sources) lines.push(`${subjectTag(n)} is ${desc} in ${sources}.`)
    else lines.push(`${subjectTag(n)} is ${desc} constructed in the 3D shot guide.`)
  })

  tags.forEach((tag) => {
    if (tag.kind === 'image' && (tag.reference.role === 'shot' || tag.reference.role === 'camera')) {
      lines.push(`${tag.tag} is a composition/keyframe anchor from ${tag.reference.filename}.`)
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
      lines.push(`${tag.tag} is ${role} (${tag.reference.filename}).`)
    }
    if (tag.kind === 'audio') {
      const role = tag.reference.role === 'voice' ? 'a voice-timbre reference' : 'an audio reference'
      lines.push(`${tag.tag} is ${role} (${tag.reference.filename}).`)
    }
    if (tag.kind === 'image' && tag.reference.role === 'environment') {
      const n = lines.filter((line) => line.startsWith('<Subject')).length + 1
      lines.push(`${subjectTag(n)} is the environment shown in ${tag.tag}.`)
    }
  })

  if (lines.length === 0) {
    lines.push(`${subjectTag(1)} is the person standing in the 3D shot guide, facing the scene.`)
  }
  return lines
}

function retentionLines(tags: ResolvedTag[], subjects: string[]) {
  const lines: string[] = []
  subjects.forEach((line) => {
    const match = /^(<Subject \d+>)/.exec(line)
    if (!match) return
    lines.push(`${match[1]} (appears in [Shot 1]): fully_preserved - keep the defined appearance unless the shot notes say otherwise.`)
  })
  tags.forEach((tag) => {
    if (tag.kind === 'audio') {
      const marker = tag.reference.role === 'audio' ? 'fully_copy' : 'reference'
      lines.push(`${tag.tag}: ${marker} - ${marker === 'fully_copy' ? 'reuse the audible signal where the shot specifies' : 'reference timbre, rhythm, or texture without copying unprovided dialogue'}.`)
      return
    }
    if (tag.kind === 'video') {
      const marker = tag.reference.role === 'edit-source' ? 'partially_preserved' : 'weak_reference'
      lines.push(`${tag.tag} (cut and pacing structure): ${marker} - follow the stated ${tag.reference.role} role only.`)
      return
    }
    if (tag.reference.role === 'shot' || tag.reference.role === 'camera') {
      lines.push(`${tag.tag} ([Shot 1] composition): fully_preserved - keep viewpoint and placement from this still.`)
    }
  })
  return lines
}

export function compileRef2VAPrompt(project: MotionProject, shot: MotionShot) {
  const tags = resolveShotTags(project, shot)
  const subjects = subjectLines(project, shot, tags)
  const prefix = taskPrefix(tags)
  const named = subjects.map((line) => line.split(' is ')[0]).filter(Boolean)
  const video = tags.find((item) => item.kind === 'video')
  const summaryCore =
    video && (video.reference.role === 'edit-source' || video.reference.role === 'shot')
      ? `The target video is an edited version of ${video.tag}.`
      : `The target video is a ${shot.duration.toFixed(1)}-second ${shot.aspectRatio} shot of ${named[0] ?? subjectTag(1)}.`
  const summary = `${prefix} ${summaryCore} ${tags.map((item) => item.tag).join(', ') || 'No bound reference assets are present, so the 3D camera path is the motion specification.'}`

  const camera = cameraSpanSentences(shot)
  const objects = shot.objects.map((object) => `${object.name} (${object.kind}) stays at the evaluated 3D placement unless keyframed`).join('; ')
  const action = shot.notes.action.trim()
  const style = shot.notes.style.trim() || 'The target video uses a photoreal live-action look.'

  const detailed = [
    style,
    `[Shot 1] A single continuous ${shot.duration.toFixed(1)}-second take. ${objects || 'The scene holds the current 3D layout.'}. ${describeCameraSegment(shot, 0, shot.duration)}. ${camera.join(' ')} ${action} Do not invent unprovided dialogue, extra characters, or events.`
      .replace(/\s+/g, ' ')
      .trim(),
  ]

  if (shot.sourceMode === 'import-video' && shot.importedVideo) {
    const tag = tags.find((item) => item.reference.id === shot.importedVideo?.referenceId)
    if (tag) {
      detailed.push(
        `The imported clip ${tag.tag} is a ${shot.importedVideo.role} reference, trimmed from ${formatTimecode(shot.importedVideo.trimStart)} to ${formatTimecode(shot.importedVideo.trimEnd)}. The 3D scene is not reconstructed from this video.`,
      )
    }
  }

  return [
    `subject_definitions:\n${subjects.join('\n')}`,
    `summary:\n${summary}`,
    `retention_analysis:\n${retentionLines(tags, subjects).join('\n')}`,
    `detailed_description:\n${detailed.join('\n')}`,
    `overall_soundscape:\n${shot.notes.soundscape.trim() || 'N/A'}`,
    `non_diegetic_music:\n${shot.notes.music.trim() || 'N/A'}`,
  ].join('\n\n')
}

export function compileShotCode(project: MotionProject, shot: MotionShot) {
  const tags = resolveShotTags(project, shot)
    .map((item) => item.tag)
    .join(',')
  return `SHOT:${shot.name} | T:${shot.duration.toFixed(1)}s | AR:${shot.aspectRatio} | KEYS:${shot.cameraKeys.length} | ${tags || 'NO-REF'}`
}
