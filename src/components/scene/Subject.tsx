import { useLayoutEffect, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { interaction } from '@/components/scene/interaction'
import { registerObject } from '@/components/scene/objectRegistry'
import { useSceneStore } from '@/store/sceneStore'

const _cameraWorld = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)

export function Subject() {
  const body = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const selected = useSceneStore((state) => state.selection.kind === 'subject')

  useLayoutEffect(() => {
    registerObject('subject', body.current)
    return () => registerObject('subject', null)
  }, [])

  return (
    <group
      ref={body}
      onClick={(event) => {
        event.stopPropagation()
        useSceneStore.getState().select({ kind: 'subject' })
      }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <Mannequin selected={selected} head={head} />
      <SubjectAnimator body={body} head={head} />
    </group>
  )
}

function SubjectAnimator({
  body,
  head,
}: {
  body: RefObject<THREE.Group | null>
  head: RefObject<THREE.Group | null>
}) {
  useFrame(() => {
    const subject = useSceneStore.getState().subject
    const camera = useSceneStore.getState().shotCamera
    const bodyObject = body.current
    const headObject = head.current
    if (!bodyObject || !headObject) return

    if (interaction.draggingId !== 'subject') {
      bodyObject.position.set(subject.position[0], 0, subject.position[2])
      bodyObject.rotation.set(0, subject.bodyYaw, 0)
    }
    bodyObject.updateMatrixWorld(true)

    if (subject.gaze === 'camera') {
      _cameraWorld.set(camera.position[0], camera.position[1], camera.position[2])
      headObject.lookAt(_cameraWorld)
    } else {
      headObject.rotation.set(subject.headPitch, subject.headYaw, 0)
    }
  })
  return null
}

function Mannequin({ selected, head }: { selected: boolean; head: RefObject<THREE.Group | null> }) {
  const skin = selected ? '#e6d5c4' : '#cbb9ab'
  const joint = selected ? '#ddc6b0' : '#b7a496'
  const emissive = selected ? '#5a3b24' : '#000000'

  return (
    <group>
      <Limb a={[0.09, 0.92, 0]} b={[0.1, 0.48, 0.02]} radius={0.075} color={skin} emissive={emissive} />
      <Limb a={[-0.09, 0.92, 0]} b={[-0.1, 0.48, 0.02]} radius={0.075} color={skin} emissive={emissive} />
      <Limb a={[0.1, 0.48, 0.02]} b={[0.11, 0.06, 0.02]} radius={0.055} color={skin} emissive={emissive} />
      <Limb a={[-0.1, 0.48, 0.02]} b={[-0.11, 0.06, 0.02]} radius={0.055} color={skin} emissive={emissive} />
      <Joint position={[0.11, 0.03, 0.06]} radius={0.045} color={joint} />
      <Joint position={[-0.11, 0.03, 0.06]} radius={0.045} color={joint} />

      <mesh position={[0, 0.98, 0]} castShadow receiveShadow>
        <sphereGeometry args={[0.125, 20, 16]} />
        <meshStandardMaterial color={skin} emissive={emissive} emissiveIntensity={selected ? 0.28 : 0} roughness={0.62} />
      </mesh>
      <Limb a={[0, 1.08, 0]} b={[0, 1.46, 0]} radius={0.145} color={skin} emissive={emissive} />
      <Joint position={[0.2, 1.44, 0]} radius={0.055} color={joint} />
      <Joint position={[-0.2, 1.44, 0]} radius={0.055} color={joint} />

      <Limb a={[0.2, 1.44, 0]} b={[0.34, 1.12, 0.05]} radius={0.048} color={skin} emissive={emissive} />
      <Limb a={[-0.2, 1.44, 0]} b={[-0.34, 1.12, 0.05]} radius={0.048} color={skin} emissive={emissive} />
      <Limb a={[0.34, 1.12, 0.05]} b={[0.38, 0.82, 0.04]} radius={0.04} color={skin} emissive={emissive} />
      <Limb a={[-0.34, 1.12, 0.05]} b={[-0.38, 0.82, 0.04]} radius={0.04} color={skin} emissive={emissive} />
      <Joint position={[0.38, 0.78, 0.05]} radius={0.038} color={joint} />
      <Joint position={[-0.38, 0.78, 0.05]} radius={0.038} color={joint} />

      <mesh position={[0, 1.52, 0]} castShadow>
        <cylinderGeometry args={[0.048, 0.055, 0.08, 12]} />
        <meshStandardMaterial color={skin} roughness={0.6} />
      </mesh>

      <group ref={head} position={[0, 1.64, 0]}>
        <mesh castShadow>
          <sphereGeometry args={[0.115, 28, 20]} />
          <meshStandardMaterial
            color={selected ? '#f0dfcf' : '#d7c6b8'}
            emissive={emissive}
            emissiveIntensity={selected ? 0.2 : 0}
            roughness={0.5}
          />
        </mesh>
        <mesh position={[0, 0.01, 0.128]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <coneGeometry args={[0.028, 0.07, 12]} />
          <meshStandardMaterial color="#8d5a48" roughness={0.4} />
        </mesh>
        <mesh position={[0.038, 0.03, 0.1]} rotation={[0, 0.15, 0]}>
          <sphereGeometry args={[0.018, 12, 12]} />
          <meshStandardMaterial color="#1c1917" roughness={0.25} />
        </mesh>
        <mesh position={[-0.038, 0.03, 0.1]} rotation={[0, -0.15, 0]}>
          <sphereGeometry args={[0.018, 12, 12]} />
          <meshStandardMaterial color="#1c1917" roughness={0.25} />
        </mesh>
        <mesh position={[0, -0.035, 0.105]}>
          <boxGeometry args={[0.04, 0.008, 0.012]} />
          <meshStandardMaterial color="#a68474" roughness={0.45} />
        </mesh>
        <mesh position={[0.1, 0, 0]}>
          <sphereGeometry args={[0.028, 10, 10]} />
          <meshStandardMaterial color={joint} roughness={0.55} />
        </mesh>
        <mesh position={[-0.1, 0, 0]}>
          <sphereGeometry args={[0.028, 10, 10]} />
          <meshStandardMaterial color={joint} roughness={0.55} />
        </mesh>
      </group>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <ringGeometry args={[0.34, 0.39, 48]} />
        <meshBasicMaterial color="#d4a574" transparent opacity={selected ? 0.9 : 0} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0.02]}>
        <circleGeometry args={[0.42, 32]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.28} depthWrite={false} />
      </mesh>
    </group>
  )
}

function Joint({ position, radius, color }: { position: [number, number, number]; radius: number; color: string }) {
  return (
    <mesh position={position} castShadow>
      <sphereGeometry args={[radius, 12, 10]} />
      <meshStandardMaterial color={color} roughness={0.5} />
    </mesh>
  )
}

function Limb({
  a,
  b,
  radius,
  color,
  emissive,
}: {
  a: [number, number, number]
  b: [number, number, number]
  radius: number
  color: string
  emissive: string
}) {
  const start = new THREE.Vector3(...a)
  const end = new THREE.Vector3(...b)
  const direction = end.clone().sub(start)
  const length = Math.max(0.02, direction.length())
  const position = start.clone().add(end).multiplyScalar(0.5)
  const quaternion = new THREE.Quaternion().setFromUnitVectors(_up, direction.normalize())
  const shaft = Math.max(0.01, length - radius * 2)

  return (
    <mesh position={position} quaternion={quaternion} castShadow receiveShadow>
      <capsuleGeometry args={[radius, shaft, 4, 8]} />
      <meshStandardMaterial
        color={color}
        emissive={emissive}
        emissiveIntensity={emissive === '#000000' ? 0 : 0.22}
        roughness={0.58}
      />
    </mesh>
  )
}
