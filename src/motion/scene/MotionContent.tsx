import * as THREE from 'three'
import { CameraPath, MotionCameraRig, MotionTarget } from '@/motion/scene/MotionCamera'
import { MotionLights } from '@/motion/scene/MotionLights'
import { MotionObjectNode } from '@/motion/scene/Proxies'
import { useMotionStore } from '@/store/motionStore'

export function MotionContent({ helpers }: { helpers: boolean }) {
  const ids = useMotionStore(
    (state) => state.shots.find((shot) => shot.id === state.activeShotId)?.objects.map((item) => item.id).join('|') ?? '',
  )
  return (
    <>
      <color attach="background" args={['#121418']} />
      <hemisphereLight args={['#f4f1ec', '#2a241e', 0.22]} />
      <ambientLight intensity={0.06} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[16, 64]} />
        <meshStandardMaterial color="#1c1f27" roughness={0.94} />
      </mesh>
      <mesh position={[0, 3.2, 0]}>
        <cylinderGeometry args={[16, 16, 8, 48, 1, true]} />
        <meshBasicMaterial color="#101216" side={THREE.BackSide} />
      </mesh>
      {ids
        .split('|')
        .filter(Boolean)
        .map((id) => (
          <MotionObjectNode key={id} id={id} />
        ))}
      <MotionLights helpers={helpers} />
      <MotionCameraRig helpers={helpers} />
      {helpers && <MotionTarget />}
      {helpers && <CameraPath />}
    </>
  )
}
