import { useEffect, useRef, useState } from 'react'
import { Label } from '@/components/ui/label'

function formatSeconds(value: number, digits: number) {
  return value.toFixed(digits)
}

export function SecondsInput({
  id,
  label,
  value,
  min,
  max,
  digits = 1,
  onCommit,
}: {
  id: string
  label?: string
  value: number
  min: number
  max: number
  digits?: number
  onCommit: (next: number) => void
}) {
  const focused = useRef(false)
  const [draft, setDraft] = useState(() => formatSeconds(value, digits))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!focused.current) {
      setDraft(formatSeconds(value, digits))
      setError(null)
    }
  }, [digits, value])

  const commit = () => {
    const parsed = Number(draft.trim())
    if (draft.trim() === '' || !Number.isFinite(parsed)) {
      setError(`Enter a number from ${min} to ${max}.`)
      setDraft(formatSeconds(value, digits))
      return
    }
    if (parsed < min || parsed > max) {
      setError(`Must be ${min}–${max} seconds.`)
      setDraft(formatSeconds(value, digits))
      return
    }
    setError(null)
    onCommit(parsed)
    setDraft(formatSeconds(parsed, digits))
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        {label ? (
          <Label htmlFor={id} className="shrink-0">
            {label}
          </Label>
        ) : null}
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          value={draft}
          onFocus={() => {
            focused.current = true
          }}
          onChange={(event) => {
            setDraft(event.target.value)
            setError(null)
          }}
          onBlur={() => {
            focused.current = false
            commit()
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              ;(event.target as HTMLInputElement).blur()
            }
          }}
          className="w-[4.5rem] rounded-md border border-line bg-panel px-2 py-1 font-mono text-[11px] text-ink"
        />
        <span className="text-[11px] text-faint">s</span>
      </div>
      {error && (
        <p id={`${id}-error`} className="text-[11px] text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
