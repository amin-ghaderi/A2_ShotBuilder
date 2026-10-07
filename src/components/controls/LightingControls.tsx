import { Plus, Trash2 } from 'lucide-react'
import { Section, SliderField } from '@/components/controls/fields'
import { Button } from '@/components/ui/button'
import { SelectField } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { estimateKelvin, kelvinToHex } from '@/lib/color'
import { LIGHT_ROLES, LIGHT_TYPES } from '@/lib/constants'
import { analyzeLights } from '@/lib/geometry/lightAnalysis'
import { formatSigned } from '@/lib/math'
import { useSceneStore } from '@/store/sceneStore'
import type { LightRole, LightType } from '@/types/scene'

export function LightingControls() {
  const lights = useSceneStore((state) => state.lights)
  const subject = useSceneStore((state) => state.subject)
  const selection = useSceneStore((state) => state.selection)
  const selectedId = selection.kind === 'light' ? selection.id : null
  const selected = lights.find((light) => light.id === selectedId) ?? null
  const analysis = analyzeLights(subject, lights).find((item) => item.light.id === selectedId)

  return (
    <Section title="Lighting" active={selection.kind === 'light'}>
      <div className="space-y-1.5">
        {lights.map((light) => {
          const active = light.id === selectedId
          return (
            <div
              key={light.id}
              className={`flex items-center gap-2 rounded-md border px-2 py-1.5 ${active ? 'border-accent/50 bg-accent/8' : 'border-line'}`}
            >
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => useSceneStore.getState().select({ kind: 'light', id: light.id })}
              >
                <span className="block text-xs text-ink">{light.name}</span>
                <span className="block text-[10px] uppercase tracking-[0.12em] text-faint">
                  {light.role} · {light.type}
                </span>
              </button>
              <Switch
                checked={light.enabled}
                onCheckedChange={(enabled) => useSceneStore.getState().updateLight(light.id, { enabled })}
                aria-label={`${light.name} enabled`}
              />
            </div>
          )
        })}
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={lights.length >= 3}
          onClick={() => useSceneStore.getState().addLight()}
        >
          <Plus className="size-3.5" />
          Add light
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!selected}
          onClick={() => selected && useSceneStore.getState().removeLight(selected.id)}
        >
          <Trash2 className="size-3.5" />
          Remove
        </Button>
      </div>
      {selected && (
        <div className="space-y-3 border-t border-line pt-3">
          <SelectField
            value={selected.type}
            options={LIGHT_TYPES}
            onChange={(value) => useSceneStore.getState().updateLight(selected.id, { type: value as LightType })}
          />
          <SelectField
            value={selected.role}
            options={LIGHT_ROLES}
            onChange={(value) => useSceneStore.getState().updateLight(selected.id, { role: value as LightRole })}
          />
          <SliderField
            label="Strength"
            value={selected.intensity}
            min={0}
            max={100}
            step={1}
            display={`${Math.round(selected.intensity)}`}
            onChange={(intensity) => useSceneStore.getState().updateLight(selected.id, { intensity })}
          />
          <SliderField
            label="Temperature"
            value={selected.temperature}
            min={2700}
            max={9000}
            step={50}
            display={`${Math.round(selected.temperature)}K`}
            onChange={(temperature) =>
              useSceneStore.getState().updateLight(selected.id, {
                temperature,
                color: kelvinToHex(temperature),
              })
            }
          />
          <label className="flex items-center justify-between text-[11px] text-muted">
            Color
            <input
              type="color"
              value={selected.color}
              onChange={(event) => {
                const color = event.target.value
                useSceneStore.getState().updateLight(selected.id, { color, temperature: estimateKelvin(color) })
              }}
              className="h-7 w-10 cursor-pointer rounded border border-line bg-transparent"
            />
          </label>
          <SliderField
            label="Softness"
            value={selected.softness}
            min={0}
            max={1}
            step={0.01}
            display={selected.softness.toFixed(2)}
            onChange={(softness) => useSceneStore.getState().updateLight(selected.id, { softness })}
          />
          {selected.type === 'spot' && (
            <SliderField
              label="Cone"
              value={(selected.angle * 180) / Math.PI}
              min={8}
              max={70}
              step={1}
              display={`${Math.round((selected.angle * 180) / Math.PI)}°`}
              onChange={(degrees) => useSceneStore.getState().updateLight(selected.id, { angle: (degrees * Math.PI) / 180 })}
            />
          )}
          {analysis && (
            <p className="text-[11px] leading-relaxed text-faint">
              {analysis.relation} · {formatSigned(analysis.horizontalAngle, 0)}° horizontal · {formatSigned(analysis.verticalAngle, 0)}° vertical · {analysis.intensityClass} · {analysis.temperatureClass}
            </p>
          )}
        </div>
      )}
    </Section>
  )
}
