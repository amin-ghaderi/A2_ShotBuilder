import { RotateCcw } from 'lucide-react'
import { CanvasBoundary } from '@/components/layout/CanvasBoundary'
import { Footer } from '@/components/layout/Footer'
import { WorkspaceNav } from '@/components/layout/WorkspaceNav'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { MotionEditor } from '@/motion/components/MotionEditor'
import { MotionInspector } from '@/motion/components/MotionInspector'
import { MotionPreview } from '@/motion/components/MotionPreview'
import { PlaybackDriver, Timeline } from '@/motion/components/Timeline'
import { useMotionStore } from '@/store/motionStore'
import type { ReactNode } from 'react'

export function MotionShell() {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas text-ink xl:h-dvh xl:overflow-hidden">
      <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-line px-4">
        <div className="flex items-center gap-3">
          <span className="text-sm tracking-[0.22em] text-accent">A2</span>
          <WorkspaceNav />
        </div>
        <p className="hidden text-xs text-faint lg:block">Motion workspace · MiniMax H3 Ref2VA</p>
        <Button type="button" size="sm" variant="outline" onClick={() => useMotionStore.getState().resetProject()}>
          <RotateCcw className="size-3.5" />
          Reset
        </Button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 xl:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-2">
            <Viewport title="Scene editor" hint="Setup view" className="min-h-[360px] lg:min-h-0">
              <CanvasBoundary label="Motion editor">
                <MotionEditor />
              </CanvasBoundary>
            </Viewport>
            <Viewport title="Shot preview" hint="Evaluated time" className="min-h-[360px] lg:min-h-0">
              <CanvasBoundary label="Motion preview">
                <MotionPreview />
              </CanvasBoundary>
            </Viewport>
          </div>
          <Timeline />
        </div>
        <MotionInspector />
      </div>
      <Footer />
      <PlaybackDriver />
    </div>
  )
}

function Viewport({
  title,
  hint,
  className,
  children,
}: {
  title: string
  hint: string
  className?: string
  children: ReactNode
}) {
  return (
    <section className={cn('flex min-h-0 flex-col overflow-hidden rounded-xl border border-line bg-panel/75', className)}>
      <header className="flex h-10 shrink-0 items-center justify-between border-b border-line px-3">
        <h2 className="text-[11px] uppercase tracking-[0.16em] text-muted">{title}</h2>
        <span className="text-[10px] uppercase tracking-[0.14em] text-faint">{hint}</span>
      </header>
      <div className="relative min-h-0 flex-1">{children}</div>
    </section>
  )
}
