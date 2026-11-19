import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Session } from '../db/schema'
import { mine } from '../db/repo'
import { Header } from '../ui/Header'
import { Card, Label, PrimaryButton, EmptyState } from '../ui/primitives'
import { Ring } from '../ui/charts'
import { todayPlan } from '../lib/plan'
import { activeSession, startSession } from '../lib/workout'
import { localDate } from '../domain/plan'
import { useSession } from '../store/session'
import { IconCheck } from '../ui/icons'
import { ReadinessRing } from '../ui/charts'
import { ReadinessSheet } from '../ui/ReadinessSheet'
import { todayReadiness } from '../lib/readiness'
import { readinessAdvice } from '../domain/readiness'
import { useState } from 'react'
import { save } from '../db/repo'
import { dayLogs, latestTargets, plannedMeals, sumLogs, targetsFor, waterToday } from '../lib/diet'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
}
const fmtDate = (iso: string) => new Date(iso + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })

export default function Hoje() {
  const nav = useNavigate()
  const uid = useSession((s) => s.user?.id)
  const plan = useLiveQuery(() => todayPlan(), [uid])
  const active = useLiveQuery(() => activeSession(), [uid])
  const doneToday = useLiveQuery(async () => {
    const d = localDate()
    return (mine(await db.sessions.toArray()) as Session[]).find((s) => s.status === 'finished' && localDate(new Date(s.startedAt)) === d)
  }, [uid])
  const exercises = useLiveQuery(() => db.exercises.toArray())
  const exName = new Map(exercises?.map((e) => [e.id, e.name]))
  const readiness = useLiveQuery(() => todayReadiness(), [uid])
  const [checkin, setCheckin] = useState(false)
  const date = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
  const name = plan?.profile?.name

  async function comecar() {
    if (!plan?.routine) return
    const s = await startSession(plan.routine, plan)
    nav(`/treino/${s.id}`)
  }

  const phaseChip = plan?.phase
    ? `${plan.phase.phase.name.toUpperCase()}${plan.phase.phase.weeks ? ` · SEMANA ${plan.phase.week}/${plan.phase.phase.weeks}` : ` · SEMANA ${plan.week}`}`
    : null
  const activeDone = active ? (active.items ?? []).length : 0

  return (
    <>
      <Header />
      <div className="mb-5">
        <Label>{date}</Label>
        <h1 className="mt-1 font-display text-[26px] font-bold leading-tight">{greeting()}{name ? `, ${name}` : ''}.</h1>
        {phaseChip && <div className="mt-2 inline-block rounded-full border border-lime/40 px-3 py-1 text-[11px] font-semibold tracking-label text-lime">{phaseChip}</div>}
      </div>

      {readiness ? (
        <Card className="mb-4" onClick={() => nav('/recuperacao')}>
          <div className="flex items-center gap-4">
            <ReadinessRing score={readiness.score} size={76} />
            <div className="flex-1">
              <Label>Prontidão</Label>
              <div className="mt-0.5 font-semibold">{readinessAdvice(readiness.score).title}</div>
              <div className="text-xs text-muted">{readinessAdvice(readiness.score).text}</div>
            </div>
          </div>
        </Card>
      ) : (
        <button onClick={() => setCheckin(true)} className="mb-4 flex w-full items-center justify-between rounded-card border border-dashed border-border px-4 py-3.5 text-left">
          <span>
            <span className="block text-sm font-semibold">Como você está hoje?</span>
            <span className="text-xs text-muted">Sono, dor e energia em 3 toques</span>
          </span>
          <span className="text-lime">Check-in ›</span>
        </button>
      )}
      <ReadinessSheet open={checkin} onClose={() => setCheckin(false)} />

      <Card className="mb-4">
        <Label className="mb-2 text-lime">Treino de hoje</Label>
        {active ? (
          <div>
            <div className="font-display text-xl font-bold">{active.routineName}</div>
            <p className="mt-1 text-sm text-muted">Em andamento · {activeDone} exercícios</p>
            <PrimaryButton full className="mt-4" onClick={() => nav(`/treino/${active.id}`)}>Continuar treino</PrimaryButton>
          </div>
        ) : !plan ? null : !plan.profile?.settings.activePlan ? (
          <EmptyState
            title="Nenhum plano ativo"
            text="Escolha um programa pronto ou monte o seu. O VEYRO calcula a carga de cada série."
            action={<PrimaryButton onClick={() => nav('/treinar')}>Ver programas</PrimaryButton>}
          />
        ) : doneToday ? (
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-lime text-onlime"><IconCheck size={24} /></div>
            <div className="flex-1">
              <div className="font-semibold">{doneToday.routineName} feito</div>
              <div className="text-sm text-muted">{doneToday.volume ? `${doneToday.volume.toLocaleString('pt-BR')} kg de volume` : 'Bom trabalho.'}</div>
            </div>
            <button className="text-sm text-muted" onClick={() => nav(`/resumo/${doneToday.id}`)}>Ver</button>
          </div>
        ) : plan.notStarted ? (
          <div>
            <div className="font-display text-xl font-bold">Começa {fmtDate(plan.startDate!)}</div>
            <p className="mt-1 text-sm text-muted">Quer adiantar? Escolha um treino na aba Treinar.</p>
          </div>
        ) : plan.routine ? (
          <div>
            <div className="font-display text-xl font-bold">{plan.routine.name}</div>
            <ul className="mt-2 space-y-1 text-sm text-muted">
              {plan.routine.items.slice(0, 3).map((it, i) => <li key={i}>· {exName.get(it.exerciseId)}</li>)}
              {plan.routine.items.length > 3 && <li>+ {plan.routine.items.length - 3} exercícios</li>}
            </ul>
            <PrimaryButton full className="mt-4" onClick={comecar}>Começar treino</PrimaryButton>
          </div>
        ) : (
          <div>
            <div className="font-display text-xl font-bold">Descanso</div>
            <p className="mt-1 text-sm text-muted">Meta de hoje: 8–10 mil passos. Recuperar também é treino.</p>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card onClick={() => nav('/corpo')}>
          <Label>Peso</Label>
          <LastWeight />
        </Card>
        <Card>
          <Label>Passos</Label>
          <div className="mt-2 flex items-center gap-3">
            <Ring value={0} size={52} stroke={6}><span className="num text-[11px] font-bold">0</span></Ring>
            <span className="text-xs text-muted">meta<br />8–10 mil</span>
          </div>
        </Card>
        <WaterCard />
        <DietCard />
      </div>
    </>
  )
}

function LastWeight() {
  const uid = useSession((s) => s.user?.id)
  const last = useLiveQuery(async () => mine(await db.bodyWeights.orderBy('date').toArray()).at(-1), [uid])
  return (
    <>
      <div className="num mt-2 font-display text-3xl font-bold">{last ? last.kg.toFixed(1).replace('.', ',') : '—'}</div>
      <div className="mt-1 text-xs text-muted">{last ? 'kg · toque para registrar' : 'Toque para registrar'}</div>
    </>
  )
}

function WaterCard() {
  const uid = useSession((s) => s.user?.id)
  const data = useLiveQuery(async () => ({ ml: await waterToday(), goal: (await latestTargets())?.waterMl ?? 3000 }), [uid])
  const ml = data?.ml ?? 0
  return (
    <Card>
      <Label>Água</Label>
      <div className="mt-2 flex items-center gap-3">
        <Ring value={ml} max={data?.goal ?? 3000} size={52} stroke={6} color="#3DF2FF"><span className="num text-[11px] font-bold">{(ml / 1000).toFixed(1).replace('.', ',')} L</span></Ring>
        <button className="h-9 rounded-full border border-border px-3 text-xs" onClick={() => save('water', { date: localDate(), ml: 250 })}>+250 ml</button>
      </div>
    </Card>
  )
}

function DietCard() {
  const nav = useNavigate()
  const uid = useSession((s) => s.user?.id)
  const data = useLiveQuery(async () => {
    const d = localDate()
    const logs = await dayLogs(d)
    const { meals } = await plannedMeals(d)
    const done = new Set(logs.map((l) => l.mealName))
    return { total: sumLogs(logs), meals: meals.map((m) => done.has(m.name)), t: (await targetsFor(d)).targets }
  }, [uid])
  return (
    <Card onClick={() => nav('/dieta')}>
      <Label>Dieta</Label>
      <div className="mt-3 flex gap-1.5">
        {(data?.meals.length ? data.meals : [false, false, false, false]).map((ok, i) => <span key={i} className={`h-3 w-3 rounded-full border ${ok ? 'border-lime bg-lime' : 'border-border bg-surface2'}`} />)}
      </div>
      <div className="num mt-2 text-xs text-muted">{Math.round(data?.total.kcal ?? 0)}{data?.t.kcal ? `/${data.t.kcal}` : ''} kcal · {Math.round(data?.total.p ?? 0)} g P</div>
    </Card>
  )
}
