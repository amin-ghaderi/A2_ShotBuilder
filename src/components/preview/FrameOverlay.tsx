export function FrameOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0">
      <Corner className="left-2 top-2 border-l border-t" />
      <Corner className="right-2 top-2 border-r border-t" />
      <Corner className="bottom-2 left-2 border-b border-l" />
      <Corner className="right-2 bottom-2 border-r border-b" />
    </div>
  )
}

function Corner({ className }: { className: string }) {
  return <span className={`absolute size-4 border-white/70 ${className}`} />
}
