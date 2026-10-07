import { Grid, OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { SceneContent } from '@/components/scene/SceneContent'
import { TransformGizmo } from '@/components/scene/TransformGizmo'
import { interaction } from '@/components/scene/interaction'
import { analyzeCamera } from '@/lib/geometry/cameraAnalysis'
import { formatSigned } from '@/lib/math'
import { useSceneStore } from '@/store/sceneStore'
import { Crosshair, Move3d, RotateCw } from 'lucide-react'

export function SceneEditor() {
  const pointer = useRef<{ x: number; y: number } | null>(null)

  return (
    <div className="absolute inset-0">
      <Canvas
        shadows="percentage"
        dpr={[1, 1.5]}
        camera={{ position: [4.6, 2.55, 3.15], fov: 35, near: 0.05, far: 80 }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.15,
        }}
        onPointerDown={(event) => {
          pointer.current = { x: event.clientX, y: event.clientY }
        }}
        onPointerMissed={(event) => {
          const start = pointer.current
          if (!start) return
          const dx = event.clientX - start.x
          const dy = event.clientY - start.y
          if (dx * dx + dy * dy > 16) return
          requestAnimationFrame(() => {
            if (!interaction.draggingId) useSceneStore.getState().select({ kind: 'none' })
          })
        }}
      >
        <SceneContent helpers />
        <Grid
          args={[20, 20]}
          position={[0, 0.005, 0]}
          cellSize={0.25}
          cellThickness={0.6}
          cellColor="#2c313c"
          sectionSize={1}
          sectionThickness={1.1}
          sectionColor="#4d4338"
          fadeDistance={16}
          fadeStrength={1.4}
          infiniteGrid
        />
        <TransformGizmo />
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          target={[0.2, 1.15, 0.4]}
          maxPolarAngle={Math.PI / 2 + 0.12}
          minDistance={0.9}
          maxDistance={16}
        />
      </Canvas>
      <EditorHud />
    </div>
  )
}

function EditorHud() {
  const subject = useSceneStore((state) => state.subject)
  const camera = useSceneStore((state) => state.shotCamera)
  const analysis = analyzeCamera(subject, camera)
  const focal = useSceneStore((state) => state.shotCamera.focalLength)
  const selection = useSceneStore((state) => state.selection)
  const mode = useSceneStore((state) => state.transformMode)
  const setMode = useSceneStore((state) => state.setTransformMode)
  const label =
    selection.kind === 'camera'
      ? 'Shot camera'
      : selection.kind === 'target'
        ? 'Focus point'
        : selection.kind === 'subject'
          ? 'Subject'
          : selection.kind === 'light'
            ? 'Light'
            : 'Nothing selected'

  return (
    <>
      <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-2">
        <Readout label="Azimuth" value={`${formatSigned(analysis.azimuth)}°`} />
        <Readout label="Elevation" value={`${formatSigned(analysis.elevation)}°`} />
        <Readout label="Distance" value={`${analysis.distance.toFixed(2)}m`} />
        <Readout label="Lens" value={`${Math.round(focal)}mm`} />
      </div>
      <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3">
        <p className="pointer-events-none max-w-sm text-[11px] leading-relaxed text-muted">
          Orbit to inspect. Drag a gizmo to place. The view on the right is the photograph.
        </p>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-line bg-panel/80 px-2.5 py-1 text-[11px] text-ink">{label}</span>
          {selection.kind !== 'none' && selection.kind !== 'target' && (
            <div className="pointer-events-auto flex rounded-full border border-line bg-panel/90 p-0.5">
              <ModeButton active={mode === 'translate'} label="Move" onClick={() => setMode('translate')}>
                <Move3d className="size-3.5" />
              </ModeButton>
              <ModeButton active={mode === 'rotate'} label="Rotate" onClick={() => setMode('rotate')}>
                <RotateCw className="size-3.5" />
              </ModeButton>
            </div>
          )}
          {selection.kind === 'camera' && (
            <button
              type="button"
              className="pointer-events-auto inline-flex items-center gap-1 rounded-full border border-line bg-panel/90 px-2.5 py-1 text-[11px] text-ink hover:border-accent/50"
              onClick={() => useSceneStore.getState().select({ kind: 'target' })}
            >
              <Crosshair className="size-3.5" />
              Aim
            </button>
          )}
        </div>
      </div>
    </>
  )
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-panel/80 px-2 py-1 backdrop-blur-sm">
      <div className="text-[9px] uppercase tracking-[0.14em] text-faint">{label}</div>
      <div className="font-mono text-xs text-ink">{value}</div>
    </div>
  )
}

function ModeButton({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean
  label: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] ${active ? 'bg-accent/20 text-accent' : 'text-muted'}`}
    >
      {children}
      {label}
    </button>
  )
}
