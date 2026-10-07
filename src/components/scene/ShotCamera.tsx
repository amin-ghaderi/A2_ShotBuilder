import { useLayoutEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ASPECT_VALUES } from '@/lib/constants'
import { applyFocalLength } from '@/lib/optics'
import { interaction } from '@/components/scene/interaction'
import { registerObject } from '@/components/scene/objectRegistry'
import { useSceneStore } from '@/store/sceneStore'

const _look = new THREE.Vector3()

export function ShotCameraModel() {
  const group = useRef<THREE.Group>(null)
  const selected = useSceneStore((state) => state.selection.kind === 'camera')

  useLayoutEffect(() => {
    registerObject('camera', group.current)
    return () => registerObject('camera', null)
  }, [])

  useFrame(() => {
    const object = group.current
    if (!object || interaction.draggingId === 'camera') return
    const shot = useSceneStore.getState().shotCamera
    object.position.set(shot.position[0], shot.position[1], shot.position[2])
    object.up.set(0, 1, 0)
    object.lookAt(shot.target[0], shot.target[1], shot.target[2])
    object.rotateZ(shot.roll)
  })

  return (
    <group
      ref={group}
      scale={1.7}
      onClick={(event) => {
        event.stopPropagation()
        useSceneStore.getState().select({ kind: 'camera' })
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <mesh castShadow>
        <boxGeometry args={[0.18, 0.12, 0.16]} />
        <meshStandardMaterial
          color={selected ? '#f0d8b8' : '#c8c2b8'}
          emissive={selected ? '#6a4524' : '#000000'}
          emissiveIntensity={selected ? 0.45 : 0}
          roughness={0.38}
          metalness={0.18}
        />
      </mesh>
      <mesh position={[0, 0.08, 0.02]} castShadow>
        <boxGeometry args={[0.08, 0.045, 0.08]} />
        <meshStandardMaterial color={selected ? '#ead4b4' : '#b7b1a8'} roughness={0.4} metalness={0.2} />
      </mesh>
      <mesh position={[0, 0, -0.16]} rotation={[-Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.045, 0.06, 0.14, 20]} />
        <meshStandardMaterial color="#2a2c31" metalness={0.55} roughness={0.28} />
      </mesh>
      <mesh position={[0, 0, -0.23]} rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.038, 0.038, 0.01, 20]} />
        <meshStandardMaterial color={selected ? '#8fb4c0' : '#6f8f9a'} emissive={selected ? '#1c3a44' : '#000'} roughness={0.15} metalness={0.4} />
      </mesh>
    </group>
  )
}

export function TargetHandle() {
  const mesh = useRef<THREE.Mesh>(null)
  const selected = useSceneStore((state) => state.selection.kind === 'target' || state.selection.kind === 'camera')

  useLayoutEffect(() => {
    registerObject('target', mesh.current)
    return () => registerObject('target', null)
  }, [])

  useFrame(() => {
    const object = mesh.current
    if (!object || interaction.draggingId === 'target') return
    const target = useSceneStore.getState().shotCamera.target
    object.position.set(target[0], target[1], target[2])
  })

  return (
    <mesh
      ref={mesh}
      onClick={(event) => {
        event.stopPropagation()
        useSceneStore.getState().select({ kind: 'target' })
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <octahedronGeometry args={[0.045, 0]} />
      <meshBasicMaterial color={selected ? '#f0d2a8' : '#d4a574'} />
    </mesh>
  )
}

export function AimLine() {
  const geometry = useRef<THREE.BufferGeometry>(null)
  const visible = useSceneStore((state) => state.selection.kind === 'camera' || state.selection.kind === 'target')
  const positions = useRef(new Float32Array(6))

  useFrame(() => {
    const attribute = geometry.current?.getAttribute('position') as THREE.BufferAttribute | undefined
    if (!attribute) return
    const shot = useSceneStore.getState().shotCamera
    attribute.setXYZ(0, shot.position[0], shot.position[1], shot.position[2])
    attribute.setXYZ(1, shot.target[0], shot.target[1], shot.target[2])
    attribute.needsUpdate = true
  })

  if (!visible) return null

  return (
    <line>
      <bufferGeometry ref={geometry}>
        <bufferAttribute attach="attributes-position" args={[positions.current, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color="#d4a574" transparent opacity={0.7} />
    </line>
  )
}

export function ShotFrustum() {
  const [camera, setCamera] = useState<THREE.PerspectiveCamera | null>(null)
  const helper = useRef<THREE.CameraHelper>(null)
  const gold = useRef(new THREE.Color('#d4a574'))
  const dim = useRef(new THREE.Color('#6d5a45'))

  useLayoutEffect(() => {
    const object = helper.current
    if (!object) return
    object.raycast = () => {}
    object.setColors(gold.current, dim.current, gold.current, dim.current, dim.current)
  }, [camera])

  useFrame(() => {
    const shotCamera = camera
    const helperObject = helper.current
    if (!shotCamera || !helperObject) return
    const shot = useSceneStore.getState().shotCamera
    const framing = useSceneStore.getState().framing
    const distance = Math.max(0.25, _look.set(shot.target[0], shot.target[1], shot.target[2]).distanceTo(shotCamera.position.set(shot.position[0], shot.position[1], shot.position[2])))
    shotCamera.near = 0.08
    shotCamera.far = distance
    shotCamera.up.set(0, 1, 0)
    shotCamera.lookAt(shot.target[0], shot.target[1], shot.target[2])
    shotCamera.rotateZ(shot.roll)
    applyFocalLength(shotCamera, shot.focalLength, ASPECT_VALUES[framing.aspectRatio])
    shotCamera.updateMatrixWorld()
    helperObject.update()
  })

  return (
    <>
      <perspectiveCamera ref={setCamera} args={[30, 0.8, 0.08, 2]} />
      {camera && <cameraHelper ref={helper} args={[camera]} />}
    </>
  )
}
