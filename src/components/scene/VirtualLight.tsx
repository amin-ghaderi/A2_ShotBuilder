import { useLayoutEffect, useRef, type RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { interaction } from '@/components/scene/interaction'
import { registerObject } from '@/components/scene/objectRegistry'
import { physicalIntensity } from '@/lib/lighting'
import { useSceneStore } from '@/store/sceneStore'
import type { LightType } from '@/types/scene'

export function VirtualLight({ id, helpers }: { id: string; helpers: boolean }) {
  const type = useSceneStore((state) => state.lights.find((light) => light.id === id)?.type ?? 'spot')
  return <LightBody key={type} id={id} type={type} helpers={helpers} />
}

function LightBody({ id, type, helpers }: { id: string; type: LightType; helpers: boolean }) {
  const group = useRef<THREE.Group>(null)
  const spot = useRef<THREE.SpotLight>(null)
  const point = useRef<THREE.PointLight>(null)
  const directional = useRef<THREE.DirectionalLight>(null)
  const target = useRef<THREE.Object3D>(null)
  const selected = useSceneStore((state) => state.selection.kind === 'light' && state.selection.id === id)
  const color = useSceneStore((state) => state.lights.find((light) => light.id === id)?.color ?? '#f0d8b0')

  useLayoutEffect(() => {
    if (!helpers) return
    registerObject(`light:${id}`, group.current)
    return () => registerObject(`light:${id}`, null)
  }, [helpers, id])

  useFrame(() => {
    const config = useSceneStore.getState().lights.find((light) => light.id === id)
    const targetObject = target.current
    if (!config || !targetObject) return

    const dragging = interaction.draggingId === `light:${id}`
    const housing = group.current
    if (housing && !dragging) {
      housing.position.set(config.position[0], config.position[1], config.position[2])
      if (type !== 'point') {
        housing.up.set(0, 1, 0)
        housing.lookAt(config.target[0], config.target[1], config.target[2])
      } else {
        housing.rotation.set(0, 0, 0)
      }
    }

    targetObject.position.set(config.target[0], config.target[1], config.target[2])
    targetObject.updateMatrixWorld()

    const source = housing?.position ?? _fallback.set(config.position[0], config.position[1], config.position[2])
    const intensity = config.enabled ? physicalIntensity(type, config.intensity) : 0
    const light = type === 'spot' ? spot.current : type === 'point' ? point.current : directional.current
    if (!light) return
    light.position.copy(source)
    light.color.set(config.color)
    light.intensity = intensity

    if (light instanceof THREE.SpotLight) {
      light.target = targetObject
      light.angle = config.angle
      light.penumbra = config.softness
      light.decay = 2
      light.distance = 0
      light.castShadow = config.enabled && config.role === 'key'
      light.shadow.bias = -0.0008
      light.shadow.normalBias = 0.04
      light.shadow.mapSize.set(1024, 1024)
    } else if (light instanceof THREE.PointLight) {
      light.decay = 2
      light.distance = 0
    } else if (light instanceof THREE.DirectionalLight) {
      light.target = targetObject
      light.castShadow = config.enabled
      const shadowCamera = light.shadow.camera
      shadowCamera.left = -4
      shadowCamera.right = 4
      shadowCamera.top = 4
      shadowCamera.bottom = -4
      shadowCamera.near = 0.2
      shadowCamera.far = 20
      shadowCamera.updateProjectionMatrix()
    }
  })

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
            useSceneStore.getState().select({ kind: 'light', id })
          }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <Housing type={type} selected={selected} color={color} />
        </group>
      )}
      {helpers && <HelperBinding type={type} spot={spot} point={point} directional={directional} />}
    </>
  )
}

const _fallback = new THREE.Vector3()

function Housing({ type, selected, color }: { type: LightType; selected: boolean; color: string }) {
  const emissive = selected ? '#fff1dc' : color
  if (type === 'point') {
    return (
      <mesh>
        <sphereGeometry args={[0.14, 20, 16]} />
        <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={1.4} roughness={0.22} />
      </mesh>
    )
  }
  if (type === 'directional') {
    return (
      <group>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.18, 0.18, 0.04, 24]} />
          <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={1.1} />
        </mesh>
        <mesh position={[0, 0, -0.22]} rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.07, 0.18, 12]} />
          <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={0.8} />
        </mesh>
      </group>
    )
  }
  return (
    <group>
      <mesh>
        <boxGeometry args={[0.22, 0.16, 0.2]} />
        <meshStandardMaterial color="#f4efe8" emissive={emissive} emissiveIntensity={selected ? 0.9 : 0.55} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0, -0.18]} rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.055, 0.07, 0.12, 16]} />
        <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={0.8} metalness={0.2} roughness={0.3} />
      </mesh>
    </group>
  )
}

function HelperBinding({
  type,
  spot,
  point,
  directional,
}: {
  type: LightType
  spot: RefObject<THREE.SpotLight | null>
  point: RefObject<THREE.PointLight | null>
  directional: RefObject<THREE.DirectionalLight | null>
}) {
  const scene = useThree((state) => state.scene)
  const helper = useRef<THREE.Object3D | null>(null)

  useLayoutEffect(() => {
    const light = type === 'spot' ? spot.current : type === 'point' ? point.current : directional.current
    if (!light) return
    try {
      const next =
        light instanceof THREE.SpotLight
          ? new THREE.SpotLightHelper(light)
          : light instanceof THREE.DirectionalLight
            ? new THREE.DirectionalLightHelper(light, 0.4)
            : new THREE.PointLightHelper(light, 0.1)
      next.raycast = () => {}
      scene.add(next)
      helper.current = next
      return () => {
        scene.remove(next)
        next.dispose()
        helper.current = null
      }
    } catch (error) {
      console.warn('Light helper unavailable', error)
      return
    }
  }, [directional, point, scene, spot, type])

  useFrame(() => {
    const object = helper.current as { update?: () => void } | null
    object?.update?.()
  })

  return null
}
