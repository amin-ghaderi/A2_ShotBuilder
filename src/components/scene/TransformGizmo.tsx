import { useLayoutEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { TransformControls } from '@react-three/drei'
import * as THREE from 'three'
import { interaction } from '@/components/scene/interaction'
import { getRegistered } from '@/components/scene/objectRegistry'
import { selectionKey, useSceneStore } from '@/store/sceneStore'
import type { Vec3 } from '@/types/scene'

const _forward = new THREE.Vector3()
const _next = new THREE.Vector3()

export function TransformGizmo() {
  const selection = useSceneStore((state) => state.selection)
  const transformMode = useSceneStore((state) => state.transformMode)
  const key = selectionKey(selection)
  const [object, setObject] = useState<THREE.Object3D | null>(null)
  const attached = useRef<THREE.Object3D | null>(null)

  useLayoutEffect(() => {
    const next = key ? getRegistered(key) : null
    attached.current = next
    setObject(next)
  }, [key])

  useFrame(() => {
    if (interaction.draggingId) return
    const next = key ? getRegistered(key) : null
    if (next !== attached.current) {
      attached.current = next
      setObject(next)
    }
  })

  if (!object || !key) return null

  const mode = selection.kind === 'target' || (selection.kind === 'light' && isPointLight(selection.id) && transformMode === 'rotate')
    ? 'translate'
    : transformMode

  return (
    <TransformControls
      object={object}
      mode={mode}
      space={mode === 'rotate' ? 'local' : 'world'}
      size={0.8}
      onMouseDown={() => {
        interaction.draggingId = key
      }}
      onMouseUp={() => {
        syncDraggedObject(object)
        interaction.draggingId = null
      }}
      onObjectChange={() => syncDraggedObject(object)}
    />
  )
}

function isPointLight(id: string) {
  return useSceneStore.getState().lights.find((light) => light.id === id)?.type === 'point'
}

function syncDraggedObject(object: THREE.Object3D) {
  const store = useSceneStore.getState()
  const selection = store.selection

  if (selection.kind === 'camera') {
    const position = tuple(object.position.x, Math.max(0.08, object.position.y), object.position.z)
    object.position.y = position[1]
    if (store.transformMode === 'rotate') {
      _forward.set(0, 0, -1).applyQuaternion(object.quaternion)
      const previous = store.shotCamera.target
      const distance = Math.max(0.35, object.position.distanceTo(_next.set(previous[0], previous[1], previous[2])))
      const target = object.position.clone().addScaledVector(_forward, distance)
      store.setShotCameraPose(position, tuple(target.x, target.y, target.z))
    } else {
      store.setShotCameraPosition(position)
      const target = useSceneStore.getState().shotCamera.target
      object.up.set(0, 1, 0)
      object.lookAt(target[0], target[1], target[2])
      object.rotateZ(useSceneStore.getState().shotCamera.roll)
    }
    return
  }

  if (selection.kind === 'target') {
    store.setShotCameraTarget(tuple(object.position.x, object.position.y, object.position.z))
    return
  }

  if (selection.kind === 'subject') {
    object.rotation.x = 0
    object.rotation.z = 0
    object.position.y = 0
    store.setSubjectTransform(tuple(object.position.x, 0, object.position.z), object.rotation.y)
    return
  }

  if (selection.kind === 'light') {
    const position = tuple(object.position.x, Math.max(0.05, object.position.y), object.position.z)
    object.position.y = position[1]
    const light = store.lights.find((item) => item.id === selection.id)
    if (!light) return
    if (store.transformMode === 'rotate' && light.type !== 'point') {
      _forward.set(0, 0, -1).applyQuaternion(object.quaternion)
      const distance = Math.max(0.4, object.position.distanceTo(_next.set(light.target[0], light.target[1], light.target[2])))
      const target = object.position.clone().addScaledVector(_forward, distance)
      store.updateLight(selection.id, {
        position,
        target: tuple(target.x, target.y, target.z),
        rotation: tuple(object.rotation.x, object.rotation.y, object.rotation.z),
      })
    } else {
      store.updateLight(selection.id, { position })
      const next = useSceneStore.getState().lights.find((item) => item.id === selection.id)
      if (next && next.type !== 'point') {
        object.up.set(0, 1, 0)
        object.lookAt(next.target[0], next.target[1], next.target[2])
      }
    }
  }
}

function tuple(x: number, y: number, z: number): Vec3 {
  return [x, y, z]
}
