import { Section, Segmented, SliderField } from '@/components/controls/fields'
import { GAZE_OPTIONS } from '@/lib/constants'
import { formatSigned, toDeg, toRad } from '@/lib/math'
import { useSceneStore } from '@/store/sceneStore'
import type { GazeMode } from '@/types/scene'

export function SubjectControls() {
  const selected = useSceneStore((state) => state.selection.kind === 'subject')
  const subject = useSceneStore((state) => state.subject)
  const yaw = toDeg(subject.bodyYaw)

  return (
    <Section title="Subject" active={selected}>
      <SliderField
        label="Body rotation"
        value={yaw}
        min={-180}
        max={180}
        step={1}
        display={`${formatSigned(yaw, 0)}°`}
        onChange={(degrees) => useSceneStore.getState().setBodyYaw(toRad(degrees))}
      />
      <div>
        <p className="mb-1.5 text-[11px] text-muted">Gaze</p>
        <Segmented
          value={subject.gaze}
          options={GAZE_OPTIONS}
          onChange={(gaze: GazeMode) => useSceneStore.getState().setGaze(gaze)}
        />
      </div>
      {subject.gaze === 'original' && (
        <>
          <SliderField
            label="Head turn"
            value={toDeg(subject.headYaw)}
            min={-80}
            max={80}
            step={1}
            display={`${formatSigned(toDeg(subject.headYaw), 0)}°`}
            onChange={(degrees) => useSceneStore.getState().setHeadYaw(toRad(degrees))}
          />
          <SliderField
            label="Head tilt"
            value={toDeg(subject.headPitch)}
            min={-40}
            max={40}
            step={1}
            display={`${formatSigned(toDeg(subject.headPitch), 0)}°`}
            onChange={(degrees) => useSceneStore.getState().setHeadPitch(toRad(degrees))}
          />
        </>
      )}
    </Section>
  )
}
