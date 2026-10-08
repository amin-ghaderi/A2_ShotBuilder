import { useLayoutEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { physicalIntensity } from '@/lib/lighting'
import { evaluateTransform } from '@/motion/lib/interpolation'
import { motionDrag, registerMotion } from '@/motion/scene/registry'
import { useMotionStore } from '@/store/motionStore'

export function MotionLights({ helpers }: { helpers: boolean }) {
  const ids = useMotionStore((state) => state.shots.find((shot) => shot.id === state.activeShotId)?.lights.map((light) => light.id).join('|') ?? '')
  return (
    <>
      {ids
        .split('|')
        .filter(Boolean)
        .map((id) => (
          <MotionLight key={id} id={id} helpers={helpers} />
        ))}
    </>
  )
}

function MotionLight({ id, helpers }: { id: string; helpers: boolean }) {
  const group = useRef<THREE.Group>(null)
  const spot = useRef<THREE.SpotLight>(null)
  const point = useRef<THREE.PointLight>(null)
  const directional = useRef<THREE.DirectionalLight>(null)
  const target = useRef<THREE.Object3D>(null)

  useLayoutEffect(() => {
    if (!helpers) return
    registerMotion(`light:${id}`, group.current)
    return () => registerMotion(`light:${id}`, null)
  }, [helpers, id])

  useFrame(() => {
    const shot = useMotionStore.getState().shots.find((item) => item.id === useMotionStore.getState().activeShotId)
    const light = shot?.lights.find((item) => item.id === id)
    if (!shot || !light) return
    const live = light.movable ? evaluateTransform({ position: light.position, rotation: [0, 0, 0], scale: [1, 1, 1] }, light.keyframes, shot.currentTime) : light
    const housing = group.current
    if (housing && motionDrag.id !== `light:${id}`) housing.position.set(...live.position)
    target.current?.position.set(...light.target)
    const intensity = light.enabled ? physicalIntensity(light.type, light.intensity) : 0
    const node = light.type === 'spot' ? spot.current : light.type === 'point' ? point.current : directional.current
    if (!node) return
    node.position.set(...live.position)
    node.color.set(light.color)
    node.intensity = intensity
    if (node instanceof THREE.SpotLight && target.current) {
      node.target = target.current
      node.angle = light.angle
      node.penumbra = light.softness
    }
    if (node instanceof THREE.DirectionalLight && target.current) node.target = target.current
  })

  const type = useMotionStore((state) => state.shots.find((shot) => shot.id === state.activeShotId)?.lights.find((item) => item.id === id)?.type ?? 'point')

  return (
    <>
      <object3D ref={target} />
      {type === 'spot' && <spotLight ref={spot} />}
      {type === 'point' && <pointLight ref={point} />}
      {type === 'directional' && <directionalLight ref={directional} />}
      {helpers && (
        <group
          ref={group}
          onClick={(event) => {
            event.stopPropagation()
            useMotionStore.getState().setSelection({ kind: 'light', id })
          }}
        >
          <mesh>
            <sphereGeometry args={[0.1, 12, 10]} />
            <meshStandardMaterial color="#f3dcc0" emissive="#d4a574" emissiveIntensity={0.8} />
          </mesh>
        </group>
      )}
    </>
  )
}
