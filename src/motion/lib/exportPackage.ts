import { snapshotProject } from '@/motion/lib/projectSnapshot'
import { compileRef2VAPrompt } from '@/motion/lib/promptCompiler'
import { bindSingleShotWorkflow } from '@/motion/lib/workflow'
import { buildZip, dataUrlToBytes, textBytes, type ZipEntry } from '@/motion/lib/zip'
import type { MotionProject, MotionShot } from '@/motion/types'

export type ExportPackageResult =
  | {
      ok: true
      blob: Blob
      files: ZipEntry[]
      filenames: string[]
      prompt: string
      diagnostics: string[]
      executed: false
    }
  | { ok: false; reason: string; diagnostics: string[] }

const README = `A2 MotionBuilder — MiniMax H3 Ref2VA single-shot package

This archive is a structurally assembled ComfyUI graph. It is not a completed MiniMax render and has not been queued for inference.

Contents
- workflow.json          ComfyUI editor graph
- workflow.api.json      ComfyUI API /prompt format
- prompt-ref2va.txt      Official six-section Ref2VA prompt
- manifest.json          Prompt labels ↔ loader filenames ↔ node slots
- project.json           Full A2 motion project
- shot.json              Active shot plus bound references
- validation.json        Fail-closed checks used for this export
- media/                 Reference files named exactly as the LoadImage / LoadVideo / LoadAudio widgets

Before running in ComfyUI
1. Copy every file in media/ into your ComfyUI input directory, or upload each file through the corresponding node's upload widget.
2. A browser download does not install those files into ComfyUI.
3. Open workflow.json (File → Open). Confirm widget filenames match manifest.json.
4. Queue the prompt only after the media files are visible to that ComfyUI instance.

LoadVideo, GetVideoComponents, and LoadAudio are official comfy-core classes. If your ComfyUI build lacks them, this graph cannot run — do not invent substitute nodes.
`

export function buildSingleShotPackage(project: MotionProject, shot: MotionShot, template?: unknown): ExportPackageResult {
  const bound = bindSingleShotWorkflow(project, shot, template)
  if (!bound.ok) return { ok: false, reason: bound.reason, diagnostics: bound.diagnostics }

  const missingMedia = bound.manifest.filter((item) => !item.dataUrl)
  if (missingMedia.length) {
    return {
      ok: false,
      reason: `${missingMedia[0].comfyTag} has no packed media bytes. Re-upload the file before export.`,
      diagnostics: missingMedia.map((item) => item.comfyTag),
    }
  }

  const files: ZipEntry[] = []
  const push = (path: string, data: Uint8Array) => files.push({ path, data })
  push('workflow.json', textBytes(JSON.stringify(bound.editor, null, 2)))
  push('workflow.api.json', textBytes(JSON.stringify(bound.api, null, 2)))
  push('prompt-ref2va.txt', textBytes(bound.prompt))
  push(
    'manifest.json',
    textBytes(
      JSON.stringify(
        bound.manifest.map((item) => ({
          assetId: item.assetId,
          filename: item.filename,
          exportFilename: item.exportFilename,
          mime: item.mime,
          kind: item.kind,
          role: item.role,
          comfyTag: item.comfyTag,
          slot: item.slot,
          audioFamily: item.audioFamily,
          loaderClass: item.loaderClass,
          pairedVideoSlot: item.pairedVideoSlot,
          trimStart: item.trimStart,
          trimEnd: item.trimEnd,
        })),
        null,
        2,
      ),
    ),
  )
  push('project.json', textBytes(JSON.stringify(snapshotProject(project), null, 2)))
  push(
    'shot.json',
    textBytes(
      JSON.stringify(
        {
          shot: { ...shot, compiledPrompt: compileRef2VAPrompt(project, shot) },
          references: project.references.filter((item) => shot.bindings.some((binding) => binding.referenceId === item.id)),
        },
        null,
        2,
      ),
    ),
  )
  push(
    'validation.json',
    textBytes(
      JSON.stringify(
        {
          ok: true,
          executed: false,
          readyLabel: 'structurally-validated',
          durationSeconds: shot.duration,
          h3FrameLengthNote: 'length is computed in-graph by the official ComfyMathExpression using Python modulo.',
          media: bound.manifest.map((item) => ({
            tag: item.comfyTag,
            slot: item.slot,
            audioFamily: item.audioFamily,
            loaderClass: item.loaderClass,
            exportFilename: item.exportFilename,
            packagePath: `media/${item.exportFilename}`,
          })),
          diagnostics: bound.diagnostics,
        },
        null,
        2,
      ),
    ),
  )
  push('README.txt', textBytes(README))
  bound.manifest.forEach((item) => {
    push(`media/${item.exportFilename}`, dataUrlToBytes(item.dataUrl))
  })

  const mediaNames = bound.manifest.map((item) => item.exportFilename)
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
  }
}
