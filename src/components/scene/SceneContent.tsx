import { SceneEnvironment } from '@/components/scene/SceneEnvironment'
import { AimLine, ShotCameraModel, ShotFrustum, TargetHandle } from '@/components/scene/ShotCamera'
import { Subject } from '@/components/scene/Subject'
import { VirtualLight } from '@/components/scene/VirtualLight'
import { useSceneStore } from '@/store/sceneStore'

export function SceneContent({ helpers }: { helpers: boolean }) {
  const lightKey = useSceneStore((state) => state.lights.map((light) => `${light.id}:${light.type}`).join('|'))
  const ids = lightKey ? lightKey.split('|') : []

  return (
    <>
      <hemisphereLight args={['#f4f1ec', '#2a241e', 0.22]} />
      <ambientLight intensity={0.05} />
      <SceneEnvironment />
      <Subject />
      {ids.map((entry) => {
        const id = entry.split(':')[0] ?? entry
        return <VirtualLight key={entry} id={id} helpers={helpers} />
      })}
      {helpers && <ShotCameraModel />}
      {helpers && <TargetHandle />}
      {helpers && <AimLine />}
      {helpers && <ShotFrustum />}
    </>
  )
}
