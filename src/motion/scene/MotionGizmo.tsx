import { useLayoutEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { TransformControls } from '@react-three/drei'
import * as THREE from 'three'
import { evaluateCamera } from '@/motion/lib/interpolation'
import { getMotionObject, motionDrag, motionSelectionKey } from '@/motion/scene/registry'
import { useMotionStore } from '@/store/motionStore'
import type { Vec3 } from '@/types/scene'

export function MotionGizmo() {
  const selection = useMotionStore((state) => state.selection)
  const mode = useMotionStore((state) => state.transformMode)
  const key = motionSelectionKey(selection)
  const [object, setObject] = useState<THREE.Object3D | null>(null)
  const attached = useRef<THREE.Object3D | null>(null)

  useLayoutEffect(() => {
    const next = key ? getMotionObject(key) : null
    attached.current = next
    setObject(next)
  }, [key])

  useFrame(() => {
    if (motionDrag.id) return
    const next = key ? getMotionObject(key) : null
    if (next !== attached.current) {
      attached.current = next
      setObject(next)
    }
  })

  if (!object || !key) return null
  const gizmoMode = selection.kind === 'target' ? 'translate' : mode === 'scale' && selection.kind !== 'object' ? 'translate' : mode

  return (
    <TransformControls
      object={object}
      mode={gizmoMode}
      size={0.75}
      onMouseDown={() => {
        motionDrag.id = key
      }}
      onMouseUp={() => {
        sync(object)
        motionDrag.id = null
      }}
      onObjectChange={() => sync(object)}
    />
  )
}

function tuple(x: number, y: number, z: number): Vec3 {
  return [x, y, z]
}

function sync(object: THREE.Object3D) {
  const store = useMotionStore.getState()
  const selection = store.selection
  if (selection.kind === 'object') {
    store.setObjectTransform(selection.id, tuple(object.position.x, object.position.y, object.position.z), tuple(object.rotation.x, object.rotation.y, object.rotation.z), tuple(object.scale.x, object.scale.y, object.scale.z))
    return
  }
  if (selection.kind === 'camera') {
    const shot = store.shots.find((item) => item.id === store.activeShotId)
    if (!shot) return
    const live = evaluateCamera(shot.cameraKeys, shot.currentTime)
    store.setCameraPose(tuple(object.position.x, object.position.y, object.position.z), live.target)
    return
  }
  if (selection.kind === 'target') {
    const shot = store.shots.find((item) => item.id === store.activeShotId)
    if (!shot) return
    const live = evaluateCamera(shot.cameraKeys, shot.currentTime)
    store.setCameraPose(live.position, tuple(object.position.x, object.position.y, object.position.z))
    return
  }
  if (selection.kind === 'light') {
    store.updateLight(selection.id, { position: tuple(object.position.x, object.position.y, object.position.z) })
  }
}
