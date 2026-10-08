import { useLayoutEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { evaluateCamera } from '@/motion/lib/interpolation'
import { motionDrag, registerMotion } from '@/motion/scene/registry'
import { useMotionStore } from '@/store/motionStore'

export function MotionCameraRig({ helpers }: { helpers: boolean }) {
  const group = useRef<THREE.Group>(null)
  const selected = useMotionStore((state) => state.selection.kind === 'camera')

  useLayoutEffect(() => {
    if (!helpers) return
    registerMotion('camera', group.current)
    return () => registerMotion('camera', null)
  }, [helpers])

  useFrame(() => {
    const node = group.current
    if (!node || motionDrag.id === 'camera') return
    const shot = useMotionStore.getState().shots.find((item) => item.id === useMotionStore.getState().activeShotId)
    if (!shot) return
    const live = evaluateCamera(shot.cameraKeys, shot.currentTime)
    node.position.set(...live.position)
    node.up.set(0, 1, 0)
    node.lookAt(...live.target)
    node.rotateZ(live.roll)
  })

  if (!helpers) return null

  return (
    <group
      ref={group}
      scale={1.5}
      onClick={(event) => {
        event.stopPropagation()
        useMotionStore.getState().setSelection({ kind: 'camera' })
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <mesh>
        <boxGeometry args={[0.18, 0.12, 0.16]} />
        <meshStandardMaterial color={selected ? '#f0d8b8' : '#c8c2b8'} emissive={selected ? '#6a4524' : '#000'} emissiveIntensity={selected ? 0.4 : 0} />
      </mesh>
      <mesh position={[0, 0, -0.16]} rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.04, 0.055, 0.12, 16]} />
        <meshStandardMaterial color="#2a2c31" />
      </mesh>
    </group>
  )
}

export function MotionTarget() {
  const mesh = useRef<THREE.Mesh>(null)
  useLayoutEffect(() => {
    registerMotion('target', mesh.current)
    return () => registerMotion('target', null)
  }, [])
  useFrame(() => {
    const node = mesh.current
    if (!node || motionDrag.id === 'target') return
    const shot = useMotionStore.getState().shots.find((item) => item.id === useMotionStore.getState().activeShotId)
    if (!shot) return
    const live = evaluateCamera(shot.cameraKeys, shot.currentTime)
    node.position.set(...live.target)
  })
  return (
    <mesh
      ref={mesh}
      onClick={(event) => {
        event.stopPropagation()
        useMotionStore.getState().setSelection({ kind: 'target' })
      }}
    >
      <octahedronGeometry args={[0.05, 0]} />
      <meshBasicMaterial color="#d4a574" />
    </mesh>
  )
}

export function CameraPath() {
  const geometry = useRef<THREE.BufferGeometry>(null)
  useFrame(() => {
    const shot = useMotionStore.getState().shots.find((item) => item.id === useMotionStore.getState().activeShotId)
    const attr = geometry.current?.getAttribute('position') as THREE.BufferAttribute | undefined
    if (!shot || !attr) return
    const count = 24
    for (let i = 0; i < count; i += 1) {
      const live = evaluateCamera(shot.cameraKeys, (i / (count - 1)) * shot.duration)
      attr.setXYZ(i, live.position[0], live.position[1], live.position[2])
    }
    attr.needsUpdate = true
  })
  return (
    <line>
      <bufferGeometry ref={geometry}>
        <bufferAttribute attach="attributes-position" args={[new Float32Array(24 * 3), 3]} />
      </bufferGeometry>
      <lineBasicMaterial color="#d4a574" transparent opacity={0.65} />
    </line>
  )
}
