import { create } from 'zustand'
import type { WorkspaceId } from '@/motion/types'

type WorkspaceStore = {
  workspace: WorkspaceId
  setWorkspace: (workspace: WorkspaceId) => void
}

export const useWorkspaceStore = create<WorkspaceStore>((set) => ({
  workspace: 'still',
  setWorkspace: (workspace) => set({ workspace }),
}))
