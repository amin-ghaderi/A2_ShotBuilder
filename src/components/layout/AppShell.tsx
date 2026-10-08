import { Check, Copy, RotateCcw } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import gsap from 'gsap'
import { Inspector } from '@/components/controls/Inspector'
import { CanvasBoundary } from '@/components/layout/CanvasBoundary'
import { Footer } from '@/components/layout/Footer'
import { WorkspaceNav } from '@/components/layout/WorkspaceNav'
import { PromptOutput } from '@/components/prompt/PromptOutput'
import { ShotPreview } from '@/components/preview/ShotPreview'
import { SceneEditor } from '@/components/scene/SceneEditor'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { copyText } from '@/lib/copy'
import { compilePrompt } from '@/lib/prompt/promptCompiler'
import { useSceneStore } from '@/store/sceneStore'

export function AppShell() {
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const context = gsap.context(() => {
      gsap.fromTo(
        '.rise',
        { autoAlpha: 0, y: 12 },
        { autoAlpha: 1, y: 0, duration: 0.55, stagger: 0.06, ease: 'power2.out' },
      )
    }, root)
    return () => context.revert()
  }, [])

  return (
    <div ref={root} className="flex min-h-dvh flex-col bg-canvas text-ink xl:h-dvh xl:overflow-hidden">
      <Header />
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 xl:flex-row">
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-2">
          <Viewport className="rise min-h-[480px] lg:min-h-0" title="Scene editor" hint="Setup view">
            <CanvasBoundary label="Scene editor">
              <SceneEditor />
            </CanvasBoundary>
          </Viewport>
          <div className="flex h-full min-h-[560px] flex-col gap-3 lg:min-h-0">
            <Viewport className="rise min-h-[420px] flex-1" title="Shot preview" hint="Photograph">
              <CanvasBoundary label="Shot preview">
                <ShotPreview />
              </CanvasBoundary>
            </Viewport>
            <div className="rise">
              <PromptOutput />
            </div>
          </div>
        </div>
        <Inspector />
      </div>
      <Footer />
    </div>
  )
}

function Header() {
  const [copied, setCopied] = useState(false)

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-line px-4">
      <div className="flex items-center gap-3">
        <span className="text-sm tracking-[0.22em] text-accent">A2</span>
        <WorkspaceNav />
        <span className="hidden text-xs text-muted sm:inline">Still</span>
      </div>
      <p className="hidden text-xs text-faint lg:block">Move the scene. The prompt follows.</p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => {
            void copyText(compilePrompt(useSceneStore.getState())).then(() => {
              setCopied(true)
              window.setTimeout(() => setCopied(false), 1600)
            })
          }}
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? 'Copied' : 'Copy prompt'}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => useSceneStore.getState().resetScene()}>
          <RotateCcw className="size-3.5" />
          Reset
        </Button>
      </div>
    </header>
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
