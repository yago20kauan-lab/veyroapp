import { useState } from 'react'
import { BottomSheet } from './overlays'
import { Chip, Label, PrimaryButton } from './primitives'
import { WheelPicker } from './WheelPicker'
import { saveReadiness } from '../lib/readiness'

const rows = [
  { key: 'sleep', label: 'Sono', lo: 'péssimo', hi: 'ótimo' },
  { key: 'soreness', label: 'Dor muscular', lo: 'nenhuma', hi: 'muita' },
  { key: 'energy', label: 'Energia', lo: 'baixa', hi: 'alta' },
] as const

export function ReadinessSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [v, setV] = useState({ sleep: 3, soreness: 2, energy: 3 })
  const [hours, setHours] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Como você está hoje?"
      footer={
        <PrimaryButton full disabled={busy} onClick={async () => {
          setBusy(true)
          await saveReadiness({ ...v, sleepHours: hours ?? undefined })
          setBusy(false)
          onClose()
        }}>Salvar</PrimaryButton>
      }
    >
      <p className="mb-4 text-sm text-muted">3 toques. O VEYRO ajusta as cargas de hoje se você estiver cansado.</p>
      {rows.map((r) => (
        <div key={r.key} className="mb-4">
          <div className="mb-2 flex items-baseline justify-between">
            <Label>{r.label}</Label>
            <span className="text-xs text-muted">1 = {r.lo} · 5 = {r.hi}</span>
          </div>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => <Chip key={n} active={v[r.key] === n} onClick={() => setV((s) => ({ ...s, [r.key]: n }))}>{n}</Chip>)}
          </div>
        </div>
      ))}
      <div className="mb-2 flex items-center justify-between">
        <Label>Horas de sono (opcional)</Label>
        {hours === null ? <button className="text-sm text-lime" onClick={() => setHours(7)}>Informar</button> : <button className="text-sm text-muted" onClick={() => setHours(null)}>Remover</button>}
      </div>
      {hours !== null && <WheelPicker min={3} max={12} step={0.5} value={hours} onChange={setHours} format={(x) => `${String(x).replace('.', ',')} h`} accent />}
    </BottomSheet>
  )
}
