import { createDefaultProject, createDefaultShot } from '@/motion/lib/defaultProject'
import { planChunks } from '@/motion/lib/chunking'
import { h3FrameLength } from '@/motion/lib/interpolation'
import { snapshotProject } from '@/motion/lib/projectSnapshot'
import { compileRef2VAPrompt } from '@/motion/lib/promptCompiler'
import { parseMotionProject } from '@/motion/lib/schema'
import { manifestForShot, pictureTag, resolveShotTags } from '@/motion/lib/references'
import officialTemplate from '@/motion/templates/video_minimax_h3_r2v.json'
import { bindSingleShotWorkflow, inspectWorkflow } from '@/motion/lib/workflow'
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

function check(name: string, ok: boolean, detail?: string): CheckResult {
  return { name, ok, detail: ok ? undefined : detail }
}

export function runAcceptanceChecks(): { ok: boolean; results: CheckResult[] } {
  const results: CheckResult[] = []

  const project = createDefaultProject()
  const shot = project.shots[0]
  const prompt = compileRef2VAPrompt(project, shot)
  results.push(
    check(
      'Ref2VA six-section structure',
      SECTIONS.every((section) => prompt.includes(section)),
      prompt.slice(0, 240),
    ),
  )
  results.push(check('Prompt does not invent dialogue', !/"GET READY TO"/.test(prompt) && prompt.includes('Do not invent unprovided dialogue')))
  results.push(check('Official length for 5s is 124 frames', h3FrameLength(5) === 124, String(h3FrameLength(5))))
  results.push(check('Official length for 8s is 192 frames', h3FrameLength(8) === 192, String(h3FrameLength(8))))

  const inspected = inspectWorkflow(officialTemplate)
  results.push(check('Official template contains MiniMaxH3ReferenceToVideo', inspected.ok, inspected.ok ? undefined : inspected.reason))

  const bound = bindSingleShotWorkflow(project, shot)
  results.push(check('Single-shot workflow export succeeds', bound.ok, bound.ok ? undefined : bound.reason))
  if (bound.ok) {
    const nodes = bound.editor.nodes ?? []
    const generation = nodes.find((node) => node.type === 'MiniMaxH3ReferenceToVideo')
    const named = (generation?.widgets_values_named ?? {}) as Record<string, unknown>
    const duration = nodes.find((node) => node.type === 'PrimitiveFloat' && node.title === 'Float (Duration)')
    const durationNamed = (duration?.widgets_values_named ?? {}) as Record<string, unknown>
    results.push(check('Bound graph keeps MiniMaxH3ReferenceToVideo', Boolean(generation)))
    results.push(check('Bound prompt uses compiled Ref2VA text', typeof named.prompt === 'string' && String(named.prompt).includes('subject_definitions:')))
    results.push(check('Duration primitive is Float (Duration)', durationNamed.value === shot.duration, String(durationNamed.value)))
    results.push(check('API format keeps generation node', Object.values(bound.api).some((node) => node.class_type === 'MiniMaxH3ReferenceToVideo')))
    results.push(check('Export is not claimed executed', bound.executed === false))
    const originalTypes = new Set(
      (officialTemplate as { nodes?: Array<{ type?: string }> }).nodes?.map((node) => String(node.type)) ?? [],
    )
    const invented = (bound.editor.nodes ?? [])
      .map((node) => String(node.type))
      .filter((type) => type && !originalTypes.has(type))
    results.push(check('Export does not invent node classes', invented.length === 0, invented.join(', ')))
  }

  const withRef = createDefaultProject()
  const referenceId = 'ref-picture-1'
  withRef.references.push({
    id: referenceId,
    kind: 'image',
    name: 'face.png',
    filename: 'face.png',
    mime: 'image/png',
    dataUrl: 'data:image/png;base64,AA==',
    role: 'identity',
    description: '',
    trimStart: 0,
    trimEnd: 0,
  })
  withRef.shots[0].bindings.push({ referenceId, retention: 'fully_preserved' })
  const tags = resolveShotTags(withRef, withRef.shots[0])
  const manifest = manifestForShot(withRef, withRef.shots[0])
  results.push(check('Picture tags follow connection order', tags[0]?.tag === pictureTag(1)))
  results.push(check('Manifest slot matches Comfy input', manifest[0]?.slot === 'ref_images.ref_image_0' && manifest[0]?.comfyTag === '<Picture 1>'))
  results.push(check('Compiled prompt uses <Picture 1>', compileRef2VAPrompt(withRef, withRef.shots[0]).includes('<Picture 1>')))

  const mixed = createDefaultProject()
  mixed.references.push(
    {
      id: 'img-1',
      kind: 'image',
      name: 'a.png',
      filename: 'a.png',
      mime: 'image/png',
      dataUrl: '',
      role: 'identity',
      description: '',
      trimStart: 0,
      trimEnd: 0,
    },
    {
      id: 'vid-1',
      kind: 'video',
      name: 'b.mp4',
      filename: 'b.mp4',
      mime: 'video/mp4',
      dataUrl: '',
      role: 'motion',
      description: '',
      trimStart: 0,
      trimEnd: 4,
    },
  )
  mixed.shots[0].bindings = [
    { referenceId: 'img-1', retention: 'fully_preserved' },
    { referenceId: 'vid-1', retention: 'weak_reference' },
  ]
  const mixedTags = resolveShotTags(mixed, mixed.shots[0])
  results.push(
    check(
      'Picture/Video labels stay on their own modality counters',
      mixedTags[0]?.tag === '<Picture 1>' && mixedTags[1]?.tag === '<Video 1>',
    ),
  )

  const cloned = parseMotionProject(JSON.parse(JSON.stringify(snapshotProject(project))))
  results.push(check('Project JSON round-trip', cloned.id === project.id && cloned.shots[0].id === project.shots[0].id))

  const independent = createDefaultShot('Shot 2')
  independent.notes.action = 'second shot only'
  results.push(check('Shots are independently serializable', independent.id !== shot.id && shot.notes.action === '' && independent.notes.action === 'second shot only'))

  const chunks = planChunks(23, 10)
  results.push(check('Muse-style chunking folds a short tail', chunks.length === 2 && chunks[1].duration === 13, JSON.stringify(chunks)))

  useMotionStore.getState().resetProject()
  const firstId = useMotionStore.getState().activeShotId
  useMotionStore.getState().addShot()
  useMotionStore.getState().setNotes({ action: 'only the second shot' })
  const store = useMotionStore.getState()
  const first = store.shots.find((item) => item.id === firstId)
  const second = store.shots.find((item) => item.id === store.activeShotId)
  results.push(check('Store isolates per-shot notes', first?.notes.action === '' && second?.notes.action === 'only the second shot'))
  const serialized = store.serialized()
  useMotionStore.getState().resetProject()
  const importError = useMotionStore.getState().importProject(JSON.parse(JSON.stringify(serialized)))
  const restored = useMotionStore.getState()
  results.push(check('Zustand save/load round-trip', importError === null && restored.id === serialized.id && restored.shots.length === 2))

  return { ok: results.every((item) => item.ok), results }
}
