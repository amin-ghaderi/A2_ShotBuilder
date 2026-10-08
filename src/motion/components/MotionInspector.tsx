import { Copy, Plus, Trash2 } from 'lucide-react'
import { Section, Segmented, SliderField } from '@/components/controls/fields'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { ASPECT_RATIOS, LENS_PRESETS } from '@/lib/constants'
import { copyText } from '@/lib/copy'
import { evaluateCamera } from '@/motion/lib/interpolation'
import { snapshotProject } from '@/motion/lib/projectSnapshot'
import { buildSingleShotPackage, buildSlotManifest } from '@/motion/lib/exportPackage'
import { compileRef2VAPrompt, compileShotCode } from '@/motion/lib/promptCompiler'
import { ownerNameForSlot, resolveShotTags, slotsForOwner, validateReferenceLimits } from '@/motion/lib/references'
import { bindSingleShotWorkflow, compileMasterWorkflow } from '@/motion/lib/workflow'
import { SecondsInput } from '@/motion/components/SecondsInput'
import {
  MOTION_OBJECT_KINDS,
  REF2VA_LIMITS,
  defaultRetentionFor,
  defaultRoleFor,
  rolesForModality,
  type MotionObjectKind,
  type MotionReferenceRole,
  type ReferenceModality,
  type ReferenceSlot,
  type RetentionMarker,
  type AudioRetentionMarker,
} from '@/motion/types'
import { useMotionStore } from '@/store/motionStore'
import type { AspectRatio } from '@/types/scene'
import { useEffect, useRef, useState } from 'react'

const ROLE_LABELS: Record<string, string> = {
  identity: 'Identity',
  appearance: 'Appearance',
  environment: 'Environment',
  object: 'Object',
  style: 'Style',
  'first-frame': 'First frame',
  'last-frame': 'Last frame',
  composition: 'Composition',
  motion: 'Action / movement',
  camera: 'Camera motion',
  shot: 'Shot',
  'edit-source': 'Source video edit',
  continuation: 'Video continuation',
  audio: 'Ambient / reuse',
  voice: 'Voice timbre',
  music: 'Music',
}

const VISUAL_RETENTION: { value: RetentionMarker | AudioRetentionMarker; label: string }[] = [
  { value: 'fully_preserved', label: 'fully_preserved' },
  { value: 'partially_preserved', label: 'partially_preserved' },
  { value: 'attribute_transfer', label: 'attribute_transfer' },
  { value: 'weak_reference', label: 'weak_reference' },
]

const AUDIO_RETENTION: { value: RetentionMarker | AudioRetentionMarker; label: string }[] = [
  { value: 'fully_copy', label: 'fully_copy' },
  { value: 'partially_copy', label: 'partially_copy' },
  { value: 'reference', label: 'reference' },
  { value: 'weak_reference', label: 'weak_reference' },
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
      {current && <ShotNameField key={current.id} shotId={current.id} name={current.name} />}
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

function ShotNameField({ shotId, name }: { shotId: string; name: string }) {
  const focused = useRef(false)
  const [draft, setDraft] = useState(name)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!focused.current) {
      setDraft(name)
      setError(null)
    }
  }, [name, shotId])

  const commit = () => {
    const trimmed = draft.trim()
    if (!trimmed) {
      setError('Shot name cannot be empty.')
      setDraft(name)
      return
    }
    setError(null)
    if (trimmed !== name) useMotionStore.getState().renameShot(shotId, trimmed)
    setDraft(trimmed)
  }

  return (
    <div className="space-y-1" onPointerDown={(event) => event.stopPropagation()}>
      <Label htmlFor={`motion-shot-name-${shotId}`}>Shot name</Label>
      <input
        id={`motion-shot-name-${shotId}`}
        type="text"
        autoComplete="off"
        spellCheck={false}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `motion-shot-name-${shotId}-error` : undefined}
        value={draft}
        onFocus={() => {
          focused.current = true
        }}
        onChange={(event) => {
          setDraft(event.target.value)
          setError(null)
        }}
        onBlur={() => {
          focused.current = false
          commit()
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            ;(event.target as HTMLInputElement).blur()
          }
        }}
        className="w-full rounded-md border border-line bg-panel px-2 py-1 text-xs text-ink"
      />
      {error && (
        <p id={`motion-shot-name-${shotId}-error`} className="text-[11px] text-danger">
          {error}
        </p>
      )}
    </div>
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
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="motion-shot-duration">Shot duration</Label>
          <SecondsInput
            id="motion-shot-duration"
            value={shot.duration}
            min={REF2VA_LIMITS.minDuration}
            max={REF2VA_LIMITS.maxDuration}
            digits={1}
            onCommit={(value) => useMotionStore.getState().setDuration(value)}
          />
        </div>
        <Slider
          value={[shot.duration]}
          min={REF2VA_LIMITS.minDuration}
          max={REF2VA_LIMITS.maxDuration}
          step={0.5}
          aria-label="Shot duration"
          onValueChange={([value]) => {
            if (typeof value === 'number') useMotionStore.getState().setDuration(value)
          }}
        />
        <p className="text-[11px] leading-relaxed text-faint">
          4.0–15.0s. Shortening keeps existing keys; only a key that sits on the previous shot end moves with duration.
        </p>
      </div>
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
  const shot = useMotionStore((state) => state.shots.find((item) => item.id === state.activeShotId))
  const selection = useMotionStore((state) => state.selection)
  const project = snapshotProject(useMotionStore.getState())
  if (!shot) return null
  const object = selection.kind === 'object' ? shot.objects.find((item) => item.id === selection.id) : undefined
  const limits = validateReferenceLimits(project, shot)
  const tags = resolveShotTags(project, shot)

  return (
    <Section title="References">
      <p className="text-[11px] leading-relaxed text-faint">
        Declare what MiniMax should read. Select the actual files later in the titled ComfyUI loader nodes. A2 does not store media.
      </p>
      {object ? (
        <SlotList
          key={object.id}
          heading={`References for ${object.name}`}
          ownerType="object"
          ownerId={object.id}
          slots={slotsForOwner(shot, 'object', object.id)}
          tags={tags}
          defaultModality="image"
        />
      ) : (
        <p className="text-[11px] text-muted">Select an object to assign object references.</p>
      )}
      <SlotList
        heading="Shot references"
        ownerType="shot"
        ownerId={shot.id}
        slots={slotsForOwner(shot, 'shot', shot.id)}
        tags={tags}
        defaultModality="video"
      />
      {limits.problems.length > 0 && <p className="text-[11px] text-danger">{limits.problems.join(' ')}</p>}
      {limits.warnings.length > 0 && <p className="text-[11px] text-faint">{limits.warnings.join(' ')}</p>}
    </Section>
  )
}

function SlotList({
  heading,
  ownerType,
  ownerId,
  slots,
  tags,
  defaultModality,
}: {
  heading: string
  ownerType: 'object' | 'shot'
  ownerId: string
  slots: ReferenceSlot[]
  tags: ReturnType<typeof resolveShotTags>
  defaultModality: ReferenceModality
}) {
  const [modality, setModality] = useState<ReferenceModality>(defaultModality)
  const roles = rolesForModality(modality)
  const [role, setRole] = useState<MotionReferenceRole>(defaultRoleFor(defaultModality))
  return (
    <div className="space-y-2">
      <h4 className="text-[10px] uppercase tracking-[0.14em] text-muted">{heading}</h4>
      <div className="flex flex-wrap gap-1">
        <select
          value={modality}
          className="rounded-md border border-line bg-panel px-1 py-1 text-[11px]"
          onChange={(event) => {
            const next = event.target.value as ReferenceModality
            setModality(next)
            setRole(defaultRoleFor(next))
          }}
        >
          <option value="image">Image</option>
          <option value="video">Video</option>
          <option value="video_with_audio">Video with audio</option>
          <option value="audio">Audio</option>
        </select>
        <select value={role} className="rounded-md border border-line bg-panel px-1 py-1 text-[11px]" onChange={(event) => setRole(event.target.value as MotionReferenceRole)}>
          {roles.map((item) => (
            <option key={item} value={item}>
              {ROLE_LABELS[item] ?? item}
            </option>
          ))}
        </select>
        <Button type="button" size="sm" variant="outline" onClick={() => useMotionStore.getState().addReferenceSlot({ ownerType, ownerId, modality, role })}>
          + Add reference slot
        </Button>
      </div>
      {slots.length === 0 && <p className="text-[11px] text-faint">No slots assigned.</p>}
      {slots.map((slot) => (
        <SlotCard key={slot.id} slot={slot} tag={tags.find((item) => item.slot.id === slot.id)} />
      ))}
    </div>
  )
}

function SlotCard({ slot, tag }: { slot: ReferenceSlot; tag?: ReturnType<typeof resolveShotTags>[number] }) {
  const shot = useMotionStore((state) => state.shots.find((item) => item.id === state.activeShotId))
  if (!shot) return null
  const roles = rolesForModality(slot.modality)
  const index = tag?.index ?? 0
  const destinations =
    slot.modality === 'audio'
      ? [`ref_audios.ref_audio_${Math.max(0, index - 1)}`]
      : slot.modality === 'image'
        ? [`ref_images.ref_image_${Math.max(0, index - 1)}`]
        : slot.modality === 'video_with_audio'
          ? [`ref_videos.ref_video_${Math.max(0, index - 1)}`, `ref_video_audios.ref_video_audio_${Math.max(0, index - 1)}`]
          : [`ref_videos.ref_video_${Math.max(0, index - 1)}`]
  const retentionOptions = slot.modality === 'audio' ? AUDIO_RETENTION : VISUAL_RETENTION
  return (
    <div className="space-y-1.5 rounded-md border border-line p-2 text-[11px]">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-ink">{ownerNameForSlot(shot, slot)}</span>
        <span className="font-mono text-faint">{tag?.tag ?? '—'}</span>
      </div>
      <p className="font-mono text-[10px] text-faint">{destinations.join(' · ')}</p>
      <p className="text-[10px] text-muted">Assign media in ComfyUI</p>
      <select
        value={slot.modality}
        className="w-full rounded-md border border-line bg-panel px-1 py-1"
        onChange={(event) => {
          const next = event.target.value as ReferenceModality
          const role = defaultRoleFor(next)
          useMotionStore.getState().updateReferenceSlot(slot.id, { modality: next, role, retention: defaultRetentionFor(role) })
        }}
      >
        <option value="image">Image</option>
        <option value="video">Video</option>
        <option value="video_with_audio">Video with audio</option>
        <option value="audio">Audio</option>
      </select>
      <select
        value={roles.includes(slot.role) ? slot.role : roles[0]}
        className="w-full rounded-md border border-line bg-panel px-1 py-1"
        onChange={(event) => useMotionStore.getState().updateReferenceSlot(slot.id, { role: event.target.value as MotionReferenceRole })}
      >
        {roles.map((item) => (
          <option key={item} value={item}>
            {ROLE_LABELS[item] ?? item}
          </option>
        ))}
      </select>
      <select
        value={retentionOptions.some((item) => item.value === slot.retention) ? slot.retention : retentionOptions[0].value}
        className="w-full rounded-md border border-line bg-panel px-1 py-1"
        onChange={(event) => useMotionStore.getState().updateReferenceSlot(slot.id, { retention: event.target.value as RetentionMarker | AudioRetentionMarker })}
      >
        {retentionOptions.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
      <input
        value={slot.description}
        placeholder="Optional semantic notes"
        className="w-full rounded-md border border-line bg-panel px-1 py-1 text-[11px]"
        onChange={(event) => useMotionStore.getState().updateReferenceSlot(slot.id, { description: event.target.value })}
      />
      {slot.modality === 'video_with_audio' && (
        <label className="flex items-center justify-between gap-2 text-muted">
          Define &lt;Audio&gt; label for synced track
          <Switch checked={slot.defineAudioLabel} onCheckedChange={(value) => useMotionStore.getState().updateReferenceSlot(slot.id, { defineAudioLabel: value })} />
        </label>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="text-muted" onClick={() => useMotionStore.getState().reorderReferenceSlot(slot.id, -1)}>
          Up
        </button>
        <button type="button" className="text-muted" onClick={() => useMotionStore.getState().reorderReferenceSlot(slot.id, 1)}>
          Down
        </button>
        <button type="button" className="ml-auto text-danger" onClick={() => useMotionStore.getState().removeReferenceSlot(slot.id)}>
          Remove slot
        </button>
      </div>
    </div>
  )
}

function PromptPanel() {
  const shot = useMotionStore((state) => state.shots.find((item) => item.id === state.activeShotId))
  const version = useMotionStore((state) => `${state.activeShotId}:${state.updatedAt}:${state.shots.length}:${state.shots.find((item) => item.id === state.activeShotId)?.referenceSlots.length ?? 0}`)
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
          Export ComfyUI workflow
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setMessage(exportPackage(customWorkflow))}>
          Template ZIP
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
  const bound = bindSingleShotWorkflow(project, shot)
  if (!bound.ok) {
    download(`${shot.id}-manifest.json`, JSON.stringify({ shot: shot.id, status: 'invalid', reason: bound.reason, diagnostics: bound.diagnostics }, null, 2))
    return
  }
  download(`${shot.id}-manifest.json`, JSON.stringify(buildSlotManifest(shot, bound), null, 2))
}

function exportWorkflow(template: unknown) {
  const project = activeProject()
  const shot = project.shots.find((item) => item.id === project.activeShotId)
  if (!shot) return 'No active shot.'
  const result = bindSingleShotWorkflow(project, shot, template ?? undefined)
  if (!result.ok) return result.reason
  download(`${shot.id}-minimax-h3-r2v.json`, JSON.stringify(result.editor, null, 2))
  download(`${shot.id}-minimax-h3-r2v.api.json`, JSON.stringify(result.api, null, 2))
  return `TEMPLATE READY. Select media in each titled ComfyUI loader before queueing. ${result.diagnostics.join(' ')}`
}

function exportPackage(template: unknown) {
  const project = activeProject()
  const shot = project.shots.find((item) => item.id === project.activeShotId)
  if (!shot) return 'No active shot.'
  const packed = buildSingleShotPackage(project, shot, template ?? undefined)
  if (!packed.ok) return packed.reason
  const url = URL.createObjectURL(packed.blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${shot.id}-ref2va-package.zip`
  link.click()
  URL.revokeObjectURL(url)
  return `Template ZIP downloaded (${packed.filenames.length} files). TEMPLATE READY, not execution-ready.`
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
