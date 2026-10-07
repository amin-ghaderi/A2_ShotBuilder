import { Section, Segmented, SliderField } from '@/components/controls/fields'
import { AIM_OPTIONS } from '@/lib/constants'
import { analyzeCamera } from '@/lib/geometry/cameraAnalysis'
import { formatSigned, toDeg, toRad } from '@/lib/math'
import { useSceneStore } from '@/store/sceneStore'
import type { AimPoint } from '@/types/scene'

export function CameraControlsPanel() {
  const selected = useSceneStore((state) => state.selection.kind === 'camera' || state.selection.kind === 'target')
  const camera = useSceneStore((state) => state.shotCamera)
  const subject = useSceneStore((state) => state.subject)
  const analysis = analyzeCamera(subject, camera)

  return (
    <Section title="Camera" active={selected}>
      <div className="grid grid-cols-3 gap-2">
        <Metric label="Azimuth" value={`${formatSigned(analysis.azimuth)}°`} />
        <Metric label="Elevation" value={`${formatSigned(analysis.elevation)}°`} />
        <Metric label="Distance" value={`${analysis.distance.toFixed(2)}m`} />
      </div>
      <div>
        <p className="mb-1.5 text-[11px] text-muted">Aim height</p>
        <Segmented
          value={camera.aim}
          options={AIM_OPTIONS}
          onChange={(aim: AimPoint) => useSceneStore.getState().pointAtSubject(aim)}
        />
      </div>
      <SliderField
        label="Target height"
        value={camera.target[1]}
        min={0.2}
        max={2.2}
        step={0.01}
        display={`${camera.target[1].toFixed(2)}m`}
        onChange={(height) => useSceneStore.getState().setTargetHeight(height)}
      />
      <SliderField
        label="Roll"
        value={toDeg(camera.roll)}
        min={-45}
        max={45}
        step={0.5}
        display={`${formatSigned(toDeg(camera.roll))}°`}
        onChange={(degrees) => useSceneStore.getState().setRoll(toRad(degrees))}
      />
      <p className="text-[11px] leading-relaxed text-faint">
        {analysis.horizontalRelation === 'center' ? 'Centered' : analysis.horizontalRelation === 'right' ? "Subject's right" : "Subject's left"}
        {' · '}
        {analysis.verticalRelation === 'level' ? 'eye level' : analysis.verticalRelation === 'above' ? 'above eye level' : 'below eye level'}
        {' · '}
        {analysis.frontBackRelation}
      </p>
    </Section>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-[0.14em] text-faint">{label}</div>
      <div className="font-mono text-xs text-ink">{value}</div>
    </div>
  )
}
