import type * as THREE from 'three'

const registry = new Map<string, THREE.Object3D>()

export function registerObject(key: string, object: THREE.Object3D | null) {
  if (object) registry.set(key, object)
  else registry.delete(key)
}

export function getRegistered(key: string) {
  return registry.get(key) ?? null
}
