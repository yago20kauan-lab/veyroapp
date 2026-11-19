import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Supplement, type SupplementLog } from '../../db/schema'
import { mine, remove, save } from '../../db/repo'
import { Header } from '../../ui/Header'
import { Card, EmptyState, Label, PrimaryButton } from '../../ui/primitives'
import { BottomSheet } from '../../ui/overlays'
import { localDate } from '../../domain/plan'
import { useSession } from '../../store/session'

function streak(logs: SupplementLog[]) {
  const days = new Set(logs.map((l) => l.date))
  let n = 0
  const d = new Date()
  if (!days.has(localDate(d))) d.setDate(d.getDate() - 1)
  while (days.has(localDate(d))) { n++; d.setDate(d.getDate() - 1) }
  return n
}

export default function Suplementos() {
  const uid = useSession((s) => s.user?.id)
  const list = useLiveQuery(async () => mine(await db.supplements.toArray()) as Supplement[], [uid])
  const logs = useLiveQuery(async () => mine(await db.supplementLogs.toArray()) as SupplementLog[], [uid])
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ name: '', dose: '5', unit: 'g', time: '08:00', kcal: '', p: '' })
  const today = localDate()
  return (
    <div className="pb-24">
      <Header title="Suplementos" subtitle="Dieta" />
      {!list?.length ? (
        <EmptyState title="Nenhum suplemento" text="Cadastre e marque todo dia. Whey com macros entra na dieta sozinho." action={<PrimaryButton onClick={() => setOpen(true)}>Adicionar</PrimaryButton>} />
      ) : (
        <div className="flex flex-col gap-2">
          {list.map((s) => {
            const sl = (logs ?? []).filter((l) => l.supplementId === s.id)
            const taken = sl.find((l) => l.date === today)
            return (
              <Card key={s.id}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold">{s.name}</div>
                    <div className="num text-xs text-muted">{s.dose} {s.unit} · {s.times.join(', ')}{s.macros ? ` · ${s.macros.kcal} kcal` : ''}</div>
                    <div className="num mt-1 text-xs text-lime">🔥 {streak(sl)} dia(s) seguidos</div>
                  </div>
                  <button onClick={async () => taken ? remove('supplementLogs', taken.id) : save('supplementLogs', { supplementId: s.id, date: today, takenAt: new Date().toISOString() })} className={`h-11 rounded-full px-4 text-sm font-semibold ${taken ? 'bg-lime text-onlime' : 'border border-border'}`}>{taken ? '✓ Tomei' : 'Tomar'}</button>
                </div>
                <button className="mt-2 text-xs text-muted" onClick={() => remove('supplements', s.id)}>Remover</button>
              </Card>
            )
          })}
          <PrimaryButton variant="ghost" full onClick={() => setOpen(true)}>+ Suplemento</PrimaryButton>
        </div>
      )}
      <p className="mt-5 text-xs text-muted">Informativo. Converse com um profissional antes de iniciar suplementos.</p>
      <BottomSheet open={open} onClose={() => setOpen(false)} title="Novo suplemento" footer={
        <PrimaryButton full disabled={!f.name.trim()} onClick={async () => {
          const kcal = parseFloat(f.kcal.replace(',', '.'))
          const p = parseFloat(f.p.replace(',', '.'))
          await save('supplements', { name: f.name.trim(), dose: parseFloat(f.dose.replace(',', '.')) || 0, unit: f.unit, times: [f.time], macros: kcal > 0 ? { kcal, p: p || 0, c: 0, f: 0 } : undefined, active: true })
          setOpen(false)
          setF({ name: '', dose: '5', unit: 'g', time: '08:00', kcal: '', p: '' })
        }}>Salvar</PrimaryButton>
      }>
        {([['name', 'Nome (ex.: Creatina)'], ['dose', 'Dose'], ['unit', 'Unidade (g, cápsula, ml)'], ['kcal', 'Calorias por dose (opcional)'], ['p', 'Proteína por dose em g (opcional)']] as const).map(([k, l]) => (
          <label key={k} className="mb-3 block">
            <Label className="mb-1">{l}</Label>
            <input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} inputMode={k === 'name' || k === 'unit' ? 'text' : 'decimal'} className="h-12 w-full rounded-btn border border-border bg-surface2 px-4 text-base outline-none focus:border-lime" />
          </label>
        ))}
        <Label className="mb-1">Horário</Label>
        <input type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} className="h-12 w-full rounded-btn border border-border bg-surface2 px-4 text-base [color-scheme:dark]" />
      </BottomSheet>
    </div>
  )
}
