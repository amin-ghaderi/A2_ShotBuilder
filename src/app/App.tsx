import { AppShell } from '@/components/layout/AppShell'
import { TooltipProvider } from '@/components/ui/tooltip'
import { MotionShell } from '@/motion/components/MotionShell'
import { useWorkspaceStore } from '@/store/workspaceStore'

export default function App() {
  const workspace = useWorkspaceStore((state) => state.workspace)
  return (
    <TooltipProvider delayDuration={280}>
      {workspace === 'motion' ? <MotionShell /> : <AppShell />}
    </TooltipProvider>
  )
}
