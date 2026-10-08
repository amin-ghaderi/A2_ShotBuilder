import { snapshotProject } from '@/motion/lib/projectSnapshot'
import { compileRef2VAPrompt } from '@/motion/lib/promptCompiler'
import { bindSingleShotWorkflow, type WorkflowExportResult } from '@/motion/lib/workflow'
import { buildZip, dataUrlToBytes, textBytes, type ZipEntry } from '@/motion/lib/zip'
import type { MotionProject, MotionShot } from '@/motion/types'

type BoundWorkflow = Extract<WorkflowExportResult, { ok: true }>

export function buildSlotManifest(shot: MotionShot, bound: BoundWorkflow) {
  return {
    shot: shot.id,
    shotName: shot.name,
    target: 'MiniMax-H3-Ref2VA',
    status: bound.manifest.every((item) => item.mediaAssigned) ? 'media_present' : 'awaiting_media',
    readiness: bound.readiness,
    executionReady: bound.executionReady,
    executed: bound.executed,
    slots: bound.manifest.map((item) => ({
      slotId: item.slotId,
      owner: item.ownerName,
      ownerType: item.ownerType,
      ownerId: item.ownerId,
      type: item.kind,
      modality: item.modality,
      role: item.role,
      promptLabel: item.comfyTag,
      comfyInput: item.slot,
      audioFamily: item.audioFamily,
      loaderClass: item.loaderClass,
      loaderTitle: item.loaderTitle,
      loaderNodeId: item.loaderNodeId,
      mediaAssigned: item.mediaAssigned,
      durationVerified: item.durationVerified,
    })),
  }
}

export type ExportPackageResult =
  | {
      ok: true
      blob: Blob
      files: ZipEntry[]
      filenames: string[]
      prompt: string
      diagnostics: string[]
      executed: false
      executionReady: false
      readiness: 'template'
    }
  | { ok: false; reason: string; diagnostics: string[] }

const README = `A2 MotionBuilder — MiniMax H3 Ref2VA template

Status: TEMPLATE READY. Not execution-ready. MiniMax inference has not been run.

This archive is a structurally assembled ComfyUI graph. Loader nodes are titled by shot, owner, prompt label, and role. Select the actual media in those loaders inside ComfyUI.

Contents
- workflow.json          ComfyUI editor graph
- workflow.api.json      API /prompt format (not runnable until media are assigned)
- prompt-ref2va.txt      Official six-section Ref2VA prompt
- manifest.json          Slot IDs ↔ prompt labels ↔ loader nodes
- project.json           A2 motion project
- shot.json              Active shot
- validation.json        Template-ready report

How to run
1. Open workflow.json in ComfyUI (File → Open).
2. On each titled LoadImage / LoadVideo / LoadAudio node, choose the real file.
3. Validate, then queue.

A2 does not store or install reference files. A browser download does not copy media into ComfyUI.
`

export function buildSingleShotPackage(project: MotionProject, shot: MotionShot, template?: unknown): ExportPackageResult {
  const bound = bindSingleShotWorkflow(project, shot, template)
  if (!bound.ok) return { ok: false, reason: bound.reason, diagnostics: bound.diagnostics }

  const files: ZipEntry[] = []
  const push = (path: string, data: Uint8Array) => files.push({ path, data })
  push('workflow.json', textBytes(JSON.stringify(bound.editor, null, 2)))
  push('workflow.api.json', textBytes(JSON.stringify(bound.api, null, 2)))
  push('prompt-ref2va.txt', textBytes(bound.prompt))
  push(
    'manifest.json',
    textBytes(
      JSON.stringify(buildSlotManifest(shot, bound), null, 2),
    ),
  )
  push('project.json', textBytes(JSON.stringify(snapshotProject(project), null, 2)))
  push(
    'shot.json',
    textBytes(JSON.stringify({ shot: { ...shot, compiledPrompt: compileRef2VAPrompt(project, shot) } }, null, 2)),
  )
  push(
    'validation.json',
    textBytes(
      JSON.stringify(
        {
          ok: true,
          readiness: 'template',
          executionReady: false,
          executed: false,
          durationSeconds: shot.duration,
          diagnostics: bound.diagnostics,
          warnings: bound.warnings,
        },
        null,
        2,
      ),
    ),
  )
  push('README.txt', textBytes(README))
  bound.manifest.forEach((item) => {
    if (item.dataUrl && item.exportFilename) push(`media/${item.exportFilename}`, dataUrlToBytes(item.dataUrl))
  })

  const mediaNames = bound.manifest.filter((item) => item.mediaAssigned).map((item) => item.exportFilename)
  const loaderNames = (bound.editor.nodes ?? [])
    .filter((node) => node.type === 'LoadImage' || node.type === 'LoadVideo' || node.type === 'LoadAudio')
    .map((node) => {
      const named = (node.widgets_values_named ?? {}) as Record<string, unknown>
      return String(named.image ?? named.file ?? named.audio ?? '')
    })
    .filter(Boolean)
  const mismatch = loaderNames.filter((name) => !mediaNames.includes(name))
  if (mismatch.length) {
    return {
      ok: false,
      reason: `Loader filenames are missing from the media package: ${mismatch.join(', ')}.`,
      diagnostics: mismatch,
    }
  }

  return {
    ok: true,
    blob: buildZip(files),
    files,
    filenames: files.map((item) => item.path),
    prompt: bound.prompt,
    diagnostics: bound.diagnostics,
    executed: false,
    executionReady: false,
    readiness: 'template',
  }
}
