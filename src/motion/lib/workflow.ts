import officialTemplate from '@/motion/templates/video_minimax_h3_r2v.json'
import { h3FrameLength } from '@/motion/lib/interpolation'
import { manifestForShot, validateReferenceLimits } from '@/motion/lib/references'
import { compileRef2VAPrompt } from '@/motion/lib/promptCompiler'
import type { MotionProject, MotionShot } from '@/motion/types'

export type ComfyEditorWorkflow = {
  nodes?: Array<Record<string, unknown>>
  links?: unknown[]
  [key: string]: unknown
}

export type WorkflowExportResult =
  | {
      ok: true
      editor: ComfyEditorWorkflow
      api: Record<string, { class_type: string; inputs: Record<string, unknown> }>
      diagnostics: string[]
      executed: false
    }
  | { ok: false; reason: string; diagnostics: string[] }

const GENERATION = 'MiniMaxH3ReferenceToVideo'

export function inspectWorkflow(raw: unknown) {
  if (!raw || typeof raw !== 'object') return { ok: false as const, reason: 'Workflow JSON is not an object.' }
  const graph = raw as ComfyEditorWorkflow
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : []
  const generation = nodes.find((node) => node.type === GENERATION)
  if (!generation) {
    return { ok: false as const, reason: `No ${GENERATION} node found. Import the official Ref2VA template or a graph that contains that node.` }
  }
  return { ok: true as const, graph, nodes, generation }
}

function setNamed(node: Record<string, unknown>, key: string, value: unknown) {
  const named = { ...((node.widgets_values_named ?? {}) as Record<string, unknown>) }
  const keys = Object.keys(named)
  named[key] = value
  node.widgets_values_named = named
  if (Array.isArray(node.widgets_values)) {
    const index = keys.indexOf(key)
    if (index >= 0 && index < node.widgets_values.length) node.widgets_values[index] = value
  }
}

function aspectWidget(ratio: MotionShot['aspectRatio']) {
  switch (ratio) {
    case '16:9':
      return '16:9 (Widescreen)'
    case '9:16':
      return '9:16 (Vertical)'
    case '1:1':
      return '1:1 (Square)'
    case '4:5':
      return '4:5 (Portrait)'
    case '3:2':
      return '3:2 (Classic)'
  }
}

export function cloneOfficialTemplate(): ComfyEditorWorkflow {
  return structuredClone(officialTemplate) as ComfyEditorWorkflow
}

export function bindSingleShotWorkflow(project: MotionProject, shot: MotionShot, template?: unknown): WorkflowExportResult {
  const limits = validateReferenceLimits(project, shot)
  const inspected = inspectWorkflow(template ?? officialTemplate)
  if (!inspected.ok) return { ok: false, reason: inspected.reason, diagnostics: [inspected.reason, ...limits.problems] }

  const editor = structuredClone(inspected.graph)
  const nodes = Array.isArray(editor.nodes) ? editor.nodes : []
  const diagnostics = [...limits.problems]

  const promptNode = nodes.find((node) => node.type === 'PrimitiveStringMultiline')
  const durationNode =
    nodes.find((node) => node.type === 'PrimitiveFloat' && node.title === 'Float (Duration)') ??
    nodes.find((node) => node.type === 'PrimitiveFloat')
  const resolution = nodes.find((node) => node.type === 'ResolutionSelector')
  const generation = nodes.find((node) => node.type === GENERATION)
  const loaders = nodes.filter((node) => node.type === 'LoadImage')

  if (!generation) return { ok: false, reason: `Missing ${GENERATION}.`, diagnostics }
  const prompt = compileRef2VAPrompt(project, shot)
  if (promptNode) setNamed(promptNode, 'value', prompt)
  setNamed(generation, 'prompt', prompt)
  if (durationNode) setNamed(durationNode, 'value', shot.duration)
  setNamed(generation, 'length', h3FrameLength(shot.duration))
  if (resolution) setNamed(resolution, 'aspect_ratio', aspectWidget(shot.aspectRatio))

  const manifest = manifestForShot(project, shot)
  const pictures = manifest.filter((item) => item.kind === 'image')
  pictures.forEach((item, index) => {
    const loader = loaders[index]
    if (loader) setNamed(loader, 'image', item.filename)
    else diagnostics.push(`Picture ${index + 1} (${item.filename}) has no LoadImage node in this template. Connect it in ComfyUI to ${item.slot}.`)
  })

  const videos = manifest.filter((item) => item.kind === 'video')
  const audios = manifest.filter((item) => item.kind === 'audio')
  if (videos.length > 0) {
    diagnostics.push(
      `The official template has no stock video loader nodes. Bind ${videos.map((item) => `${item.comfyTag} → ${item.slot} (${item.filename})`).join(', ')} inside ComfyUI. Tags already match slot order.`,
    )
  }
  if (audios.length > 0) {
    diagnostics.push(
      `The official template has no stock audio loader nodes. Bind ${audios.map((item) => `${item.comfyTag} → ${item.slot} (${item.filename})`).join(', ')} inside ComfyUI.`,
    )
  }

  if (shot.duration > 15) {
    return {
      ok: false,
      reason: 'Single-shot official Ref2VA export supports 4–15 seconds. Longer programs need a later Master Workflow with chunked MiniMaxH3ReferenceToVideo branches.',
      diagnostics,
    }
  }

  const api = toApiFormat(editor)
  if (!api.ok) return { ok: false, reason: api.reason, diagnostics: [...diagnostics, api.reason] }

  diagnostics.push('This file is a bound ComfyUI graph. It has not been executed.')
  return { ok: true, editor, api: api.api, diagnostics, executed: false }
}

export function compileMasterWorkflow(): { ok: false; reason: string } {
  return {
    ok: false,
    reason:
      'Master Workflow export is reserved for a later version. V1 exports one official MiniMaxH3ReferenceToVideo graph per selected shot. Combining shot branches requires verified video-assembly nodes that are not in the official single-shot Ref2VA template.',
  }
}

export function toApiFormat(editor: ComfyEditorWorkflow) {
  const nodes = Array.isArray(editor.nodes) ? editor.nodes : []
  const links = Array.isArray(editor.links) ? editor.links : []
  if (nodes.length === 0) return { ok: false as const, reason: 'Editor workflow has no nodes.' }

  const api: Record<string, { class_type: string; inputs: Record<string, unknown> }> = {}
  for (const node of nodes) {
    if (typeof node.id !== 'number' && typeof node.id !== 'string') continue
    if (typeof node.type !== 'string') continue
    if (node.type === 'MarkdownNote' || node.type === 'Note') continue
    const inputs: Record<string, unknown> = {}
    const named = (node.widgets_values_named ?? {}) as Record<string, unknown>
    for (const [key, value] of Object.entries(named)) inputs[key] = value
    api[String(node.id)] = { class_type: node.type, inputs }
  }

  for (const link of links) {
    if (!Array.isArray(link) || link.length < 6) continue
    const originId = String(link[1])
    const originSlot = Number(link[2])
    const targetId = String(link[3])
    const targetNode = nodes.find((node) => String(node.id) === targetId)
    const originNode = nodes.find((node) => String(node.id) === originId)
    if (!targetNode || !originNode) continue
    const targetInputs = Array.isArray(targetNode.inputs) ? (targetNode.inputs as Array<{ name?: string }>) : []
    const input = targetInputs[Number(link[4])]
    const name = input?.name
    if (!name) continue
    const bucket = api[targetId]
    if (!bucket) continue
    bucket.inputs[name] = [originId, originSlot]
  }

  const hasGeneration = Object.values(api).some((node) => node.class_type === GENERATION)
  if (!hasGeneration) return { ok: false as const, reason: `API conversion lost ${GENERATION}.` }
  return { ok: true as const, api }
}
