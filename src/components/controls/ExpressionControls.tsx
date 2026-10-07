import { Section } from '@/components/controls/fields'
import { SelectField } from '@/components/ui/select'
import { EXPRESSION_OPTIONS, MOOD_OPTIONS } from '@/lib/constants'
import { useSceneStore } from '@/store/sceneStore'
import type { ExpressionId, MoodId } from '@/types/scene'

export function ExpressionControls() {
  const expression = useSceneStore((state) => state.expression)
  const customExpression = useSceneStore((state) => state.customExpression)
  const mood = useSceneStore((state) => state.mood)

  return (
    <Section title="Expression and mood">
      <SelectField
        value={expression}
        options={EXPRESSION_OPTIONS}
        onChange={(value) => useSceneStore.getState().setExpression(value as ExpressionId)}
      />
      {expression === 'custom' && (
        <textarea
          value={customExpression}
          onChange={(event) => useSceneStore.getState().setCustomExpression(event.target.value)}
          placeholder="Describe the expression"
          className="h-16 w-full resize-none rounded-md border border-line bg-panel px-2 py-1.5 text-xs text-ink outline-none"
        />
      )}
      <SelectField
        value={mood}
        options={MOOD_OPTIONS}
        onChange={(value) => useSceneStore.getState().setMood(value as MoodId)}
      />
      <p className="text-[11px] leading-relaxed text-faint">
        Expression and mood shape the prompt. They do not move the camera or the lights.
      </p>
    </Section>
  )
}
