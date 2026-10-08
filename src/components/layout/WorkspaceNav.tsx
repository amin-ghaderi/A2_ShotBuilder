import { cn } from '@/lib/cn'
import { useWorkspaceStore } from '@/store/workspaceStore'

export function WorkspaceNav() {
  const workspace = useWorkspaceStore((state) => state.workspace)
  return (
    <div className="flex rounded-full border border-line bg-panel-2/80 p-0.5">
      {([
        ['still', 'Still'],
        ['motion', 'Motion'],
      ] as const).map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => useWorkspaceStore.getState().setWorkspace(id)}
          className={cn(
            'rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.14em]',
            workspace === id ? 'bg-accent/18 text-accent' : 'text-muted hover:text-ink',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
