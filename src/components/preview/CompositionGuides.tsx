import { useSceneStore } from '@/store/sceneStore'
import type { GuideState } from '@/types/scene'

const GUIDES: { key: keyof GuideState; label: string }[] = [
  { key: 'thirds', label: 'Thirds' },
  { key: 'cross', label: 'Cross' },
  { key: 'safe', label: 'Safe' },
  { key: 'headroom', label: 'Headroom' },
]

export function CompositionGuides() {
  const guides = useSceneStore((state) => state.guides)
  const active = guides.thirds || guides.cross || guides.safe || guides.headroom
  if (!active) return null

  return (
    <div className="pointer-events-none absolute inset-0">
      {guides.thirds && <Thirds />}
      {guides.cross && <Cross />}
      {guides.safe && <Safe />}
      {guides.headroom && <Headroom />}
    </div>
  )
}

export function GuideToggles() {
  const guides = useSceneStore((state) => state.guides)
  return (
    <div className="flex items-center gap-1">
      {GUIDES.map((guide) => (
        <button
          key={guide.key}
          type="button"
          onClick={() => useSceneStore.getState().toggleGuide(guide.key)}
          className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] ${guides[guide.key] ? 'bg-accent/20 text-accent' : 'text-faint hover:text-ink'}`}
        >
          {guide.label}
        </button>
      ))}
    </div>
  )
}

function Thirds() {
  return (
    <>
      <Line className="left-1/3 top-0 h-full w-px" />
      <Line className="left-2/3 top-0 h-full w-px" />
      <Line className="top-1/3 left-0 h-px w-full" />
      <Line className="top-2/3 left-0 h-px w-full" />
    </>
  )
}

function Cross() {
  return (
    <>
      <Line className="left-1/2 top-0 h-full w-px" />
      <Line className="top-1/2 left-0 h-px w-full" />
    </>
  )
}

function Safe() {
  return <div className="absolute inset-[8%] border border-white/35" />
}

function Headroom() {
  return (
    <div className="absolute inset-x-[8%] top-[12%] border-t border-dashed border-accent/80">
      <span className="absolute -top-3 left-0 text-[9px] uppercase tracking-[0.14em] text-accent">Headroom</span>
    </div>
  )
}

function Line({ className }: { className: string }) {
  return <div className={`absolute bg-white/35 ${className}`} />
}
