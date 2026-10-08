import { Grid, OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { evaluateCamera } from '@/motion/lib/interpolation'
import { MotionContent } from '@/motion/scene/MotionContent'
import { MotionGizmo } from '@/motion/scene/MotionGizmo'
import { motionDrag } from '@/motion/scene/registry'
import { useMotionStore } from '@/store/motionStore'
import { Move3d, RotateCw, Scaling } from 'lucide-react'

export function MotionEditor() {
  const pointer = useRef<{ x: number; y: number } | null>(null)
  return (
    <div className="absolute inset-0">
      <Canvas
        shadows="percentage"
        dpr={[1, 1.5]}
        camera={{ position: [4.8, 2.6, 3.4], fov: 35, near: 0.05, far: 80 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.12 }}
        onPointerDown={(event) => {
          pointer.current = { x: event.clientX, y: event.clientY }
        }}
        onPointerMissed={(event) => {
          const start = pointer.current
          if (!start) return
          if ((event.clientX - start.x) ** 2 + (event.clientY - start.y) ** 2 > 16) return
          requestAnimationFrame(() => {
            if (!motionDrag.id) useMotionStore.getState().setSelection({ kind: 'none' })
          })
        }}
      >
        <MotionContent helpers />
        <Grid args={[20, 20]} position={[0, 0.005, 0]} cellSize={0.25} cellColor="#2c313c" sectionSize={1} sectionColor="#4d4338" fadeDistance={16} infiniteGrid />
        <MotionGizmo />
        <OrbitControls makeDefault enableDamping target={[0, 1.1, 0.4]} maxPolarAngle={Math.PI / 2 + 0.1} minDistance={0.9} maxDistance={18} />
      </Canvas>
      <EditorChrome />
    </div>
  )
}

function EditorChrome() {
  const shot = useMotionStore((state) => state.shots.find((item) => item.id === state.activeShotId))
  const mode = useMotionStore((state) => state.transformMode)
  const live = shot ? evaluateCamera(shot.cameraKeys, shot.currentTime) : null
  return (
    <>
      <div className="pointer-events-none absolute left-3 top-3 flex gap-2">
        <Readout label="Time" value={`${(shot?.currentTime ?? 0).toFixed(2)}s`} />
        <Readout label="Lens" value={`${Math.round(live?.focalLength ?? 35)}mm`} />
      </div>
      <div className="absolute bottom-3 right-3 flex rounded-full border border-line bg-panel/90 p-0.5">
        {([
          ['translate', 'Move', Move3d],
          ['rotate', 'Rotate', RotateCw],
          ['scale', 'Scale', Scaling],
        ] as const).map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] ${mode === value ? 'bg-accent/20 text-accent' : 'text-muted'}`}
            onClick={() => useMotionStore.getState().setTransformMode(value)}
          >
            <Icon className="size-3.5" />
            {label}
          </button>
        ))}
      </div>
    </>
  )
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-panel/80 px-2 py-1">
      <div className="text-[9px] uppercase tracking-[0.14em] text-faint">{label}</div>
      <div className="font-mono text-xs">{value}</div>
    </div>
  )
}
