import { useEffect, useMemo, useRef } from 'react'
import { haptic } from '../lib/haptics'

const ITEM = 40
const VISIBLE = 5

type Props = {
  min: number
  max: number
  step: number
  value: number
  onChange: (v: number) => void
  format?: (v: number) => string
  label?: string
  accent?: boolean
}

/** Seletor de rolagem estilo iOS: scroll-snap + vibração a cada passo. */
export function WheelPicker({ min, max, step, value, onChange, format, label, accent }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const values = useMemo(() => {
    const out: number[] = []
    const n = Math.round((max - min) / step)
    for (let i = 0; i <= n; i++) out.push(+(min + i * step).toFixed(2))
    return out
  }, [min, max, step])
  const idx = Math.max(0, values.findIndex((v) => Math.abs(v - value) < step / 2))
  const lastIdx = useRef(idx)
  const fmt = format ?? ((v: number) => String(v).replace('.', ','))

  // posiciona no valor atual
  useEffect(() => {
    const el = ref.current
    if (el && Math.abs(el.scrollTop - idx * ITEM) > ITEM / 2) el.scrollTop = idx * ITEM
  }, [idx])

  function onScroll() {
    const el = ref.current
    if (!el) return
    const i = Math.min(values.length - 1, Math.max(0, Math.round(el.scrollTop / ITEM)))
    if (i !== lastIdx.current) {
      lastIdx.current = i
      haptic('light')
      onChange(values[i])
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center">
      {label && <div className={`label mb-1 ${accent ? 'text-lime' : ''}`}>{label}</div>}
      <div className="relative w-full" style={{ height: ITEM * VISIBLE }}>
        <div
          className="pointer-events-none absolute inset-x-1 rounded-btn border border-border bg-surface2"
          style={{ top: ITEM * 2, height: ITEM }}
        />
        <div
          ref={ref}
          onScroll={onScroll}
          className="no-scrollbar relative h-full snap-y snap-mandatory overflow-y-scroll overscroll-contain"
          style={{ paddingTop: ITEM * 2, paddingBottom: ITEM * 2 }}
          role="listbox"
          aria-label={label}
        >
          {values.map((v, i) => {
            const d = Math.abs(i - idx)
            return (
              <div
                key={v}
                role="option"
                aria-selected={i === idx}
                onClick={() => {
                  ref.current?.scrollTo({ top: i * ITEM, behavior: 'smooth' })
                }}
                className={`num flex snap-center items-center justify-center transition-all ${
                  d === 0
                    ? `text-2xl font-bold ${accent ? 'text-lime' : 'text-text'}`
                    : d === 1
                      ? 'text-lg text-muted'
                      : 'text-base text-muted/40'
                }`}
                style={{ height: ITEM }}
              >
                {fmt(v)}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
