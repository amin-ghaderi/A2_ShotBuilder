import { Section, Segmented, SliderField } from '@/components/controls/fields'
import { LENS_PRESETS } from '@/lib/constants'
import { useSceneStore } from '@/store/sceneStore'

export function LensControls() {
  const focalLength = useSceneStore((state) => state.shotCamera.focalLength)
  const preset = LENS_PRESETS.find((lens) => lens === Math.round(focalLength))
  return (
    <Section title="Lens">
      <Segmented
        value={preset ? String(preset) : 'custom'}
        options={[
          ...LENS_PRESETS.map((lens) => ({ value: String(lens), label: `${lens}` })),
          { value: 'custom', label: 'Custom' },
        ]}
        onChange={(value) => {
          if (value === 'custom') return
          useSceneStore.getState().setFocalLength(Number(value))
        }}
      />
      <SliderField
        label="Focal length"
        value={focalLength}
        min={18}
        max={200}
        step={1}
        display={`${Math.round(focalLength)}mm`}
        onChange={(value) => useSceneStore.getState().setFocalLength(value)}
      />
    </Section>
  )
}
