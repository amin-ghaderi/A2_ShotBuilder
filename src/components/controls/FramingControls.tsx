import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Crosshair } from 'lucide-react'
import type { ReactNode } from 'react'
import { Section, Segmented } from '@/components/controls/fields'
import { ASPECT_RATIOS, FRAMING_PRESETS, FRAMING_SPECS } from '@/lib/constants'
import { analyzeCrop } from '@/lib/geometry/framing'
import { useSceneStore } from '@/store/sceneStore'
import type { AspectRatio, NamedFramingPreset } from '@/types/scene'

export function FramingControls() {
  const framing = useSceneStore((state) => state.framing)
  const subject = useSceneStore((state) => state.subject)
  const camera = useSceneStore((state) => state.shotCamera)
  const visible = analyzeCrop(subject, camera)

  return (
    <Section title="Framing">
      <Segmented
        value={visible.preset === framing.preset ? framing.preset : 'custom'}
        options={[
          ...FRAMING_PRESETS.map((preset) => ({ value: preset, label: FRAMING_SPECS[preset].label })),
          { value: 'custom' as const, label: 'Custom' },
        ]}
        onChange={(preset) => {
          if (preset === 'custom') return
          useSceneStore.getState().applyFramingPreset(preset as NamedFramingPreset)
        }}
      />
      <div>
        <p className="mb-1.5 text-[11px] text-muted">Aspect</p>
        <Segmented
          value={framing.aspectRatio}
          options={ASPECT_RATIOS.map((ratio) => ({ value: ratio, label: ratio }))}
          onChange={(ratio: AspectRatio) => useSceneStore.getState().setAspectRatio(ratio)}
        />
      </div>
      <FramingNudge />
      <p className="text-[11px] text-faint">
        Visible crop: {FRAMING_SPECS[visible.preset].label}. Headroom {visible.headroom.toFixed(2)}m.
      </p>
    </Section>
  )
}

export function FramingNudge() {
  return (
    <div className="grid grid-cols-3 gap-1">
      <span />
      <Nudge label="Frame up" onClick={() => useSceneStore.getState().moveFraming('up')}>
        <ChevronUp className="size-3.5" />
      </Nudge>
      <span />
      <Nudge label="Shift left" onClick={() => useSceneStore.getState().shiftComposition('left')}>
        <ChevronLeft className="size-3.5" />
      </Nudge>
      <Nudge label="Center subject" onClick={() => useSceneStore.getState().centerSubject()}>
        <Crosshair className="size-3.5" />
      </Nudge>
      <Nudge label="Shift right" onClick={() => useSceneStore.getState().shiftComposition('right')}>
        <ChevronRight className="size-3.5" />
      </Nudge>
      <Nudge label="Tighter" onClick={() => useSceneStore.getState().scaleDistance(0.88)}>
        <span className="text-[10px]">Tight</span>
      </Nudge>
      <Nudge label="Frame down" onClick={() => useSceneStore.getState().moveFraming('down')}>
        <ChevronDown className="size-3.5" />
      </Nudge>
      <Nudge label="Wider" onClick={() => useSceneStore.getState().scaleDistance(1.14)}>
        <span className="text-[10px]">Wide</span>
      </Nudge>
    </div>
  )
}

function Nudge({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="flex h-8 items-center justify-center rounded-md border border-line bg-white/5 text-muted hover:border-accent/40 hover:text-ink"
    >
      {children}
    </button>
  )
}
