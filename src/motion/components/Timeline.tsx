import { Diamond, Pause, Play } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { evaluateCamera } from '@/motion/lib/interpolation'
import { useMotionStore } from '@/store/motionStore'

export function Timeline() {
  const shot = useMotionStore((state) => state.shots.find((item) => item.id === state.activeShotId))
  if (!shot) return null
  const live = evaluateCamera(shot.cameraKeys, shot.currentTime)

  return (
    <section className="flex h-[132px] shrink-0 flex-col border-t border-line bg-panel/90">
      <div className="flex h-9 items-center gap-2 border-b border-line px-3">
        <button
          type="button"
          className="inline-flex size-7 items-center justify-center rounded-md border border-line text-ink"
          onClick={() => useMotionStore.getState().setPlaying(!shot.playing)}
          aria-label={shot.playing ? 'Pause' : 'Play'}
        >
          {shot.playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
        </button>
        <span className="font-mono text-[11px] text-muted">
          {shot.currentTime.toFixed(2)}s / {shot.duration.toFixed(1)}s
        </span>
        <button
          type="button"
          className="rounded-md border border-line px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-muted hover:text-ink"
          onClick={() => useMotionStore.getState().insertCameraKeyframe()}
        >
          Key camera
        </button>
        <span className="ml-auto font-mono text-[11px] text-faint">{Math.round(live.focalLength)}mm</span>
      </div>
      <div className="relative min-h-0 flex-1 px-3 py-3">
        <input
          type="range"
          min={0}
          max={shot.duration}
          step={0.01}
          value={shot.currentTime}
          onChange={(event) => useMotionStore.getState().setCurrentTime(Number(event.target.value))}
          className="w-full accent-[#d4a574]"
        />
        <div className="relative mt-2 h-6">
          {shot.cameraKeys.map((key) => (
            <button
              key={key.time}
              type="button"
              title={`${key.time.toFixed(2)}s`}
              className="absolute top-0 -translate-x-1/2 text-accent"
              style={{ left: `${(key.time / shot.duration) * 100}%` }}
              onClick={() => useMotionStore.getState().setCurrentTime(key.time)}
              onDoubleClick={() => useMotionStore.getState().deleteCameraKeyframe(key.time)}
            >
              <Diamond className="size-3.5 fill-current" />
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

export function PlaybackDriver() {
  const playing = useMotionStore((state) => state.shots.find((shot) => shot.id === state.activeShotId)?.playing ?? false)
  const raf = useRef(0)
  const last = useRef(0)

  useEffect(() => {
    if (!playing) return
    last.current = performance.now()
    const loop = (now: number) => {
      useMotionStore.getState().tickPlayback(Math.min(0.05, (now - last.current) / 1000))
      last.current = now
      raf.current = requestAnimationFrame(loop)
    }
    raf.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf.current)
  }, [playing])

  return null
}
