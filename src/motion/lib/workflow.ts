import officialTemplate from '@/motion/templates/video_minimax_h3_r2v.json'
import { h3FrameLength } from '@/motion/lib/interpolation'
import { compileRef2VAPrompt, unresolvedPromptLabels } from '@/motion/lib/promptCompiler'
import { manifestForShot, validateReferenceLimits, type ManifestEntry } from '@/motion/lib/references'
import { REF2VA_LIMITS, TEMPLATE_EXAMPLE_IMAGES, type MotionProject, type MotionShot } from '@/motion/types'

export type ComfyEditorWorkflow = {
  last_node_id?: number
  last_link_id?: number
  nodes?: Array<Record<string, unknown>>
  links?: unknown[]
  [key: string]: unknown
}

export type WorkflowExportResult =
  | {
      ok: true
      readiness: 'template'
      executionReady: false
      editor: ComfyEditorWorkflow
      api: Record<string, { class_type: string; inputs: Record<string, unknown> }>
      diagnostics: string[]
      warnings: string[]
      manifest: ManifestEntry[]
      prompt: string
      executed: false
    }
  | { ok: false; reason: string; diagnostics: string[] }

const GENERATION = 'MiniMaxH3ReferenceToVideo'

export const VERIFIED_LOADER_TYPES = ['LoadImage', 'LoadVideo', 'GetVideoComponents', 'LoadAudio'] as const

const EXAMPLE_IMAGES = new Set<string>(TEMPLATE_EXAMPLE_IMAGES)

type EditorNode = Record<string, unknown> & {
  id: number
  type: string
  inputs?: Array<{ name?: string; label?: string; type?: string; link?: number | null; shape?: number; widget?: { name: string } }>
  outputs?: Array<{ name?: string; type?: string; links?: number[] | null }>
  widgets_values?: unknown[]
  widgets_values_named?: Record<string, unknown>
  pos?: number[]
  size?: number[]
  flags?: Record<string, unknown>
  order?: number
  mode?: number
  title?: string
  properties?: Record<string, unknown>
}

type LinkRow = [number, number, number, number, number, string]

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

function asNodes(editor: ComfyEditorWorkflow) {
  if (!Array.isArray(editor.nodes)) editor.nodes = []
  return editor.nodes as EditorNode[]
}

function asLinks(editor: ComfyEditorWorkflow) {
  if (!Array.isArray(editor.links)) editor.links = []
  return editor.links as LinkRow[]
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

function nextNodeId(editor: ComfyEditorWorkflow) {
  const nodes = asNodes(editor)
  const nodeId = Math.max(editor.last_node_id ?? 0, ...nodes.map((node) => Number(node.id) || 0)) + 1
  editor.last_node_id = nodeId
  return nodeId
}

function nextLinkId(editor: ComfyEditorWorkflow) {
  const links = asLinks(editor)
  const linkId = Math.max(editor.last_link_id ?? 0, ...links.map((link) => Number(link[0]) || 0)) + 1
  editor.last_link_id = linkId
  return linkId
}

function removeLink(editor: ComfyEditorWorkflow, linkId: number | null | undefined) {
  if (!linkId) return
  const links = asLinks(editor)
  const row = links.find((item) => item[0] === linkId)
  editor.links = links.filter((item) => item[0] !== linkId)
  if (!row) return
  asNodes(editor).forEach((node) => {
    node.inputs?.forEach((input) => {
      if (input.link === linkId) input.link = null
    })
    node.outputs?.forEach((output) => {
      if (Array.isArray(output.links)) output.links = output.links.filter((id) => id !== linkId)
    })
  })
}

function connect(editor: ComfyEditorWorkflow, origin: EditorNode, originSlot: number, target: EditorNode, targetSlot: number, type: string) {
  const linkId = nextLinkId(editor)
  const links = asLinks(editor)
  const current = target.inputs?.[targetSlot]?.link
  if (typeof current === 'number') removeLink(editor, current)
  links.push([linkId, origin.id, originSlot, target.id, targetSlot, type])
  if (target.inputs && target.inputs[targetSlot]) target.inputs[targetSlot].link = linkId
  const output = origin.outputs?.[originSlot]
  if (output) output.links = [...(output.links ?? []), linkId]
  return linkId
}

function ensureInput(generation: EditorNode, name: string, type: string, label?: string) {
  if (!generation.inputs) generation.inputs = []
  let index = generation.inputs.findIndex((input) => input.name === name)
  if (index >= 0) return index
  generation.inputs.push({
    label: label ?? name.split('.').pop(),
    name,
    shape: 7,
    type,
    link: null,
  })
  index = generation.inputs.length - 1
  return index
}

function addLoadImage(editor: ComfyEditorWorkflow, filename: string, x: number, y: number, title?: string) {
  const nodeId = nextNodeId(editor)
  const node: EditorNode = {
    id: nodeId,
    type: 'LoadImage',
    title,
    pos: [x, y],
    size: [290, 330],
    flags: {},
    order: 30,
    mode: 0,
    inputs: [],
    outputs: [
      { name: 'IMAGE', type: 'IMAGE', links: [] },
      { name: 'MASK', type: 'MASK', links: null },
    ],
    properties: { cnr_id: 'comfy-core', 'Node name for S&R': 'LoadImage' },
    widgets_values: [filename, 'image'],
    widgets_values_named: { image: filename, upload: 'image' },
  }
  asNodes(editor).push(node)
  return node
}

function addLoadVideo(editor: ComfyEditorWorkflow, filename: string, x: number, y: number, title?: string) {
  const nodeId = nextNodeId(editor)
  const node: EditorNode = {
    id: nodeId,
    type: 'LoadVideo',
    title,
    pos: [x, y],
    size: [270, 80],
    flags: {},
    order: 31,
    mode: 0,
    inputs: [],
    outputs: [{ name: 'VIDEO', type: 'VIDEO', links: [] }],
    properties: { cnr_id: 'comfy-core', 'Node name for S&R': 'LoadVideo' },
    widgets_values: [filename],
    widgets_values_named: { file: filename },
  }
  asNodes(editor).push(node)
  return node
}

function addGetVideoComponents(editor: ComfyEditorWorkflow, x: number, y: number) {
  const nodeId = nextNodeId(editor)
  const node: EditorNode = {
    id: nodeId,
    type: 'GetVideoComponents',
    pos: [x, y],
    size: [240, 120],
    flags: {},
    order: 32,
    mode: 0,
    inputs: [{ name: 'video', type: 'VIDEO', link: null }],
    outputs: [
      { name: 'images', type: 'IMAGE', links: [] },
      { name: 'audio', type: 'AUDIO', links: [] },
      { name: 'fps', type: 'FLOAT', links: [] },
      { name: 'bit_depth', type: 'COMBO', links: [] },
      { name: 'color_space', type: 'COMBO', links: [] },
    ],
    properties: { cnr_id: 'comfy-core', 'Node name for S&R': 'GetVideoComponents' },
  }
  asNodes(editor).push(node)
  return node
}

function addLoadAudio(editor: ComfyEditorWorkflow, filename: string, x: number, y: number, title?: string) {
  const nodeId = nextNodeId(editor)
  const node: EditorNode = {
    id: nodeId,
    type: 'LoadAudio',
    title,
    pos: [x, y],
    size: [270, 80],
    flags: {},
    order: 33,
    mode: 0,
    inputs: [],
    outputs: [{ name: 'AUDIO', type: 'AUDIO', links: [] }],
    properties: { cnr_id: 'comfy-core', 'Node name for S&R': 'LoadAudio' },
    widgets_values: [filename],
    widgets_values_named: { audio: filename },
  }
  asNodes(editor).push(node)
  return node
}

export function generationInput(editor: ComfyEditorWorkflow, name: string) {
  const generation = asNodes(editor).find((node) => node.type === GENERATION)
  return generation?.inputs?.find((input) => input.name === name)
}

export function connectedFilename(editor: ComfyEditorWorkflow, slot: string) {
  const input = generationInput(editor, slot)
  if (!input?.link) return null
  const links = asLinks(editor)
  const row = links.find((item) => item[0] === input.link)
  if (!row) return null
  const origin = asNodes(editor).find((node) => node.id === row[1])
  if (!origin) return null
  if (origin.type === 'LoadImage') return String(origin.widgets_values_named?.image ?? '')
  if (origin.type === 'LoadVideo') return String(origin.widgets_values_named?.file ?? '')
  if (origin.type === 'LoadAudio') return String(origin.widgets_values_named?.audio ?? '')
  if (origin.type === 'GetVideoComponents') {
    const videoLink = origin.inputs?.[0]?.link
    const videoRow = links.find((item) => item[0] === videoLink)
    const loader = videoRow ? asNodes(editor).find((node) => node.id === videoRow[1]) : undefined
    return loader ? String(loader.widgets_values_named?.file ?? '') : null
  }
  return origin.type
}

export function connectedOriginType(editor: ComfyEditorWorkflow, slot: string) {
  const input = generationInput(editor, slot)
  if (!input?.link) return null
  const row = asLinks(editor).find((item) => item[0] === input.link)
  if (!row) return null
  return asNodes(editor).find((node) => node.id === row[1])?.type ?? null
}

export function exampleImagesStillConnected(editor: ComfyEditorWorkflow) {
  return asNodes(editor)
    .filter((node) => node.type === 'LoadImage')
    .filter((node) => EXAMPLE_IMAGES.has(String(node.widgets_values_named?.image ?? '')))
    .filter((node) => node.outputs?.some((output) => (output.links ?? []).length > 0))
    .map((node) => String(node.widgets_values_named?.image ?? ''))
}

export function graphIntegrity(editor: ComfyEditorWorkflow) {
  const nodes = asNodes(editor)
  const links = asLinks(editor)
  const problems: string[] = []
  const nodeIds = nodes.map((node) => node.id)
  if (new Set(nodeIds).size !== nodeIds.length) problems.push('Duplicate node IDs.')
  const linkIds = links.map((link) => link[0])
  if (new Set(linkIds).size !== linkIds.length) problems.push('Duplicate link IDs.')
  const byId = new Map(nodes.map((node) => [node.id, node]))
  links.forEach((link) => {
    if (!Array.isArray(link) || link.length < 6) {
      problems.push(`Malformed link ${JSON.stringify(link)}.`)
      return
    }
    const origin = byId.get(link[1])
    const target = byId.get(link[3])
    if (!origin) problems.push(`Link ${link[0]} origin node ${link[1]} is missing.`)
    if (!target) problems.push(`Link ${link[0]} target node ${link[3]} is missing.`)
    const output = origin?.outputs?.[link[2]]
    const input = target?.inputs?.[link[4]]
    if (origin && !output) problems.push(`Link ${link[0]} origin slot ${link[2]} is missing on node ${origin.id}.`)
    if (target && !input) problems.push(`Link ${link[0]} target slot ${link[4]} is missing on node ${target.id}.`)
    if (output && input && output.type && input.type && output.type !== input.type) {
      const compatible = input.type.includes(output.type) || output.type.includes(input.type)
      if (!compatible) problems.push(`Link ${link[0]} type mismatch ${output.type} → ${input.type}.`)
    }
  })
  const generation = nodes.find((node) => node.type === GENERATION)
  ;['clip', 'vae', 'audio_vae', 'prompt', 'width', 'height', 'length'].forEach((name) => {
    if (!generation?.inputs?.find((input) => input.name === name)?.link) {
      problems.push(`Required ${GENERATION} input ${name} is disconnected.`)
    }
  })
  const originalTypes = new Set(((officialTemplate as { nodes?: Array<{ type?: string }> }).nodes ?? []).map((node) => String(node.type)))
  VERIFIED_LOADER_TYPES.forEach((type) => originalTypes.add(type))
  nodes.forEach((node) => {
    if (!originalTypes.has(node.type)) problems.push(`Unsupported node class ${node.type}.`)
  })
  return { ok: problems.length === 0, problems }
}

function disconnectGenerationSlot(editor: ComfyEditorWorkflow, name: string) {
  const generation = asNodes(editor).find((node) => node.type === GENERATION)
  const input = generation?.inputs?.find((item) => item.name === name)
  if (input?.link) removeLink(editor, input.link)
}

function pruneUnusedImageLoaders(editor: ComfyEditorWorkflow, keepIds: Set<number>) {
  const nodes = asNodes(editor)
  nodes
    .filter((node) => node.type === 'LoadImage' && !keepIds.has(node.id))
    .forEach((node) => {
      node.outputs?.forEach((output) => {
        ;(output.links ?? []).forEach((id) => removeLink(editor, id))
      })
    })
  editor.nodes = nodes.filter((node) => node.type !== 'LoadImage' || keepIds.has(node.id))
}

export function cloneOfficialTemplate(): ComfyEditorWorkflow {
  return structuredClone(officialTemplate) as ComfyEditorWorkflow
}

export function bindSingleShotWorkflow(project: MotionProject, shot: MotionShot, template?: unknown): WorkflowExportResult {
  const limits = validateReferenceLimits(project, shot)
  const inspected = inspectWorkflow(template ?? officialTemplate)
  if (!inspected.ok) return { ok: false, reason: inspected.reason, diagnostics: [inspected.reason, ...limits.problems] }
  if (!limits.ok) return { ok: false, reason: limits.problems[0] ?? 'Reference limits failed.', diagnostics: limits.problems }

  const editor = structuredClone(inspected.graph)
  const nodes = asNodes(editor)
  const diagnostics: string[] = [...limits.warnings]
  const warnings = [...limits.warnings]
  const generation = nodes.find((node) => node.type === GENERATION)
  const promptNode = nodes.find((node) => node.type === 'PrimitiveStringMultiline')
  const durationNode =
    nodes.find((node) => node.type === 'PrimitiveFloat' && node.title === 'Float (Duration)') ??
    nodes.find((node) => node.type === 'PrimitiveFloat')
  const resolution = nodes.find((node) => node.type === 'ResolutionSelector')
  if (!generation) return { ok: false, reason: `Missing ${GENERATION}.`, diagnostics }

  if (shot.duration < REF2VA_LIMITS.minDuration || shot.duration > REF2VA_LIMITS.maxDuration) {
    return {
      ok: false,
      reason: `Single-shot official Ref2VA export supports ${REF2VA_LIMITS.minDuration}–${REF2VA_LIMITS.maxDuration} seconds.`,
      diagnostics,
    }
  }

  const prompt = compileRef2VAPrompt(project, shot)
  const unresolved = unresolvedPromptLabels(project, shot)
  const dangling = [...unresolved.pictures, ...unresolved.videos, ...unresolved.audios, ...unresolved.subjects]
  if (dangling.length) {
    return { ok: false, reason: `Unresolved prompt labels: ${dangling.join(', ')}.`, diagnostics: dangling }
  }

  if (promptNode) setNamed(promptNode, 'value', prompt)
  setNamed(generation, 'prompt', prompt)
  if (durationNode) setNamed(durationNode, 'value', shot.duration)
  setNamed(generation, 'length', h3FrameLength(shot.duration))
  if (resolution) setNamed(resolution, 'aspect_ratio', aspectWidget(shot.aspectRatio))

  const manifest = manifestForShot(project, shot)
  const pictures = manifest.filter((item) => item.kind === 'image')
  const videos = manifest.filter((item) => item.kind === 'video')
  const audios = manifest.filter((item) => item.kind === 'audio')

  disconnectGenerationSlot(editor, 'ref_images.ref_image_0')
  disconnectGenerationSlot(editor, 'ref_images.ref_image_1')
  disconnectGenerationSlot(editor, 'ref_images.ref_image_2')
  disconnectGenerationSlot(editor, 'ref_videos.ref_video_0')
  disconnectGenerationSlot(editor, 'ref_video_audios.ref_video_audio_0')
  disconnectGenerationSlot(editor, 'ref_audios.ref_audio_0')

  const imageLoaders = asNodes(editor).filter((node) => node.type === 'LoadImage')
  const keepImages = new Set<number>()
  pictures.forEach((item, index) => {
    const slot = item.slot
    const inputIndex = ensureInput(generation, slot, 'IMAGE', `ref_image_${index}`)
    const filename = item.mediaAssigned ? item.exportFilename : ''
    const loader = imageLoaders[index] ?? addLoadImage(editor, filename, -1050 + index * 320, 5960 + Math.floor(index / 3) * 360, item.loaderTitle)
    loader.title = item.loaderTitle
    setNamed(loader, 'image', filename)
    keepImages.add(loader.id)
    connect(editor, loader, 0, generation, inputIndex, 'IMAGE')
    item.loaderNodeId = loader.id
  })
  pruneUnusedImageLoaders(editor, keepImages)

  videos.forEach((item, index) => {
    const videoSlot = item.slot
    const videoIndex = ensureInput(generation, videoSlot, 'IMAGE', `ref_video_${index}`)
    const filename = item.mediaAssigned ? item.exportFilename : ''
    const loader = addLoadVideo(editor, filename, -1490, 5200 + index * 220, item.loaderTitle)
    const split = addGetVideoComponents(editor, -1180, 5200 + index * 220)
    connect(editor, loader, 0, split, 0, 'VIDEO')
    connect(editor, split, 0, generation, videoIndex, 'IMAGE')
    if (item.pairedVideoSlot) {
      const audioIndex = ensureInput(generation, item.pairedVideoSlot, 'AUDIO', `ref_video_audio_${index}`)
      connect(editor, split, 1, generation, audioIndex, 'AUDIO')
    }
    item.loaderNodeId = loader.id
  })

  audios.forEach((item, index) => {
    const inputIndex = ensureInput(generation, item.slot, 'AUDIO', `ref_audio_${index}`)
    const filename = item.mediaAssigned ? item.exportFilename : ''
    const loader = addLoadAudio(editor, filename, -1490, 4700 + index * 160, item.loaderTitle)
    connect(editor, loader, 0, generation, inputIndex, 'AUDIO')
    item.loaderNodeId = loader.id
  })

  const leftover = TEMPLATE_EXAMPLE_IMAGES.filter((name) => {
    const slots = ['ref_images.ref_image_0', 'ref_images.ref_image_1', 'ref_images.ref_image_2', 'ref_images.ref_image_3']
    return slots.some((slot) => connectedFilename(editor, slot) === name)
  })
  if (leftover.length) {
    return { ok: false, reason: `Template example images remain connected: ${leftover.join(', ')}.`, diagnostics: leftover }
  }

  const missingConnections: string[] = []
  manifest.forEach((item) => {
    if (!generationInput(editor, item.slot)?.link) missingConnections.push(`${item.comfyTag} is not connected to ${item.slot}.`)
    if (item.kind === 'video' && item.pairedVideoSlot && !generationInput(editor, item.pairedVideoSlot)?.link) {
      missingConnections.push(`${item.comfyTag} soundtrack is not connected to ${item.pairedVideoSlot}.`)
    }
    const connected = connectedFilename(editor, item.slot)
    const expected = item.mediaAssigned ? item.exportFilename : ''
    if (connected !== expected && !(expected === '' && connected === '')) {
      missingConnections.push(`${item.comfyTag} loader is not connected to ${item.slot}.`)
    }
  })
  if (missingConnections.length) {
    return { ok: false, reason: missingConnections[0], diagnostics: missingConnections }
  }

  asNodes(editor).forEach((node) => {
    if (node.type === 'LoadImage') {
      const name = String(node.widgets_values_named?.image ?? '')
      if (EXAMPLE_IMAGES.has(name) && node.outputs?.some((output) => (output.links ?? []).length > 0)) {
        missingConnections.push(`Example image ${name} is still an active graph input.`)
      }
    }
  })
  if (missingConnections.length) return { ok: false, reason: missingConnections[0], diagnostics: missingConnections }

  const leftoverLoaders = exampleImagesStillConnected(editor)
  if (leftoverLoaders.length) {
    return { ok: false, reason: `Template example images remain connected: ${leftoverLoaders.join(', ')}.`, diagnostics: leftoverLoaders }
  }

  const integrity = graphIntegrity(editor)
  if (!integrity.ok) return { ok: false, reason: integrity.problems[0], diagnostics: integrity.problems }

  const api = toApiFormat(editor)
  if (!api.ok) return { ok: false, reason: api.reason, diagnostics: [...diagnostics, api.reason] }

  const generationId = Object.keys(api.api).find((id) => api.api[id].class_type === GENERATION)
  if (!generationId) return { ok: false, reason: `API conversion lost ${GENERATION}.`, diagnostics }
  manifest.forEach((item) => {
    const linked = api.api[generationId].inputs[item.slot]
    if (!Array.isArray(linked) || linked.length < 2) {
      missingConnections.push(`API graph does not link ${item.comfyTag} into ${item.slot}.`)
    }
    if (item.kind === 'video' && item.pairedVideoSlot) {
      const audioLinked = api.api[generationId].inputs[item.pairedVideoSlot]
      if (!Array.isArray(audioLinked)) missingConnections.push(`API graph does not link ${item.comfyTag} into ${item.pairedVideoSlot}.`)
    }
  })
  if (missingConnections.length) return { ok: false, reason: missingConnections[0], diagnostics: missingConnections }

  if (!manifest.some((item) => item.mediaAssigned)) {
    diagnostics.push('Open this workflow in ComfyUI and select the actual media in each titled loader node. A2 does not store reference files.')
  }
  diagnostics.push('TEMPLATE READY: graph structure is valid. Not execution-ready. MiniMax inference has not been run.')
  return {
    ok: true,
    readiness: 'template',
    executionReady: false,
    editor,
    api: api.api,
    diagnostics,
    warnings,
    manifest,
    prompt,
    executed: false,
  }
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
