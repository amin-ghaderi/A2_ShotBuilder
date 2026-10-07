import { BackgroundControls } from '@/components/controls/BackgroundControls'
import { CameraControlsPanel } from '@/components/controls/CameraControlsPanel'
import { ExpressionControls } from '@/components/controls/ExpressionControls'
import { FramingControls } from '@/components/controls/FramingControls'
import { LensControls } from '@/components/controls/LensControls'
import { LightingControls } from '@/components/controls/LightingControls'
import { SubjectControls } from '@/components/controls/SubjectControls'

export function Inspector() {
  return (
    <aside className="rise border-line xl:h-full xl:w-[332px] xl:shrink-0 xl:overflow-y-auto xl:border-l xl:pl-3">
      <div className="space-y-3 pb-8">
        <CameraControlsPanel />
        <LensControls />
        <SubjectControls />
        <LightingControls />
        <FramingControls />
        <BackgroundControls />
        <ExpressionControls />
      </div>
    </aside>
  )
}
