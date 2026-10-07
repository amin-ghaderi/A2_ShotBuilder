import { useEffect, useRef, useState, type RefObject } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import gsap from 'gsap'
import * as THREE from 'three'
import { SceneContent } from '@/components/scene/SceneContent'
import { CompositionGuides, GuideToggles } from '@/components/preview/CompositionGuides'
import { FrameOverlay } from '@/components/preview/FrameOverlay'
import { FramingNudge } from '@/components/controls/FramingControls'
import { ASPECT_VALUES } from '@/lib/constants'
import { applyFocalLength } from '@/lib/optics'
import { useSceneStore } from '@/store/sceneStore'

export function ShotPreview() {
  const container = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLDivElement>(null)
  const ratio = useSceneStore((state) => ASPECT_VALUES[state.framing.aspectRatio])
  const size = useElementSize(container)
  const fitted = fitFrame(Math.max(0, size.width - 24), Math.max(0, size.height - 24), ratio)
  const animated = useRef(false)

  useEffect(() => {
    const node = frame.current
    if (!node || fitted.width < 8 || fitted.height < 8) return
    if (!animated.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(node, { width: fitted.width, height: fitted.height })
      animated.current = true
      return
    }
    gsap.to(node, { width: fitted.width, height: fitted.height, duration: 0.45, ease: 'power3.inOut', overwrite: true })
  }, [fitted.width, fitted.height])

  return (
    <div className="absolute inset-0 flex flex-col">
      <div ref={container} className="relative min-h-0 flex-1">
        <div className="absolute inset-3 flex items-center justify-center">
          <div
            ref={frame}
            className="relative overflow-hidden rounded-sm bg-black shadow-[0_20px_60px_rgba(0,0,0,0.35)]"
            style={{ width: fitted.width, height: fitted.height }}
          >
            {fitted.width > 16 && fitted.height > 16 && (
              <Canvas
                shadows="percentage"
                dpr={[1, 1.5]}
                camera={{ fov: 30, near: 0.05, far: 80, position: [0, 1.6, 3.5] }}
                gl={{
                  antialias: true,
                  toneMapping: THREE.ACESFilmicToneMapping,
                  toneMappingExposure: 1.15,
                }}
              >
                <SceneContent helpers={false} />
                <ShotCameraRig />
              </Canvas>
            )}
            <CompositionGuides />
            <FrameOverlay />
          </div>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-line px-3 py-2">
        <GuideToggles />
        <FramingNudge />
      </div>
    </div>
  )
}

function ShotCameraRig() {
  const camera = useThree((state) => state.camera)
  const get = useThree((state) => state.get)
  const look = useRef(new THREE.Vector3())

  useFrame(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return
    const shot = useSceneStore.getState().shotCamera
    const { size } = get()
    camera.near = 0.05
    camera.far = 80
    camera.position.set(shot.position[0], shot.position[1], shot.position[2])
    camera.up.set(0, 1, 0)
    look.current.set(shot.target[0], shot.target[1], shot.target[2])
    camera.lookAt(look.current)
    camera.rotateZ(shot.roll)
    applyFocalLength(camera, shot.focalLength, size.width / Math.max(size.height, 1))
  })

  return null
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
  const availableRatio = width / height
  if (availableRatio > ratio) {
    return { width: Math.floor(height * ratio), height: Math.floor(height) }
  }
  return { width: Math.floor(width), height: Math.floor(width / ratio) }
}
