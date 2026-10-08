import { Copy, Plus, Trash2 } from 'lucide-react'
import { Section, Segmented, SliderField } from '@/components/controls/fields'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { ASPECT_RATIOS, LENS_PRESETS } from '@/lib/constants'
import { copyText } from '@/lib/copy'
import { evaluateCamera } from '@/motion/lib/interpolation'
import { snapshotProject } from '@/motion/lib/projectSnapshot'
import { compileRef2VAPrompt, compileShotCode } from '@/motion/lib/promptCompiler'
import { manifestForShot, resolveShotTags, validateReferenceLimits } from '@/motion/lib/references'
import { bindSingleShotWorkflow, compileMasterWorkflow } from '@/motion/lib/workflow'
import { MOTION_OBJECT_KINDS, REF2VA_LIMITS, type MotionObjectKind, type MotionReferenceRole } from '@/motion/types'
import { useMotionStore } from '@/store/motionStore'
import type { AspectRatio } from '@/types/scene'
import { useState } from 'react'

const ROLES: { value: MotionReferenceRole; label: string }[] = [
  { value: 'identity', label: 'Identity' },
  { value: 'appearance', label: 'Look' },
  { value: 'environment', label: 'Environment' },
  { value: 'object', label: 'Object' },
  { value: 'motion', label: 'Motion' },
  { value: 'camera', label: 'Camera' },
  { value: 'shot', label: 'Shot' },
  { value: 'edit-source', label: 'Edit' },
  { value: 'audio', label: 'Audio' },
  { value: 'voice', label: 'Voice' },
]

export function MotionInspector() {
  return (
    <aside className="border-line xl:h-full xl:w-[340px] xl:shrink-0 xl:overflow-y-auto xl:border-l xl:pl-3">
      <div className="space-y-3 pb-8">
        <ShotList />
        <SceneControls />
        <ObjectsPanel />
        <LightsPanel />
        <CameraPanel />
        <ReferencesPanel />
        <PromptPanel />
        <ExportPanel />
      </div>
    </aside>
  )
}

function ShotList() {
  const shots = useMotionStore((state) => state.shots)
  const active = useMotionStore((state) => state.activeShotId)
  const current = shots.find((shot) => shot.id === active)
  return (
    <Section title="Shots">
      <div className="space-y-1.5">
        {shots.map((shot) => (
          <button
            key={shot.id}
            type="button"
            onClick={() => useMotionStore.getState().selectShot(shot.id)}
            className={`flex w-full items-center justify-between rounded-md border px-2 py-1.5 text-left text-xs ${shot.id === active ? 'border-accent/50 bg-accent/8' : 'border-line'}`}
          >
            {shot.name}
            <span className="text-[10px] text-faint">{shot.duration.toFixed(1)}s</span>
          </button>
        ))}
      </div>
      {current && (
        <input
          value={current.name}
          onChange={(event) => useMotionStore.getState().renameShot(current.id, event.target.value)}
          className="w-full rounded-md border border-line bg-panel px-2 py-1 text-xs text-ink"
        />
      )}
      <div className="flex flex-wrap gap-1">
        <Button type="button" size="sm" variant="outline" onClick={() => useMotionStore.getState().addShot()}>
          <Plus className="size-3.5" /> Add
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => useMotionStore.getState().duplicateShot(active)}>
          Duplicate
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => useMotionStore.getState().reorderShot(active, -1)}>
          Up
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => useMotionStore.getState().reorderShot(active, 1)}>
          Down
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={shots.length <= 1} onClick={() => useMotionStore.getState().deleteShot(active)}>
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </Section>
  )
}

function SceneControls() {
  const shot = useMotionStore((state) => state.shots.find((item) => item.id === state.activeShotId))
  if (!shot) return null
  return (
    <Section title="Scene">
      <Segmented
        value={shot.sourceMode}
        options={[
          { value: 'build-3d', label: 'Build in 3D' },
          { value: 'import-video', label: 'Import video' },
        ]}
        onChange={(mode) => useMotionStore.getState().setSourceMode(mode)}
      />
      <p className="text-[11px] leading-relaxed text-faint">
        An imported video is a motion, camera, composition, or edit reference. The app does not rebuild a 3D environment from it.
      </p>
      <div className="flex flex-wrap gap-1">
        {MOTION_OBJECT_KINDS.map((kind) => (
          <button
            key={kind.value}
            type="button"
            className="rounded-md bg-white/5 px-2 py-1 text-[11px] text-muted hover:text-ink"
            onClick={() => useMotionStore.getState().addObject(kind.value as MotionObjectKind)}
          >
            {kind.label}
          </button>
        ))}
      </div>
      <SliderField
        label="Duration"
        value={shot.duration}
        min={REF2VA_LIMITS.minDuration}
        max={REF2VA_LIMITS.maxDuration}
        step={0.5}
        display={`${shot.duration.toFixed(1)}s`}
        onChange={(value) => useMotionStore.getState().setDuration(value)}
      />
      <Segmented
        value={shot.aspectRatio}
        options={ASPECT_RATIOS.map((ratio) => ({ value: ratio, label: ratio }))}
        onChange={(ratio: AspectRatio) => useMotionStore.getState().setAspectRatio(ratio)}
      />
    </Section>
  )
}

function ObjectsPanel() {
  const shot = useMotionStore((state) => state.shots.find((item) => item.id === state.activeShotId))
  const selection = useMotionStore((state) => state.selection)
  if (!shot) return null
  return (
    <Section title="Objects">
      <div className="space-y-1">
        {shot.objects.map((object) => (
          <div key={object.id} className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => useMotionStore.getState().setSelection({ kind: 'object', id: object.id })}
              className={`flex-1 truncate rounded-md px-2 py-1 text-left text-[11px] ${selection.kind === 'object' && selection.id === object.id ? 'bg-accent/18 text-accent' : 'bg-white/5 text-muted'}`}
            >
              {object.name}
            </button>
            <button type="button" className="text-[10px] text-muted" onClick={() => useMotionStore.getState().insertObjectKeyframe(object.id)}>
              Key
            </button>
            <button type="button" className="text-[10px] text-danger" onClick={() => useMotionStore.getState().removeObject(object.id)}>
              ×
            </button>
          </div>
        ))}
      </div>
    </Section>
  )
}

function LightsPanel() {
  const shot = useMotionStore((state) => state.shots.find((item) => item.id === state.activeShotId))
  const selection = useMotionStore((state) => state.selection)
  if (!shot) return null
  return (
    <Section title="Lights">
      {shot.lights.map((light) => (
        <div key={light.id} className="space-y-2 rounded-md border border-line p-2">
          <button
            type="button"
            className={`text-[11px] ${selection.kind === 'light' && selection.id === light.id ? 'text-accent' : 'text-ink'}`}
            onClick={() => useMotionStore.getState().setSelection({ kind: 'light', id: light.id })}
          >
            {light.name}
          </button>
          <label className="flex items-center justify-between gap-2 text-[11px] text-muted">
            Enabled
            <Switch checked={light.enabled} onCheckedChange={(enabled) => useMotionStore.getState().updateLight(light.id, { enabled })} />
          </label>
          <label className="flex items-center justify-between gap-2 text-[11px] text-muted">
            Movable
            <Switch checked={light.movable} onCheckedChange={(movable) => useMotionStore.getState().updateLight(light.id, { movable })} />
          </label>
          <SliderField
            label="Intensity"
            value={light.intensity}
            min={0}
            max={100}
            step={1}
            display={`${Math.round(light.intensity)}`}
            onChange={(intensity) => useMotionStore.getState().updateLight(light.id, { intensity })}
          />
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" disabled={shot.lights.length >= 3} onClick={() => useMotionStore.getState().addLight()}>
        Add light
      </Button>
    </Section>
  )
}

function CameraPanel() {
  const shot = useMotionStore((state) => state.shots.find((item) => item.id === state.activeShotId))
  const selected = useMotionStore((state) => state.selection.kind === 'camera' || state.selection.kind === 'target')
  if (!shot) return null
  const focal = Math.round(evaluateCamera(shot.cameraKeys, shot.currentTime).focalLength)
  const preset = LENS_PRESETS.find((lens) => lens === focal)
  return (
    <Section title="Camera" active={selected}>
      <Segmented
        value={preset ? String(preset) : 'custom'}
        options={[...LENS_PRESETS.map((lens) => ({ value: String(lens), label: String(lens) })), { value: 'custom', label: 'Custom' }]}
        onChange={(value) => {
          if (value === 'custom') return
          useMotionStore.getState().setFocalLength(Number(value))
        }}
      />
      <SliderField label="Focal length" value={focal} min={18} max={200} step={1} display={`${focal}mm`} onChange={(value) => useMotionStore.getState().setFocalLength(value)} />
      <label className="flex items-center justify-between gap-2 text-[11px] text-muted">
        Track target
        <Switch checked={shot.trackTarget} onCheckedChange={(value) => useMotionStore.getState().setTrackTarget(value)} />
      </label>
      <p className="text-[11px] text-faint">{shot.cameraKeys.length} camera keys. Scrub the timeline, then Key camera.</p>
    </Section>
  )
}

function ReferencesPanel() {
  const references = useMotionStore((state) => state.references)
  const shot = useMotionStore((state) => state.shots.find((item) => item.id === state.activeShotId))
  const project = snapshotProject(useMotionStore.getState())
  const limits = shot ? validateReferenceLimits(project, shot) : null
  const tags = shot ? resolveShotTags(project, shot) : []

  return (
    <Section title="References">
      <label className="block rounded-md border border-dashed border-line px-2 py-2 text-[11px] text-muted">
        Add image, video, or audio
        <input
          type="file"
          accept="image/*,video/*,audio/*"
          className="mt-1 block w-full text-[10px]"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void ingestFile(file)
            event.target.value = ''
          }}
        />
      </label>
      {limits && !limits.ok && (
        <p className="text-[11px] text-danger">{limits.problems.join(' ')}</p>
      )}
      <div className="space-y-2">
        {references.map((reference) => {
          const bound = shot?.bindings.some((item) => item.referenceId === reference.id)
          const tag = tags.find((item) => item.reference.id === reference.id)?.tag
          return (
            <div key={reference.id} className="rounded-md border border-line p-2 text-[11px]">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-ink">{reference.name}</span>
                <span className="font-mono text-faint">{tag ?? reference.kind}</span>
              </div>
              <select
                value={reference.role}
                className="mt-1 w-full rounded-md border border-line bg-panel px-1 py-1 text-[11px]"
                onChange={(event) => useMotionStore.getState().updateReference(reference.id, { role: event.target.value as MotionReferenceRole })}
              >
                {ROLES.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
              <div className="mt-1 flex flex-wrap gap-1">
                <button type="button" className="text-accent" onClick={() => useMotionStore.getState().bindReference({ referenceId: reference.id, retention: 'fully_preserved' })}>
                  {bound ? 'Bound' : 'Bind to shot'}
                </button>
                {reference.kind === 'video' && (
                  <button type="button" className="text-muted" onClick={() => useMotionStore.getState().setImportedVideo(reference.id)}>
                    Use as source
                  </button>
                )}
                <button type="button" className="text-muted" onClick={() => useMotionStore.getState().unbindReference(reference.id)}>
                  Unbind
                </button>
                <button type="button" className="ml-auto text-danger" onClick={() => useMotionStore.getState().removeReference(reference.id)}>
                  Remove
                </button>
              </div>
            </div>
          )
        })}
      </div>
      {shot?.importedVideo && <ImportedTrim />}
    </Section>
  )
}

function ImportedTrim() {
  const shot = useMotionStore((state) => state.shots.find((item) => item.id === state.activeShotId))
  const imported = shot?.importedVideo
  if (!shot || !imported) return null
  return (
    <div className="space-y-2">
      <Segmented
        value={imported.role}
        options={[
          { value: 'motion', label: 'Motion' },
          { value: 'camera', label: 'Camera' },
          { value: 'shot', label: 'Shot' },
          { value: 'edit-source', label: 'Edit' },
          { value: 'appearance', label: 'Look' },
        ]}
        onChange={(role) => useMotionStore.getState().setImportedRole(role)}
      />
      <SliderField label="Trim start" value={imported.trimStart} min={0} max={Math.max(0.1, imported.trimEnd - 0.1)} step={0.05} display={`${imported.trimStart.toFixed(2)}s`} onChange={(value) => useMotionStore.getState().setImportedTrim(value, imported.trimEnd)} />
      <SliderField label="Trim end" value={imported.trimEnd} min={imported.trimStart + 0.1} max={30} step={0.05} display={`${imported.trimEnd.toFixed(2)}s`} onChange={(value) => useMotionStore.getState().setImportedTrim(imported.trimStart, value)} />
    </div>
  )
}

function PromptPanel() {
  const shot = useMotionStore((state) => state.shots.find((item) => item.id === state.activeShotId))
  const version = useMotionStore((state) => `${state.activeShotId}:${state.updatedAt}:${state.shots.length}:${state.references.length}`)
  if (!shot) return null
  const project = snapshotProject(useMotionStore.getState())
  const prompt = compileRef2VAPrompt(project, shot)
  const code = compileShotCode(project, shot)
  return (
    <Section title="Prompt">
      <textarea key={version} readOnly value={prompt} className="h-48 w-full resize-none rounded-md border border-line bg-panel p-2 text-[11px] leading-relaxed text-ink" />
      <p className="truncate font-mono text-[10px] text-faint">{code}</p>
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={() => void copyText(prompt)}>
          <Copy className="size-3.5" /> Copy prompt
        </Button>
      </div>
      <textarea
        value={shot.notes.action}
        onChange={(event) => useMotionStore.getState().setNotes({ action: event.target.value })}
        placeholder="Optional action notes. Do not invent dialogue."
        className="h-16 w-full resize-none rounded-md border border-line bg-panel p-2 text-[11px] text-ink"
      />
    </Section>
  )
}

function ExportPanel() {
  const [message, setMessage] = useState('')
  const [customWorkflow, setCustomWorkflow] = useState<unknown>(null)
  return (
    <Section title="Export">
      <div className="flex flex-wrap gap-1">
        <Button type="button" size="sm" variant="outline" onClick={() => download('a2-motion-project.json', JSON.stringify(useMotionStore.getState().serialized(), null, 2))}>
          Project JSON
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => exportShot()}>
          Shot JSON
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => exportPrompt()}>
          Prompt
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => exportManifest()}>
          Manifest
        </Button>
        <Button type="button" size="sm" onClick={() => setMessage(exportWorkflow(customWorkflow))}>
          ComfyUI workflow
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setMessage(compileMasterWorkflow().reason)}>
          Master workflow
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => void exportGuideVideo().then(setMessage)}>
          Guide video
        </Button>
      </div>
      <Label className="block text-[11px]">
        Import project JSON
        <input
          type="file"
          accept="application/json,.json"
          className="mt-1 block w-full text-[10px]"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void importProjectFile(file).then(setMessage)
            event.target.value = ''
          }}
        />
      </Label>
      <Label className="block text-[11px]">
        Optional custom ComfyUI workflow
        <input
          type="file"
          accept="application/json,.json"
          className="mt-1 block w-full text-[10px]"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (!file) return
            void file.text().then((text) => {
              try {
                const parsed = JSON.parse(text) as unknown
                setCustomWorkflow(parsed)
                useMotionStore.getState().setWorkflow({
                  source: 'imported',
                  filename: file.name,
                  generationNodeType: 'MiniMaxH3ReferenceToVideo',
                })
                setMessage(`Loaded ${file.name}. Export will bind this graph if it contains MiniMaxH3ReferenceToVideo.`)
              } catch {
                setMessage('Custom workflow JSON could not be parsed.')
              }
            })
            event.target.value = ''
          }}
        />
      </Label>
      {message && <p className="text-[11px] leading-relaxed text-faint">{message}</p>}
    </Section>
  )
}

function download(filename: string, text: string, type = 'application/json') {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function activeProject() {
  return snapshotProject(useMotionStore.getState())
}

function exportShot() {
  const project = activeProject()
  const shot = project.shots.find((item) => item.id === project.activeShotId)
  if (!shot) return
  const references = project.references.filter((item) => shot.bindings.some((binding) => binding.referenceId === item.id) || shot.importedVideo?.referenceId === item.id)
  download(`${shot.name.replace(/\s+/g, '-').toLowerCase()}.json`, JSON.stringify({ shot: { ...shot, compiledPrompt: compileRef2VAPrompt(project, shot) }, references }, null, 2))
}

function exportPrompt() {
  const project = activeProject()
  const shot = project.shots.find((item) => item.id === project.activeShotId)
  if (!shot) return
  download(`${shot.id}-ref2va.txt`, compileRef2VAPrompt(project, shot), 'text/plain')
}

function exportManifest() {
  const project = activeProject()
  const shot = project.shots.find((item) => item.id === project.activeShotId)
  if (!shot) return
  download(`${shot.id}-manifest.json`, JSON.stringify(manifestForShot(project, shot), null, 2))
}

function exportWorkflow(template: unknown) {
  const project = activeProject()
  const shot = project.shots.find((item) => item.id === project.activeShotId)
  if (!shot) return 'No active shot.'
  const result = bindSingleShotWorkflow(project, shot, template ?? undefined)
  if (!result.ok) return result.reason
  download(`${shot.id}-minimax-h3-r2v.json`, JSON.stringify(result.editor, null, 2))
  download(`${shot.id}-minimax-h3-r2v.api.json`, JSON.stringify(result.api, null, 2))
  return `Single-shot official Ref2VA graph exported. ${result.diagnostics.join(' ')} Not executed in ComfyUI.`
}

async function importProjectFile(file: File) {
  try {
    const parsed = JSON.parse(await file.text()) as unknown
    const error = useMotionStore.getState().importProject(parsed)
    return error ?? `Loaded ${file.name}.`
  } catch {
    return 'Project JSON could not be parsed.'
  }
}

async function exportGuideVideo() {
  const canvas = document.querySelector('[data-motion-preview] canvas')
  if (!(canvas instanceof HTMLCanvasElement)) {
    return 'Guide video needs the 3D shot preview. Switch the shot to Build in 3D, then try again. Import-video mode shows the uploaded clip instead of a recordable WebGL canvas.'
  }
  if (typeof MediaRecorder === 'undefined' || typeof canvas.captureStream !== 'function') {
    return 'Guide video export is unsupported in this browser (MediaRecorder / captureStream missing).'
  }
  const mime = ['video/webm;codecs=vp9', 'video/webm'].find((type) => MediaRecorder.isTypeSupported(type))
  if (!mime) return 'Guide video export is unsupported: no WebM MediaRecorder type.'

  const shot = useMotionStore.getState().shots.find((item) => item.id === useMotionStore.getState().activeShotId)
  if (!shot) return 'No active shot.'
  useMotionStore.getState().setCurrentTime(0)
  useMotionStore.getState().setPlaying(true)
  const stream = canvas.captureStream(24)
  const recorder = new MediaRecorder(stream, { mimeType: mime })
  const chunks: Blob[] = []
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data)
  }
  const done = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mime }))
    recorder.onerror = () => reject(new Error('MediaRecorder failed'))
  })
  recorder.start()
  await wait(Math.min(shot.duration, 15) * 1000 + 80)
  if (recorder.state !== 'inactive') recorder.stop()
  useMotionStore.getState().setPlaying(false)
  const blob = await done
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${shot.id}-guide.webm`
  link.click()
  URL.revokeObjectURL(url)
  return `Guide video saved (${(blob.size / 1024).toFixed(0)} KB). This is a 3D motion guide, not a MiniMax render.`
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

async function ingestFile(file: File) {
  const dataUrl = await readFile(file)
  const kind = file.type.startsWith('video') ? 'video' : file.type.startsWith('audio') ? 'audio' : 'image'
  const role: MotionReferenceRole = kind === 'audio' ? 'voice' : kind === 'video' ? 'motion' : 'identity'
  useMotionStore.getState().addReference({
    kind,
    name: file.name,
    filename: file.name,
    mime: file.type,
    dataUrl,
    role,
    description: '',
    trimStart: 0,
    trimEnd: kind === 'video' ? 8 : 0,
  })
  if (kind === 'video' && useMotionStore.getState().shots.find((item) => item.id === useMotionStore.getState().activeShotId)?.sourceMode === 'import-video') {
    const created = useMotionStore.getState().references.at(-1)
    if (created) useMotionStore.getState().setImportedVideo(created.id)
  }
}

function readFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
