import type * as THREE from 'three'

const registry = new Map<string, THREE.Object3D>()

export const motionDrag = { id: null as string | null }

export function registerMotion(key: string, object: THREE.Object3D | null) {
  if (object) registry.set(key, object)
  else registry.delete(key)
}

export function getMotionObject(key: string) {
  return registry.get(key) ?? null
}

export function motionSelectionKey(selection: { kind: string; id?: string }) {
  if (selection.kind === 'none') return null
  if (selection.kind === 'object' || selection.kind === 'light') return `${selection.kind}:${selection.id}`
  return selection.kind
}
