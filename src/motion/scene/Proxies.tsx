import { useLayoutEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { evaluateTransform } from '@/motion/lib/interpolation'
import { motionDrag, registerMotion } from '@/motion/scene/registry'
import { useMotionStore } from '@/store/motionStore'
import type { MotionObjectKind } from '@/motion/types'

export function MotionObjectNode({ id }: { id: string }) {
  const group = useRef<THREE.Group>(null)
  const selected = useMotionStore((state) => state.selection.kind === 'object' && state.selection.id === id)
  const kind = useMotionStore((state) => state.shots.find((shot) => shot.id === state.activeShotId)?.objects.find((item) => item.id === id)?.kind ?? 'box')

  useLayoutEffect(() => {
    registerMotion(`object:${id}`, group.current)
    return () => registerMotion(`object:${id}`, null)
  }, [id])

  useFrame(() => {
    const shot = useMotionStore.getState().shots.find((item) => item.id === useMotionStore.getState().activeShotId)
    const object = shot?.objects.find((item) => item.id === id)
    const node = group.current
    if (!shot || !object || !node || motionDrag.id === `object:${id}`) return
    const live = evaluateTransform(object, object.keyframes, shot.currentTime)
    node.position.set(...live.position)
    node.rotation.set(...live.rotation)
    node.scale.set(...live.scale)
  })

  return (
    <group
      ref={group}
      onClick={(event) => {
        event.stopPropagation()
        useMotionStore.getState().setSelection({ kind: 'object', id })
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <ProxyMesh kind={kind} selected={selected} />
    </group>
  )
}

function ProxyMesh({ kind, selected }: { kind: MotionObjectKind; selected: boolean }) {
  const color = selected ? '#e8c9a0' : tone(kind)
  const emissive = selected ? '#5a3b24' : '#000000'
  if (kind === 'person') return <PersonProxy color={color} emissive={emissive} />
  if (kind === 'car') {
    return (
      <group>
        <mesh position={[0, 0.38, 0]} castShadow>
          <boxGeometry args={[1.7, 0.42, 0.8]} />
          <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={selected ? 0.3 : 0} />
        </mesh>
        <mesh position={[0, 0.68, -0.05]} castShadow>
          <boxGeometry args={[0.9, 0.32, 0.72]} />
          <meshStandardMaterial color="#9aa4ad" />
        </mesh>
        {([-0.52, 0.52] as const).flatMap((x) =>
          ([-0.28, 0.28] as const).map((z) => (
            <mesh key={`${x}:${z}`} position={[x, 0.18, z]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.16, 0.16, 0.12, 12]} />
              <meshStandardMaterial color="#1c1c1c" />
            </mesh>
          )),
        )}
      </group>
    )
  }
  if (kind === 'tree') {
    return (
      <group>
        <mesh position={[0, 0.45, 0]} castShadow>
          <cylinderGeometry args={[0.08, 0.12, 0.9, 8]} />
          <meshStandardMaterial color="#6b4b32" />
        </mesh>
        <mesh position={[0, 1.15, 0]} castShadow>
          <coneGeometry args={[0.55, 1.2, 8]} />
          <meshStandardMaterial color={selected ? '#8fbf90' : '#3f6b45'} />
        </mesh>
      </group>
    )
  }
  if (kind === 'table') {
    return (
      <group>
        <mesh position={[0, 0.72, 0]} castShadow>
          <boxGeometry args={[1.2, 0.06, 0.7]} />
          <meshStandardMaterial color={color} />
        </mesh>
        {([-0.5, 0.5] as const).flatMap((x) =>
          ([-0.28, 0.28] as const).map((z) => (
            <mesh key={`${x}:${z}`} position={[x, 0.36, z]} castShadow>
              <boxGeometry args={[0.06, 0.72, 0.06]} />
              <meshStandardMaterial color="#5a4638" />
            </mesh>
          )),
        )}
      </group>
    )
  }
  if (kind === 'sphere') {
    return (
      <mesh position={[0, 0.4, 0]} castShadow>
        <sphereGeometry args={[0.4, 20, 16]} />
        <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={selected ? 0.3 : 0} />
      </mesh>
    )
  }
  return (
    <mesh position={[0, 0.35, 0]} castShadow>
      <boxGeometry args={[0.7, 0.7, 0.7]} />
      <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={selected ? 0.3 : 0} />
    </mesh>
  )
}

function PersonProxy({ color, emissive }: { color: string; emissive: string }) {
  return (
    <group>
      <mesh position={[0, 0.92, 0]} castShadow>
        <capsuleGeometry args={[0.16, 0.7, 4, 8]} />
        <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={emissive === '#000000' ? 0 : 0.25} />
      </mesh>
      <mesh position={[0, 1.64, 0]} castShadow>
        <sphereGeometry args={[0.12, 16, 12]} />
        <meshStandardMaterial color="#d7c6b8" />
      </mesh>
      <mesh position={[0, 1.65, 0.12]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.025, 0.06, 8]} />
        <meshStandardMaterial color="#8d5a48" />
      </mesh>
      <mesh position={[0.18, 1.2, 0]} rotation={[0, 0, -0.4]} castShadow>
        <capsuleGeometry args={[0.045, 0.42, 3, 6]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[-0.18, 1.2, 0]} rotation={[0, 0, 0.4]} castShadow>
        <capsuleGeometry args={[0.045, 0.42, 3, 6]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0.09, 0.38, 0]} castShadow>
        <capsuleGeometry args={[0.06, 0.55, 3, 6]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[-0.09, 0.38, 0]} castShadow>
        <capsuleGeometry args={[0.06, 0.55, 3, 6]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  )
}

function tone(kind: MotionObjectKind) {
  switch (kind) {
    case 'person':
      return '#cbb9ab'
    case 'car':
      return '#c45c4a'
    case 'tree':
      return '#3f6b45'
    case 'table':
      return '#b08968'
    case 'sphere':
      return '#8fb4c0'
    default:
      return '#9aa0aa'
  }
}
