import { Section } from '@/components/controls/fields'
import { SelectField } from '@/components/ui/select'
import { BACKGROUND_OPTIONS } from '@/lib/constants'
import { useSceneStore } from '@/store/sceneStore'
import type { BackgroundMode } from '@/types/scene'

export function BackgroundControls() {
  const background = useSceneStore((state) => state.background)

  return (
    <Section title="Background">
      <SelectField
        value={background.mode}
        options={BACKGROUND_OPTIONS}
        onChange={(mode) => useSceneStore.getState().setBackground({ mode: mode as BackgroundMode })}
      />
      {background.mode === 'custom-color' && (
        <label className="flex items-center justify-between text-[11px] text-muted">
          Color
          <input
            type="color"
            value={background.color}
            onChange={(event) => useSceneStore.getState().setBackground({ color: event.target.value })}
            className="h-7 w-10 cursor-pointer rounded border border-line bg-transparent"
          />
        </label>
      )}
      {background.mode === 'soft-gradient' && (
        <div className="flex gap-3 text-[11px] text-muted">
          <label className="flex items-center gap-2">
            Top
            <input
              type="color"
              value={background.gradientTop}
              onChange={(event) => useSceneStore.getState().setBackground({ gradientTop: event.target.value })}
              className="h-7 w-10 cursor-pointer rounded border border-line bg-transparent"
            />
          </label>
          <label className="flex items-center gap-2">
            Bottom
            <input
              type="color"
              value={background.gradientBottom}
              onChange={(event) => useSceneStore.getState().setBackground({ gradientBottom: event.target.value })}
              className="h-7 w-10 cursor-pointer rounded border border-line bg-transparent"
            />
          </label>
        </div>
      )}
      {background.mode === 'custom-description' && (
        <textarea
          value={background.description}
          onChange={(event) => useSceneStore.getState().setBackground({ description: event.target.value })}
          placeholder="Describe the background for the prompt"
          className="h-20 w-full resize-none rounded-md border border-line bg-panel px-2 py-1.5 text-xs text-ink outline-none"
        />
      )}
      {background.mode === 'preserve' && (
        <p className="text-[11px] leading-relaxed text-faint">
          The preview uses a neutral stand-in. The prompt tells the image model to keep the original background.
        </p>
      )}
    </Section>
  )
}
