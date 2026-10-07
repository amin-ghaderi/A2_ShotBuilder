import type { ReactNode } from 'react'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/cn'

export function Section({
  title,
  active = false,
  children,
}: {
  title: string
  active?: boolean
  children: ReactNode
}) {
  return (
    <section className={cn('space-y-3 rounded-lg border bg-panel-2/80 p-3', active ? 'border-accent/45' : 'border-line')}>
      <h3 className="text-[10px] uppercase tracking-[0.16em] text-faint">{title}</h3>
      {children}
    </section>
  )
}

export function SliderField({
  label,
  value,
  min,
  max,
  step,
  onChange,
  display,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  display: string
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label>{label}</Label>
        <span className="font-mono text-[11px] text-ink">{display}</span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={([next]) => onChange(next ?? value)} />
    </div>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded-md px-2 py-1 text-[11px] transition-colors',
            value === option.value ? 'bg-accent/18 text-accent' : 'bg-white/5 text-muted hover:text-ink',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
