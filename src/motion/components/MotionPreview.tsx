import { useEffect, useRef, useState, type RefObject } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { ASPECT_VALUES } from '@/lib/constants'
import { applyFocalLength } from '@/lib/optics'
import { evaluateCamera } from '@/motion/lib/interpolation'
import { FrameOverlay } from '@/components/preview/FrameOverlay'
import { MotionContent } from '@/motion/scene/MotionContent'
import { useMotionStore } from '@/store/motionStore'

export function MotionPreview() {
  const shot = useMotionStore((state) => state.shots.find((item) => item.id === state.activeShotId))
  const references = useMotionStore((state) => state.references)
  const imported = shot?.sourceMode === 'import-video' ? references.find((item) => item.id === shot.importedVideo?.referenceId) : undefined
  const container = useRef<HTMLDivElement>(null)
  const size = useElementSize(container)
  const ratio = ASPECT_VALUES[shot?.aspectRatio ?? '16:9']
  const fitted = fitFrame(Math.max(0, size.width - 24), Math.max(0, size.height - 24), ratio)

  return (
    <div ref={container} data-motion-preview className="absolute inset-0 flex items-center justify-center p-3">
      <div className="relative overflow-hidden rounded-sm bg-black" style={{ width: fitted.width, height: fitted.height }}>
        {imported?.kind === 'video' && imported.dataUrl ? (
          <ImportedVideo src={imported.dataUrl} start={shot?.importedVideo?.trimStart ?? 0} end={shot?.importedVideo?.trimEnd ?? imported.duration ?? 8} time={shot?.currentTime ?? 0} playing={shot?.playing ?? false} />
        ) : (
          fitted.width > 16 && (
            <Canvas shadows="percentage" dpr={[1, 1.5]} camera={{ fov: 30, near: 0.05, far: 80 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, preserveDrawingBuffer: true }}>
              <MotionContent helpers={false} />
              <ShotRig />
            </Canvas>
          )
        )}
        <FrameOverlay />
      </div>
    </div>
  )
}

function ShotRig() {
  const camera = useThree((state) => state.camera)
  const get = useThree((state) => state.get)
  useFrame(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return
    const state = useMotionStore.getState()
    const shot = state.shots.find((item) => item.id === state.activeShotId)
    if (!shot) return
    const live = evaluateCamera(shot.cameraKeys, shot.currentTime)
    camera.position.set(...live.position)
    camera.up.set(0, 1, 0)
    camera.lookAt(...live.target)
    camera.rotateZ(live.roll)
    const { size } = get()
    applyFocalLength(camera, live.focalLength, size.width / Math.max(size.height, 1))
  })
  return null
}

function ImportedVideo({ src, start, end, time, playing }: { src: string; start: number; end: number; time: number; playing: boolean }) {
  const video = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const node = video.current
    if (!node) return
    const mapped = start + Math.min(Math.max(time, 0), Math.max(0.01, end - start))
    if (Math.abs(node.currentTime - mapped) > 0.12) node.currentTime = mapped
    if (playing) void node.play().catch(() => undefined)
    else node.pause()
  }, [end, playing, start, time])
  return <video ref={video} src={src} className="h-full w-full object-contain" muted playsInline />
}

function useElementSize(ref: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const update = () => setSize({ width: element.clientWidth, height: element.clientHeight })
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])
  return size
}

function fitFrame(width: number, height: number, ratio: number) {
  if (width < 8 || height < 8) return { width: 0, height: 0 }
  if (width / height > ratio) return { width: Math.floor(height * ratio), height: Math.floor(height) }
  return { width: Math.floor(width), height: Math.floor(width / ratio) }
}
