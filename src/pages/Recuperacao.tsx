import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Muscle, type Phase, type ReadinessLog } from '../db/schema'
import { mine, save } from '../db/repo'
import { Header } from '../ui/Header'
import { Card, EmptyState, Label, PrimaryButton, SectionTitle } from '../ui/primitives'
import { ReadinessRing } from '../ui/charts'
import { ReadinessSheet } from '../ui/ReadinessSheet'
import { useToast } from '../ui/overlays'
import { todayReadiness } from '../lib/readiness'
import { muscleFatigue, readinessAdvice, readinessScore, shouldDeload } from '../domain/readiness'
import { localDate } from '../domain/plan'
import { useSession } from '../store/session'

const MUSCLES: { id: Muscle; label: string }[] = [
  { id: 'peito', label: 'Peito' }, { id: 'costas', label: 'Costas' }, { id: 'ombros', label: 'Ombros' }, { id: 'trapezio', label: 'Trapézio' },
  { id: 'biceps', label: 'Bíceps' }, { id: 'triceps', label: 'Tríceps' }, { id: 'antebraco', label: 'Antebraço' }, { id: 'abdomen', label: 'Abdômen' },
  { id: 'quadriceps', label: 'Quadríceps' }, { id: 'posterior', label: 'Posterior' }, { id: 'gluteos', label: 'Glúteos' }, { id: 'panturrilha', label: 'Panturrilha' },
]
const color = (f: number) => (f >= 0.66 ? '#FF5A5F' : f >= 0.33 ? '#FFB21A' : f > 0.05 ? '#C6FF3D' : '#262B33')

export default function Recuperacao() {
  const nav = useNavigate()
  const uid = useSession((s) => s.user?.id)
  const toast = useToast((s) => s.show)
  const [open, setOpen] = useState(false)
  const today = useLiveQuery(() => todayReadiness(), [uid])
  const fatigue = useLiveQuery(async () => {
    const since = new Date(Date.now() - 7 * 86400000).toISOString()
    const sets = mine(await db.sets.where('completedAt').above(since).toArray())
    const exs = new Map((await db.exercises.toArray()).map((e) => [e.id, e]))
    return muscleFatigue(sets, exs)
  }, [uid])
  const deload = useLiveQuery(async () => {
    const phases = mine(await db.phases.toArray()) as Phase[]
    const lastDeload = phases.filter((p) => p.type === 'deload').sort((a, b) => b.startDate.localeCompare(a.startDate))[0]
    const normal = phases.filter((p) => p.type === 'normal').sort((a, b) => a.startDate.localeCompare(b.startDate))[0]
    const from = lastDeload?.startDate ?? normal?.startDate
    const weeks = from ? Math.floor((Date.now() - Date.parse(from + 'T00:00')) / (7 * 86400000)) : 0
    const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7))
    const logs = mine(await db.readiness.where('date').aboveOrEqual(localDate(weekStart)).toArray()) as ReadinessLog[]
    const low = logs.filter((l) => l.score < 50).length
    const active = phases.some((p) => p.type === 'deload' && Date.now() < Date.parse(p.startDate + 'T00:00') + 7 * 86400000 && Date.now() >= Date.parse(p.startDate + 'T00:00'))
    return { ...shouldDeload(weeks, low), active }
  }, [uid])

  const breakdown = today ? readinessScore(today) : null
  const advice = today ? readinessAdvice(today.score) : null

  async function aplicarDeload() {
    await save('phases', { name: 'Deload', type: 'deload', startDate: localDate(), weeks: 1, rules: [] } as unknown as Phase)
    toast('Semana de deload ativada: mesma carga, 40% menos séries')
  }

  return (
    <>
      <Header title="Recuperação" />
      {today && advice ? (
        <Card className="mb-4">
          <div className="flex items-center gap-5">
            <ReadinessRing score={today.score} size={112} />
            <div className="flex-1">
              <div className="font-semibold">{advice.title}</div>
              <p className="mt-1 text-sm text-muted">{advice.text}</p>
              <button className="mt-2 text-sm text-lime" onClick={() => setOpen(true)}>Refazer check-in</button>
            </div>
          </div>
          {breakdown && (
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              {breakdown.parts.map((p) => (
                <div key={p.key} className="rounded-btn bg-surface2 py-2">
                  <div className="num font-bold">{p.v}</div>
                  <div className="label mt-0.5">{p.key === 'checkin' ? 'Check-in' : p.key === 'sono' ? 'Sono' : 'Carga'}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      ) : (
        <EmptyState title="Sem check-in hoje" text="Sono, dor muscular e energia: 3 toques, e o VEYRO ajusta seu treino." action={<PrimaryButton onClick={() => setOpen(true)}>Fazer check-in</PrimaryButton>} />
      )}

      <SectionTitle kicker="Últimos 7 dias" title="Fadiga por músculo" />
      <Card className="mb-4">
        <div className="grid grid-cols-3 gap-2">
          {MUSCLES.map((m) => {
            const f = fatigue?.get(m.id) ?? 0
            return (
              <div key={m.id} className="rounded-btn border border-border p-2.5">
                <div className="mb-1.5 text-xs">{m.label}</div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface2">
                  <div className="h-full rounded-full" style={{ width: `${Math.max(4, f * 100)}%`, background: color(f) }} />
                </div>
              </div>
            )
          })}
        </div>
        <p className="mt-3 text-xs text-muted">Vermelho = muito treinado nas últimas 48 h. Recupera pela metade a cada 2 dias.</p>
      </Card>

      {deload && (deload.active ? (
        <Card className="border-lime/40"><Label className="text-lime">Deload ativo</Label><p className="mt-1 text-sm text-muted">Esta semana: mesma carga e 40% menos séries.</p></Card>
      ) : deload.yes ? (
        <Card className="border-gold/40">
          <Label className="text-gold">Hora de um deload</Label>
          <p className="mb-3 mt-1 text-sm text-muted">{deload.reason}. Uma semana mais leve (mesma carga, 40% menos séries) ajuda a voltar a progredir.</p>
          <PrimaryButton onClick={aplicarDeload}>Aplicar deload por 1 semana</PrimaryButton>
        </Card>
      ) : null)}

      <div className="mt-6 text-center"><button className="text-sm text-muted" onClick={() => nav('/')}>‹ Voltar para Hoje</button></div>
      <ReadinessSheet open={open} onClose={() => setOpen(false)} />
    </>
  )
}
