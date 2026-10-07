import { useMemo } from 'react'
import * as THREE from 'three'
import { BACKGROUND_VISUALS } from '@/lib/constants'
import { useSceneStore } from '@/store/sceneStore'
import type { BackgroundState } from '@/types/scene'

export function SceneEnvironment() {
  const background = useSceneStore((state) => state.background)
  const visual = resolveVisual(background)
  const gradient = background.mode === 'soft-gradient'

  return (
    <>
      <Backdrop background={background} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <circleGeometry args={[16, 64]} />
        <meshStandardMaterial color={visual.floor} roughness={0.94} metalness={0} />
      </mesh>
      {gradient ? (
        <GradientWall top={background.gradientTop} bottom={background.gradientBottom} />
      ) : (
        <mesh position={[0, 3.2, 0]}>
          <cylinderGeometry args={[16, 16, 8, 48, 1, true]} />
          <meshBasicMaterial color={visual.wall} side={THREE.BackSide} />
        </mesh>
      )}
    </>
  )
}

function Backdrop({ background }: { background: BackgroundState }) {
  const texture = useMemo(() => {
    if (background.mode !== 'soft-gradient') return null
    return makeGradientTexture(background.gradientTop, background.gradientBottom)
  }, [background.mode, background.gradientTop, background.gradientBottom])

  if (texture) return <primitive attach="background" object={texture} />
  return <color attach="background" args={[resolveVisual(background).scene]} />
}

function GradientWall({ top, bottom }: { top: string; bottom: string }) {
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        topColor: { value: new THREE.Color(top) },
        bottomColor: { value: new THREE.Color(bottom) },
      },
      vertexShader: `
        varying float vHeight;
        void main() {
          vHeight = position.y;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying float vHeight;
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        void main() {
          float t = smoothstep(-4.0, 4.0, vHeight);
          gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);
        }
      `,
    })
  }, [top, bottom])

  return (
    <mesh position={[0, 3.2, 0]} material={material}>
      <cylinderGeometry args={[16, 16, 8, 48, 1, true]} />
    </mesh>
  )
}

function resolveVisual(background: BackgroundState) {
  if (background.mode === 'custom-color') {
    return { scene: background.color, floor: background.color, wall: background.color }
  }
  if (background.mode === 'soft-gradient') {
    return {
      scene: background.gradientTop,
      floor: background.gradientBottom,
      wall: background.gradientBottom,
    }
  }
  return BACKGROUND_VISUALS[background.mode]
}

function makeGradientTexture(top: string, bottom: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 4
  canvas.height = 256
  const context = canvas.getContext('2d')
  if (!context) return new THREE.Texture()
  const gradient = context.createLinearGradient(0, 0, 0, 256)
  gradient.addColorStop(0, top)
  gradient.addColorStop(1, bottom)
  context.fillStyle = gradient
  context.fillRect(0, 0, 4, 256)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}
