import { describeCameraSegment } from '@/motion/lib/cameraLanguage'
import { planChunks } from '@/motion/lib/chunking'
import { createDefaultProject, createDefaultShot } from '@/motion/lib/defaultProject'
import { buildSingleShotPackage } from '@/motion/lib/exportPackage'
import { h3FrameLength, pythonModulo } from '@/motion/lib/interpolation'
import { snapshotProject } from '@/motion/lib/projectSnapshot'
import { compileRef2VAPrompt, unresolvedPromptLabels } from '@/motion/lib/promptCompiler'
import {
  collectPromptSubjects,
  manifestForShot,
  pictureTag,
  resolveShotTags,
  validateReferenceLimits,
} from '@/motion/lib/references'
import { parseMotionProject } from '@/motion/lib/schema'
import officialTemplate from '@/motion/templates/video_minimax_h3_r2v.json'
import {
  bindSingleShotWorkflow,
  connectedFilename,
  connectedOriginType,
  exampleImagesStillConnected,
  graphIntegrity,
  inspectWorkflow,
  VERIFIED_LOADER_TYPES,
  compileMasterWorkflow,
} from '@/motion/lib/workflow'
import { H3_FRAME_EXPRESSION, TEMPLATE_EXAMPLE_IMAGES, type MotionProject, type MotionReference, type MotionReferenceRole, type RetentionMarker } from '@/motion/types'
import { useMotionStore } from '@/store/motionStore'

export type CheckResult = { name: string; ok: boolean; detail?: string }

const SECTIONS = [
  'subject_definitions:',
  'summary:',
  'retention_analysis:',
  'detailed_description:',
  'overall_soundscape:',
  'non_diegetic_music:',
] as const

const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
const CLIP = 'data:video/mp4;base64,AAAA'
const TONE = 'data:audio/wav;base64,UklGRgAAAABXQVZFZm10IBAAAAABAAEA'

function check(name: string, ok: boolean, detail?: string): CheckResult {
  return { name, ok, detail: ok ? undefined : detail }
}

function project(): MotionProject {
  return createDefaultProject()
}

function addAsset(
  target: MotionProject,
  id: string,
  kind: MotionReference['kind'],
  filename: string,
  role: MotionReferenceRole,
  extra: Partial<MotionReference> = {},
) {
  target.references.push({
    id,
    kind,
    name: filename,
    filename,
    mime: kind === 'image' ? 'image/png' : kind === 'video' ? 'video/mp4' : 'audio/wav',
    dataUrl: kind === 'image' ? PIXEL : kind === 'video' ? CLIP : TONE,
    role,
    description: '',
    trimStart: 0,
    trimEnd: kind === 'image' ? 0 : 4,
    ...extra,
  })
}

function bind(
  target: MotionProject,
  referenceId: string,
  retention: RetentionMarker | 'weak_reference' | 'fully_copy' | 'reference' = 'fully_preserved',
  extra: { objectId?: string; subjectId?: string } = {},
) {
  target.shots[0].bindings.push({ referenceId, retention, ...extra })
}

function generationApi(api: Record<string, { class_type: string; inputs: Record<string, unknown> }>) {
  return Object.values(api).find((node) => node.class_type === 'MiniMaxH3ReferenceToVideo')
}

export function runAcceptanceChecks(): { ok: boolean; results: CheckResult[] } {
  const results: CheckResult[] = []

  const base = project()
  const shot = base.shots[0]
  const prompt = compileRef2VAPrompt(base, shot)
  results.push(check('Ref2VA six-section structure', SECTIONS.every((section) => prompt.includes(section)), prompt.slice(0, 240)))
  results.push(check('Prompt does not invent dialogue', !/"GET READY TO"/.test(prompt) && prompt.includes('Do not invent unprovided dialogue')))
  results.push(check('Official length for 5s is 124 frames', h3FrameLength(5) === 124, String(h3FrameLength(5))))
  results.push(check('Official length for 8s is 192 frames', h3FrameLength(8) === 192, String(h3FrameLength(8))))
  results.push(check('Official length for 6s is 158 frames (Python modulo)', h3FrameLength(6) === 158, String(h3FrameLength(6))))
  results.push(check('Python modulo matches 5-(144%17)%17', pythonModulo(5 - (144 % 17), 17) === 14, String(pythonModulo(5 - (144 % 17), 17))))
  const expression = ((officialTemplate as { nodes?: Array<{ widgets_values_named?: { expression?: string } }> }).nodes ?? []).find(
    (node) => node.widgets_values_named?.expression,
  )?.widgets_values_named?.expression
  results.push(check('Official template keeps the documented length expression', expression === H3_FRAME_EXPRESSION, expression))

  const inspected = inspectWorkflow(officialTemplate)
  results.push(check('Official template contains MiniMaxH3ReferenceToVideo', inspected.ok, inspected.ok ? undefined : inspected.reason))

  const emptyBound = bindSingleShotWorkflow(base, shot)
  results.push(check('1. No reference images: export succeeds', emptyBound.ok, emptyBound.ok ? undefined : emptyBound.reason))
  if (emptyBound.ok) {
    results.push(check('1. No example images remain connected', exampleImagesStillConnected(emptyBound.editor).length === 0, exampleImagesStillConnected(emptyBound.editor).join(', ')))
    results.push(check('1. Example filenames are not on generation slots', TEMPLATE_EXAMPLE_IMAGES.every((name) => connectedFilename(emptyBound.editor, 'ref_images.ref_image_0') !== name && connectedFilename(emptyBound.editor, 'ref_images.ref_image_1') !== name)))
    results.push(check('1. No LoadImage remains when no pictures are bound', (emptyBound.editor.nodes ?? []).every((node) => node.type !== 'LoadImage')))
    const compiledPrompt =
      ((emptyBound.editor.nodes?.find((node) => node.type === 'PrimitiveStringMultiline')?.widgets_values_named as { value?: string } | undefined)?.value ??
        (emptyBound.editor.nodes?.find((node) => node.type === 'MiniMaxH3ReferenceToVideo')?.widgets_values_named as { prompt?: string } | undefined)?.prompt ??
        '')
    results.push(check('Bound prompt uses compiled Ref2VA text', compiledPrompt.includes('subject_definitions:') && !compiledPrompt.includes('GET READY TO')))
    const duration = emptyBound.editor.nodes?.find((node) => node.type === 'PrimitiveFloat' && node.title === 'Float (Duration)')
    results.push(check('Duration primitive is Float (Duration)', ((duration?.widgets_values_named ?? {}) as { value?: number }).value === shot.duration, String((duration?.widgets_values_named as { value?: number } | undefined)?.value)))
    results.push(check('API format keeps generation node', Object.values(emptyBound.api).some((node) => node.class_type === 'MiniMaxH3ReferenceToVideo')))
    results.push(check('Export is not claimed executed', emptyBound.executed === false))
    const originalTypes = new Set(((officialTemplate as { nodes?: Array<{ type?: string }> }).nodes ?? []).map((node) => String(node.type)))
    VERIFIED_LOADER_TYPES.forEach((type) => originalTypes.add(type))
    const invented = (emptyBound.editor.nodes ?? []).map((node) => String(node.type)).filter((type) => type && !originalTypes.has(type))
    results.push(check('Export only uses official or verified loader classes', invented.length === 0, invented.join(', ')))
    results.push(check('17. Empty graph integrity', graphIntegrity(emptyBound.editor).ok, graphIntegrity(emptyBound.editor).problems.join(' ')))
  }

  const one = project()
  addAsset(one, 'img-1', 'image', 'face.png', 'identity')
  bind(one, 'img-1', 'fully_preserved', { objectId: one.shots[0].objects[0].id })
  one.shots[0].objects[0].referenceIds = ['img-1']
  const oneBound = bindSingleShotWorkflow(one, one.shots[0])
  results.push(check('2. One reference image: export succeeds', oneBound.ok, oneBound.ok ? undefined : oneBound.reason))
  if (oneBound.ok) {
    results.push(check('2. Only that image is connected', connectedFilename(oneBound.editor, 'ref_images.ref_image_0') === oneBound.manifest[0].exportFilename && !connectedFilename(oneBound.editor, 'ref_images.ref_image_1')))
    results.push(check('2. LoadImage origin on Picture 1', connectedOriginType(oneBound.editor, 'ref_images.ref_image_0') === 'LoadImage'))
    results.push(check('2. Example images gone', exampleImagesStillConnected(oneBound.editor).length === 0))
    const onePrompt = oneBound.prompt
    results.push(check('2. Identity picture is cited inside Subject, not as a standalone Picture line', /<Subject 1> is the person shown in <Picture 1>/.test(onePrompt) && !onePrompt.includes('<Picture 1> is a composition')))
    results.push(check('5. Identity image bound through objectId', collectPromptSubjects(one, one.shots[0], resolveShotTags(one, one.shots[0]))[0]?.pictureTags.includes('<Picture 1>')))
    const gen = generationApi(oneBound.api)
    results.push(check('18. API links Picture 1 to ref_image_0', Array.isArray(gen?.inputs['ref_images.ref_image_0'])))
  }

  const three = project()
  ;['a.png', 'b.png', 'c.png'].forEach((name, index) => {
    addAsset(three, `img-${index + 1}`, 'image', name, index === 2 ? 'shot' : 'identity')
    bind(three, `img-${index + 1}`)
  })
  three.shots[0].bindings[0] = { referenceId: 'img-1', retention: 'fully_preserved', objectId: three.shots[0].objects[0].id }
  three.shots[0].objects[0].referenceIds = ['img-1']
  const threeBound = bindSingleShotWorkflow(three, three.shots[0])
  results.push(check('3. Three images: export succeeds', threeBound.ok, threeBound.ok ? undefined : threeBound.reason))
  if (threeBound.ok) {
    results.push(
      check(
        '3. All three images connected in order',
        connectedFilename(threeBound.editor, 'ref_images.ref_image_0') === threeBound.manifest[0].exportFilename &&
          connectedFilename(threeBound.editor, 'ref_images.ref_image_1') === threeBound.manifest[1].exportFilename &&
          connectedFilename(threeBound.editor, 'ref_images.ref_image_2') === threeBound.manifest[2].exportFilename,
        JSON.stringify([0, 1, 2].map((index) => connectedFilename(threeBound.editor, `ref_images.ref_image_${index}`))),
      ),
    )
    results.push(check('3. Standalone shot picture gets its own Picture line', threeBound.prompt.includes('<Picture 3> is a composition/keyframe anchor')))
  }

  const nine = project()
  for (let index = 1; index <= 9; index += 1) {
    addAsset(nine, `img-${index}`, 'image', `face-${index}.png`, 'identity')
    bind(nine, `img-${index}`)
  }
  const nineBound = bindSingleShotWorkflow(nine, nine.shots[0])
  results.push(check('4. Nine images: official maximum exports', nineBound.ok, nineBound.ok ? undefined : nineBound.reason))
  if (nineBound.ok) {
    const connected = Array.from({ length: 9 }, (_, index) => connectedFilename(nineBound.editor, `ref_images.ref_image_${index}`))
    results.push(check('4. Nine generation slots carry unique filenames', connected.every(Boolean) && new Set(connected).size === 9, connected.join(',')))
    results.push(check('4. API carries ref_image_8', Array.isArray(generationApi(nineBound.api)?.inputs['ref_images.ref_image_8'])))
  }

  const ten = project()
  for (let index = 1; index <= 10; index += 1) {
    addAsset(ten, `img-${index}`, 'image', `x-${index}.png`, 'identity')
    bind(ten, `img-${index}`)
  }
  const tenBound = bindSingleShotWorkflow(ten, ten.shots[0])
  results.push(check('4. Ten images fail closed', !tenBound.ok, tenBound.ok ? 'exported 10 images' : undefined))

  const duo = project()
  const carId = 'obj-car'
  duo.shots[0].objects.push({
    id: carId,
    name: 'Car',
    kind: 'car',
    position: [2, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    referenceIds: ['veh-1'],
    keyframes: [],
  })
  addAsset(duo, 'person-1', 'image', 'person.png', 'identity')
  addAsset(duo, 'veh-1', 'image', 'car.png', 'object')
  bind(duo, 'person-1', 'fully_preserved', { objectId: duo.shots[0].objects[0].id })
  bind(duo, 'veh-1', 'fully_preserved', { objectId: carId })
  duo.shots[0].objects[0].referenceIds = ['person-1']
  const duoPrompt = compileRef2VAPrompt(duo, duo.shots[0])
  results.push(check('6. Person appears as Subject shown in Picture', /<Subject \d+> is the person shown in <Picture \d+>/.test(duoPrompt), duoPrompt.split('\n').slice(0, 6).join(' | ')))
  results.push(check('6. Vehicle appears as Subject shown in Picture', /<Subject \d+> is the vehicle shown in <Picture \d+>/.test(duoPrompt), duoPrompt.split('\n').slice(0, 6).join(' | ')))
  results.push(check('6. Spatial layout uses camera-relative meters', /approximately \d+\.\d+m/.test(duoPrompt) && !duoPrompt.includes('evaluated 3D placement')))

  const env = project()
  addAsset(env, 'env-1', 'image', 'room.png', 'environment')
  bind(env, 'env-1')
  const envPrompt = compileRef2VAPrompt(env, env.shots[0])
  results.push(check('7. Environment reference receives environment semantics', /<Subject \d+> is the environment shown in <Picture \d+>/.test(envPrompt), envPrompt.split('\n').slice(0, 8).join(' | ')))

  const video = project()
  addAsset(video, 'vid-1', 'video', 'move.mp4', 'motion', { trimEnd: 4 })
  bind(video, 'vid-1', 'weak_reference')
  const videoBound = bindSingleShotWorkflow(video, video.shots[0])
  results.push(check('8. Video reference connects', videoBound.ok, videoBound.ok ? undefined : videoBound.reason))
  if (videoBound.ok) {
    results.push(check('8. LoadVideo + GetVideoComponents feed ref_videos', connectedOriginType(videoBound.editor, 'ref_videos.ref_video_0') === 'GetVideoComponents' && connectedFilename(videoBound.editor, 'ref_videos.ref_video_0') === videoBound.manifest[0].exportFilename))
    results.push(check('10. Video soundtrack uses ref_video_audios', connectedOriginType(videoBound.editor, 'ref_video_audios.ref_video_audio_0') === 'GetVideoComponents' && Boolean(generationApi(videoBound.api)?.inputs['ref_video_audios.ref_video_audio_0'])))
    results.push(check('10. Video soundtrack is not dumped onto ref_audios', !generationApi(videoBound.api)?.inputs['ref_audios.ref_audio_0']))
    results.push(check('8. Prompt Video label does not invent a matching Audio label', videoBound.prompt.includes('<Video 1>') && !videoBound.prompt.includes('<Audio 1>')))
  }

  const audio = project()
  addAsset(audio, 'aud-1', 'audio', 'voice.wav', 'voice', { trimEnd: 4 })
  bind(audio, 'aud-1', 'reference')
  const audioOnly = bindSingleShotWorkflow(audio, audio.shots[0])
  results.push(check('9. Audio-only export fails closed', !audioOnly.ok && (audioOnly.ok ? '' : audioOnly.reason).includes('sole Ref2VA'), audioOnly.ok ? 'audio-only succeeded' : audioOnly.reason))

  const mixedAudio = project()
  addAsset(mixedAudio, 'img-a', 'image', 'face.png', 'identity')
  addAsset(mixedAudio, 'aud-a', 'audio', 'voice.wav', 'voice', { trimEnd: 4 })
  bind(mixedAudio, 'img-a')
  bind(mixedAudio, 'aud-a', 'reference')
  const mixedAudioBound = bindSingleShotWorkflow(mixedAudio, mixedAudio.shots[0])
  results.push(check('9. Standalone audio connects when an image is present', mixedAudioBound.ok, mixedAudioBound.ok ? undefined : mixedAudioBound.reason))
  if (mixedAudioBound.ok) {
    results.push(check('9. LoadAudio feeds ref_audios', connectedOriginType(mixedAudioBound.editor, 'ref_audios.ref_audio_0') === 'LoadAudio'))
    results.push(check('9. Standalone audio is not on ref_video_audios', !generationApi(mixedAudioBound.api)?.inputs['ref_video_audios.ref_video_audio_0']))
  }

  const mixedLimit = project()
  for (let index = 1; index <= 9; index += 1) {
    addAsset(mixedLimit, `m-img-${index}`, 'image', `m-${index}.png`, 'identity')
    bind(mixedLimit, `m-img-${index}`)
  }
  for (let index = 1; index <= 3; index += 1) {
    addAsset(mixedLimit, `m-vid-${index}`, 'video', `m-${index}.mp4`, 'motion', { trimEnd: 3 })
    bind(mixedLimit, `m-vid-${index}`, 'weak_reference')
  }
  addAsset(mixedLimit, 'm-aud-1', 'audio', 'm.wav', 'audio', { trimEnd: 3 })
  bind(mixedLimit, 'm-aud-1', 'fully_copy')
  results.push(check('11. Mixed 9+3+1 exceeds 12 files and fails', !bindSingleShotWorkflow(mixedLimit, mixedLimit.shots[0]).ok))

  const longClip = project()
  addAsset(longClip, 'long-vid', 'video', 'long.mp4', 'motion', { trimStart: 0, trimEnd: 20, duration: 20 })
  bind(longClip, 'long-vid', 'weak_reference')
  results.push(check('12. Overlong reference clip fails', !validateReferenceLimits(longClip, longClip.shots[0]).ok))

  const shortClip = project()
  addAsset(shortClip, 'short-vid', 'video', 'short.mp4', 'motion', { trimStart: 0, trimEnd: 1, duration: 1 })
  bind(shortClip, 'short-vid', 'weak_reference')
  results.push(check('12. Sub-2s reference clip fails', !validateReferenceLimits(shortClip, shortClip.shots[0]).ok))

  const six = project()
  six.shots[0].duration = 6
  six.shots[0].cameraKeys[1] = { ...six.shots[0].cameraKeys[1], time: 6 }
  const sixBound = bindSingleShotWorkflow(six, six.shots[0])
  results.push(check('13. Six-second shot exports', sixBound.ok, sixBound.ok ? undefined : sixBound.reason))
  if (sixBound.ok) {
    const duration = sixBound.editor.nodes?.find((node) => node.type === 'PrimitiveFloat' && node.title === 'Float (Duration)')
    results.push(check('13. Duration widget is 6', ((duration?.widgets_values_named ?? {}) as { value?: number }).value === 6))
    results.push(check('13. Widget length fallback is 158', ((sixBound.editor.nodes?.find((node) => node.type === 'MiniMaxH3ReferenceToVideo')?.widgets_values_named ?? {}) as { length?: number }).length === 158))
    const math = sixBound.editor.nodes?.find((node) => node.type === 'ComfyMathExpression')
    results.push(check('13. Official Python expression is unchanged', ((math?.widgets_values_named ?? {}) as { expression?: string }).expression === H3_FRAME_EXPRESSION))
  }

  const camera = describeCameraSegment(base.shots[0], 0, 8)
  results.push(check('14. Camera language includes focal-length change', /focal length moves from 35mm to 50mm/.test(camera), camera))
  results.push(check('14. Camera language is not world-Z dolly only', !/along world z/i.test(camera)))
  const cameraPrompt = compileRef2VAPrompt(base, base.shots[0])
  const cameraHits = (cameraPrompt.match(/the camera /g) ?? []).length
  results.push(check('14. Prompt includes timed camera spans once', cameraPrompt.includes('From 00:00.000 to 00:08.000') && cameraHits >= 1))

  const labels = unresolvedPromptLabels(duo, duo.shots[0])
  results.push(
    check(
      '15. No unresolved labels',
      labels.pictures.length + labels.videos.length + labels.audios.length + labels.subjects.length === 0,
      JSON.stringify(labels),
    ),
  )

  results.push(check('16. Person retention marker is emitted', /<Subject 1> \(appears in \[Shot 1\]\): fully_preserved/.test(duoPrompt)))
  results.push(check('16. Vehicle retention marker is emitted', /fully_preserved - retain the defined identity/.test(duoPrompt)))

  const tags = resolveShotTags(one, one.shots[0])
  const manifest = manifestForShot(one, one.shots[0])
  results.push(check('Picture tags follow connection order', tags[0]?.tag === pictureTag(1)))
  results.push(check('Manifest slot matches Comfy input', manifest[0]?.slot === 'ref_images.ref_image_0' && manifest[0]?.comfyTag === '<Picture 1>'))

  if (oneBound.ok) {
    results.push(check('17. One-image graph integrity', graphIntegrity(oneBound.editor).ok, graphIntegrity(oneBound.editor).problems.join(' ')))
    const packed = buildSingleShotPackage(one, one.shots[0])
    results.push(check('19. Package builds', packed.ok, packed.ok ? undefined : packed.reason))
    if (packed.ok) {
      results.push(check('19. Package contains required files', ['workflow.json', 'workflow.api.json', 'prompt-ref2va.txt', 'manifest.json', 'project.json', 'shot.json', 'validation.json', `media/${oneBound.manifest[0].exportFilename}`].every((name) => packed.filenames.includes(name)), packed.filenames.join(',')))
      results.push(check('19. Media filename matches loader and manifest', oneBound.manifest[0].exportFilename === connectedFilename(oneBound.editor, 'ref_images.ref_image_0')))
      results.push(check('19. Package is not claimed executed', packed.executed === false))
    }
  }

  const cloned = parseMotionProject(JSON.parse(JSON.stringify(snapshotProject(base))))
  results.push(check('20. Project JSON round-trip', cloned.id === base.id && cloned.shots[0].id === base.shots[0].id))

  const independent = createDefaultShot('Shot 2')
  independent.notes.action = 'second shot only'
  results.push(check('20. Shots are independently serializable', independent.id !== shot.id && shot.notes.action === '' && independent.notes.action === 'second shot only'))

  const chunks = planChunks(23, 10)
  results.push(check('Muse-style chunking folds a short tail', chunks.length === 2 && chunks[1].duration === 13, JSON.stringify(chunks)))

  useMotionStore.getState().resetProject()
  const firstId = useMotionStore.getState().activeShotId
  useMotionStore.getState().addShot()
  useMotionStore.getState().setNotes({ action: 'only the second shot' })
  const store = useMotionStore.getState()
  const first = store.shots.find((item) => item.id === firstId)
  const second = store.shots.find((item) => item.id === store.activeShotId)
  results.push(check('20. Store isolates per-shot notes', first?.notes.action === '' && second?.notes.action === 'only the second shot'))
  const serialized = store.serialized()
  useMotionStore.getState().resetProject()
  const importError = useMotionStore.getState().importProject(JSON.parse(JSON.stringify(serialized)))
  const restored = useMotionStore.getState()
  results.push(check('20. Zustand save/load round-trip', importError === null && restored.id === serialized.id && restored.shots.length === 2))

  results.push(check('21. Master Workflow remains out of scope', compileMasterWorkflow().ok === false))
  results.push(check('21. Single Shot export works without Master Workflow', emptyBound.ok === true && compileMasterWorkflow().ok === false))

  const emptyPack = buildSingleShotPackage(base, shot)
  results.push(check('Fail-closed package still succeeds with no media', emptyPack.ok, emptyPack.ok ? undefined : emptyPack.reason))
  const badPack = buildSingleShotPackage(ten, ten.shots[0])
  results.push(check('Fail-closed package refuses 10 images', !badPack.ok))

  return { ok: results.every((item) => item.ok), results }
}
