import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AnimatePresence, motion } from 'framer-motion'
import confetti from 'canvas-confetti'
import { db, type Goal, type PersonalRecord, type Session, type SetLog } from '../db/schema'
import { mine, remove, save } from '../db/repo'
import { Header } from '../ui/Header'
import { Card, Chip, EmptyState, Label, PrimaryButton, SectionTitle } from '../ui/primitives'
import { BottomSheet, useToast } from '../ui/overlays'
import { useSession } from '../store/session'
import { ACHIEVEMENTS, isPlateau, mondayOf, weeklyStreak } from '../domain/achievements'
import { effectiveSetsByMuscle } from '../domain/volume'
import { e1rm, REP_BUCKETS } from '../domain/records'
import { fmtKg } from '../domain/progression'
import { localDate } from '../domain/plan'
import { checkAchievements, evaluate, GOAL_TYPES, goalSeries, sessionE1rmSeries } from '../lib/goals'
import { getProfile } from '../lib/plan'
import { exerciseMap } from '../lib/progress'

const muscleLabel: Record<string, string> = { peito: 'Peito', costas: 'Costas', ombros: 'Ombros', biceps: 'Bíceps', triceps: 'Tríceps', quadriceps: 'Quadríceps', posterior: 'Posterior', gluteos: 'Glúteos', panturrilha: 'Panturrilha', abdomen: 'Abdômen', antebraco: 'Antebraço', trapezio: 'Trapézio' }
const statusLabel = { 'no-ritmo': ['No ritmo', 'text-lime'], adiantada: ['Adiantada', 'text-lime'], atrasada: ['Atrasada', 'text-gold'], 'sem-dados': ['Sem dados suficientes', 'text-muted'], concluida: ['Concluída!', 'text-lime'] } as const
const short = (iso: string) => new Date(iso.slice(0, 10) + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

export default function Progresso() {
  const nav = useNavigate()
  const toast = useToast((s) => s.show)
  const uid = useSession((s) => s.user?.id)
  const profile = useLiveQuery(() => getProfile(), [uid])
  const sessions = useLiveQuery(async () => (mine(await db.sessions.toArray()) as Session[]).filter((s) => s.status === 'finished'), [uid])
  const goals = useLiveQuery(async () => (mine(await db.goals.toArray()) as Goal[]).filter((g) => g.status !== 'archived'), [uid])
  const exMap = useLiveQuery(() => exerciseMap())
  const weekSets = useLiveQuery(async () => {
    const from = mondayOf(new Date().toISOString())
    return (mine(await db.sets.where('completedAt').aboveOrEqual(from).toArray()) as SetLog[])
  }, [uid])
  const exercisesDone = useLiveQuery(async () => {
    const sets = mine(await db.sets.toArray()) as SetLog[]
    const c = new Map<string, { n: number; last: string }>()
    for (const s of sets) if (s.type !== 'warmup') c.set(s.exerciseId, { n: (c.get(s.exerciseId)?.n ?? 0) + 1, last: s.completedAt > (c.get(s.exerciseId)?.last ?? '') ? s.completedAt : c.get(s.exerciseId)!.last })
    return [...c.entries()].sort((a, b) => b[1].last.localeCompare(a[1].last))
  }, [uid])
  const recentPRs = useLiveQuery(async () => (mine(await db.records.toArray()) as PersonalRecord[]).filter((r) => r.type === 'max_kg' || r.type === 'reps_at_kg').sort((a, b) => b.achievedAt.localeCompare(a.achievedAt)).slice(0, 6), [uid])
  const [goalOpen, setGoalOpen] = useState(false)
  const [celebrate, setCelebrate] = useState<string | null>(null)

  useEffect(() => {
    checkAchievements().then((n) => n.forEach((a) => toast(`🏅 Medalha: ${a.title}`)))
  }, [sessions?.length, toast])

  const streak = useMemo(() => weeklyStreak((sessions ?? []).map((s) => s.startedAt), Number(profile?.settings.trainingDays ?? 5)), [sessions, profile])
  const volume = useMemo(() => {
    if (!weekSets || !exMap) return []
    const m = effectiveSetsByMuscle(weekSets, exMap)
    return Object.keys(muscleLabel).map((k) => ({ k, label: muscleLabel[k], v: m.get(k as never) ?? 0 }))
  }, [weekSets, exMap])
  const heat = useMemo(() => {
    const byDay = new Map<string, Session>()
    for (const s of sessions ?? []) byDay.set(localDate(new Date(s.startedAt)), s)
    const start = new Date(mondayOf(new Date().toISOString()) + 'T12:00')
    start.setDate(start.getDate() - 7 * 11)
    return Array.from({ length: 12 }, (_, w) => Array.from({ length: 7 }, (_, d) => {
      const x = new Date(start); x.setDate(start.getDate() + w * 7 + d)
      const k = localDate(x)
      return { date: k, s: byDay.get(k), future: k > localDate() }
    }))
  }, [sessions])
  const unlocked = (profile?.settings.achievements ?? {}) as Record<string, string>

  return (
    <>
      <Header title="Progresso" />
      <div className="mb-4 grid grid-cols-3 gap-2">
        <Card className="!p-3"><Label>Sequência</Label><div className="num mt-1 text-2xl font-bold">{streak.streak}<span className="text-sm text-muted"> sem</span></div></Card>
        <Card className="!p-3"><Label>Esta semana</Label><div className="num mt-1 text-2xl font-bold">{streak.thisWeek}<span className="text-sm text-muted">/{String(profile?.settings.trainingDays ?? 5)}</span></div></Card>
        <Card className="!p-3"><Label>Treinos</Label><div className="num mt-1 text-2xl font-bold">{sessions?.length ?? 0}</div></Card>
      </div>

      <SectionTitle kicker="Metas" title="Seus objetivos" right={<button className="text-sm text-lime" onClick={() => setGoalOpen(true)}>+ Meta</button>} />
      {!goals?.length ? (
        <EmptyState title="Nenhuma meta" text="Peso, cintura, % de gordura, uma carga, frequência, passos ou proteína. O VEYRO prevê quando você chega lá." action={<PrimaryButton onClick={() => setGoalOpen(true)}>Criar meta</PrimaryButton>} />
      ) : (
        <div className="mb-2 flex flex-col gap-2">{goals.map((g) => <GoalCard key={g.id} g={g} exName={exMap?.get(g.exerciseId ?? '')?.name} onReached={(t) => setCelebrate(t)} />)}</div>
      )}

      <SectionTitle kicker="Calendário" title="Últimas 12 semanas" />
      <Card className="mb-6">
        <div className="flex gap-1">
          {heat.map((w, i) => (
            <div key={i} className="flex flex-1 flex-col gap-1">
              {w.map((d) => (
                <button key={d.date} disabled={!d.s} onClick={() => d.s && nav(`/resumo/${d.s.id}`)} className={`aspect-square rounded-[4px] ${d.future ? 'bg-transparent' : d.s ? (d.s.feeling === 4 ? 'bg-lime' : 'bg-lime/70') : 'bg-surface2'}`} aria-label={d.date} />
              ))}
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-muted"><span>12 semanas atrás</span><span>hoje</span></div>
      </Card>

      <SectionTitle kicker="Esta semana" title="Séries por músculo" />
      <Card className="mb-6">
        <div className="flex flex-col gap-1.5">
          {volume.map((v) => {
            const max = Math.max(20, ...volume.map((x) => x.v))
            return (
              <div key={v.k} className="flex items-center gap-2">
                <span className="w-[78px] shrink-0 text-right text-[11px] text-muted">{v.label}</span>
                <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-surface2">
                  <div className="absolute inset-y-0 bg-lime/10" style={{ left: `${(10 / max) * 100}%`, width: `${(10 / max) * 100}%` }} />
                  <div className={`absolute inset-y-0 left-0 rounded-full ${v.v > 20 ? 'bg-gold' : 'bg-lime'}`} style={{ width: `${(v.v / max) * 100}%` }} />
                </div>
                <span className="num w-7 text-[11px]">{v.v ? String(v.v).replace('.', ',') : ''}</span>
              </div>
            )
          })}
        </div>
        <p className="text-[11px] text-muted">Faixa clara = 10–20 séries por semana (referência). Secundários contam meia série.</p>
      </Card>

      <SectionTitle kicker="Exercícios" title="Evolução por exercício" />
      {!exercisesDone?.length ? (
        <EmptyState title="Sem treinos ainda" text="Depois do primeiro treino, cada exercício ganha gráfico de carga, 1RM estimado e recordes." />
      ) : (
        <Card className="mb-6 !p-0">
          <ul className="divide-y divide-border">
            {exercisesDone.slice(0, 20).map(([id, v]) => (
              <li key={id}><button onClick={() => nav(`/progresso/ex/${id}`)} className="flex w-full items-center justify-between px-4 py-3 text-left">
                <span className="text-sm">{exMap?.get(id)?.name ?? id}</span><span className="num text-xs text-muted">{v.n} séries ›</span>
              </button></li>
            ))}
          </ul>
        </Card>
      )}

      {!!recentPRs?.length && (
        <>
          <SectionTitle kicker="Recordes" title="Mais recentes" />
          <Card className="mb-6 !p-0">
            <ul className="divide-y divide-border">{recentPRs.map((r) => (
              <li key={r.id} className="flex justify-between px-4 py-2.5 text-sm"><span>🏆 {exMap?.get(r.exerciseId)?.name}</span><span className="num text-muted">{r.type === 'reps_at_kg' ? `${r.value} reps` : `${fmtKg(r.value)} kg`} · {short(r.achievedAt)}</span></li>
            ))}</ul>
          </Card>
        </>
      )}

      <SectionTitle kicker="Conquistas" title="Medalhas" />
      <div className="mb-6 grid grid-cols-3 gap-2">
        {ACHIEVEMENTS.map((a) => {
          const on = !!unlocked[a.code]
          return (
            <div key={a.code} className={`rounded-btn border p-3 text-center ${on ? 'border-lime/50 bg-lime/[0.06]' : 'border-border opacity-40'}`}>
              <div className="text-2xl">{on ? '🏅' : '🔒'}</div>
              <div className="mt-1 text-xs font-semibold">{a.title}</div>
            </div>
          )
        })}
      </div>

      <GoalSheet open={goalOpen} onClose={() => setGoalOpen(false)} />
      <AnimatePresence>
        {celebrate && (
          <motion.div className="pt-safe fixed inset-0 z-[70] flex flex-col items-center justify-center px-6" style={{ background: 'radial-gradient(circle at 50% 40%, rgba(198,255,61,0.25), rgba(11,13,16,0) 60%), #0B0D10' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="text-6xl">🎯</div>
            <div className="mt-4 text-[12px] font-semibold tracking-[0.24em] text-lime">META ALCANÇADA</div>
            <div className="mt-2 text-center font-display text-3xl font-extrabold">{celebrate}</div>
            <div className="mt-10 flex w-full max-w-sm flex-col gap-3">
              <PrimaryButton full onClick={() => { setCelebrate(null); setGoalOpen(true) }}>Criar a próxima meta</PrimaryButton>
              <PrimaryButton variant="ghost" full onClick={() => setCelebrate(null)}>Fechar</PrimaryButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

function GoalCard({ g, exName, onReached }: { g: Goal; exName?: string; onReached: (title: string) => void }) {
  const data = useLiveQuery(() => evaluate(g), [g.id, g.updated_at])
  const t = GOAL_TYPES[g.type]
  const title = g.type === 'lift' ? `${exName ?? 'Exercício'} ${fmtKg(g.target)} kg` : `${t.label}: ${fmtKg(g.target)} ${t.unit}`
  useEffect(() => {
    if (data?.ev.reached && g.status === 'active') {
      save('goals', { ...g, status: 'done' }).then(() => {
        onReached(title)
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 }, colors: ['#C6FF3D', '#F5F7FA'], zIndex: 80 })
      })
    }
  }, [data?.ev.reached, g, title, onReached])
  if (!data) return null
  const [st, cls] = statusLabel[data.ev.status]
  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">{g.isPrimary ? '⭐ ' : ''}{title}</div>
          <div className="num text-xs text-muted">atual {data.current != null ? fmtKg(Math.round(data.current * 10) / 10) : '—'} {t.unit} · início {fmtKg(g.start)}</div>
        </div>
        <button className="text-xs text-muted" onClick={() => remove('goals', g.id)}>Remover</button>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface2"><div className="h-full rounded-full bg-lime" style={{ width: `${data.ev.progress * 100}%` }} /></div>
      <div className="mt-1.5 flex justify-between text-xs"><span className={cls}>{g.status === 'done' ? 'Concluída!' : st}</span><span className="text-muted">{data.ev.etaDate ? `previsão ${short(data.ev.etaDate)}` : g.deadline ? `prazo ${short(g.deadline)}` : ''}</span></div>
      {!g.isPrimary && g.status === 'active' && <button className="mt-2 text-xs text-lime" onClick={async () => { for (const x of mine(await db.goals.toArray()) as Goal[]) if (x.isPrimary) await save('goals', { ...x, isPrimary: false }); await save('goals', { ...g, isPrimary: true }) }}>Fixar em Hoje</button>}
    </Card>
  )
}

function GoalSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [type, setType] = useState<Goal['type']>('weight')
  const [target, setTarget] = useState('')
  const [deadline, setDeadline] = useState('')
  const [exId, setExId] = useState('')
  const exercises = useLiveQuery(async () => (await db.exercises.toArray()).filter((e) => e.kind === 'weight' && e.isCompound))
  return (
    <BottomSheet open={open} onClose={onClose} title="Nova meta" footer={
      <PrimaryButton full disabled={!parseFloat(target.replace(',', '.')) || (type === 'lift' && !exId)} onClick={async () => {
        const draft = { type, exerciseId: type === 'lift' ? exId : undefined, target: parseFloat(target.replace(',', '.')), start: 0, deadline: deadline || undefined, status: 'active', isPrimary: false } as unknown as Goal
        const s = await goalSeries(draft)
        const has = (mine(await db.goals.toArray()) as Goal[]).some((x) => x.isPrimary && x.status === 'active')
        await save('goals', { ...draft, start: s.current ?? 0, isPrimary: !has })
        setTarget(''); onClose()
      }}>Criar meta</PrimaryButton>
    }>
      <Label className="mb-2">Tipo</Label>
      <div className="mb-4 flex flex-wrap gap-2">{(Object.keys(GOAL_TYPES) as Goal['type'][]).map((k) => <Chip key={k} active={type === k} onClick={() => setType(k)}>{GOAL_TYPES[k].label}</Chip>)}</div>
      {type === 'lift' && (
        <select value={exId} onChange={(e) => setExId(e.target.value)} className="mb-4 h-12 w-full rounded-btn border border-border bg-surface2 px-3 text-base">
          <option value="">Escolha o exercício</option>
          {exercises?.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      )}
      <Label className="mb-1">Alvo ({GOAL_TYPES[type].unit})</Label>
      <input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} className="mb-4 h-12 w-full rounded-btn border border-border bg-surface2 px-4 text-base outline-none focus:border-lime" />
      <Label className="mb-1">Prazo (opcional)</Label>
      <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="h-12 w-full rounded-btn border border-border bg-surface2 px-4 text-base [color-scheme:dark]" />
    </BottomSheet>
  )
}

export function ExerciseProgress() {
  const { id = '' } = useParams()
  const ex = useLiveQuery(() => db.exercises.get(id), [id])
  const series = useLiveQuery(() => sessionE1rmSeries(id), [id])
  const sets = useLiveQuery(async () => (mine(await db.sets.where('exerciseId').equals(id).toArray()) as SetLog[]).filter((s) => s.type !== 'warmup'), [id])
  const [metric, setMetric] = useState<'e1rm' | 'best' | 'volume'>('e1rm')
  if (!ex || !series || !sets) return null
  const buckets = REP_BUCKETS.map((b) => {
    const ok = sets.filter((s) => (s.reps ?? 0) >= b)
    const best = ok.sort((a, c) => (c.kg ?? 0) - (a.kg ?? 0))[0]
    return { b, kg: best?.kg, date: best?.completedAt }
  })
  const bestE = Math.max(0, ...sets.map((s) => e1rm(s.kg ?? 0, s.reps ?? 0) ?? 0))
  const plateau = isPlateau(series.map((s) => s.e1rm))
  return (
    <>
      <Header title={ex.name} subtitle="Progresso" />
      {plateau && <div className="mb-3 rounded-btn border border-gold/40 bg-gold/10 px-3 py-2 text-sm text-gold">Platô: 4 sessões sem subir o 1RM. Tente mudar a faixa de reps (ex.: 8–12 → 5–8) ou trocar por uma variação.</div>}
      <div className="mb-3 grid grid-cols-3 gap-2">
        <Card className="!p-3"><Label>1RM est.</Label><div className="num mt-1 text-xl font-bold">{fmtKg(Math.round(bestE * 10) / 10)}</div></Card>
        <Card className="!p-3"><Label>Maior carga</Label><div className="num mt-1 text-xl font-bold">{fmtKg(Math.max(0, ...sets.map((s) => s.kg ?? 0)))}</div></Card>
        <Card className="!p-3"><Label>Sessões</Label><div className="num mt-1 text-xl font-bold">{series.length}</div></Card>
      </div>
      <div className="mb-2 flex gap-2"><Chip active={metric === 'e1rm'} onClick={() => setMetric('e1rm')}>1RM est.</Chip><Chip active={metric === 'best'} onClick={() => setMetric('best')}>Maior carga</Chip><Chip active={metric === 'volume'} onClick={() => setMetric('volume')}>Volume</Chip></div>
      <Card className="mb-4">
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <XAxis dataKey="date" tickFormatter={short} tick={{ fill: '#9AA3AE', fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={24} />
              <YAxis tick={{ fill: '#9AA3AE', fontSize: 10 }} axisLine={false} tickLine={false} domain={['dataMin - 5', 'dataMax + 5']} tickFormatter={(v: number) => Math.round(v).toString()} />
              <Tooltip contentStyle={{ background: '#1A1E24', border: '1px solid #262B33', borderRadius: 12, fontSize: 12 }} labelFormatter={(l) => short(String(l))} formatter={(v) => [`${fmtKg(Math.round(Number(v) * 10) / 10)} kg`, metric === 'volume' ? 'volume' : metric === 'best' ? 'maior carga' : '1RM est.']} />
              <Line dataKey={metric} stroke="#C6FF3D" strokeWidth={2.5} dot={{ r: 3, fill: '#C6FF3D' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <SectionTitle kicker="Recordes" title="Por faixa de repetições" />
      <Card className="mb-4 !p-0">
        <ul className="divide-y divide-border">{buckets.map((x) => (
          <li key={x.b} className="flex justify-between px-4 py-2.5 text-sm"><span>{x.b}+ reps</span><span className="num">{x.kg != null ? `${fmtKg(x.kg)} kg` : '—'}{x.date ? <span className="text-muted"> · {short(x.date)}</span> : null}</span></li>
        ))}</ul>
      </Card>
      <SectionTitle kicker="Histórico" title="Sessões" />
      <Card className="mb-6 !p-0">
        <ul className="divide-y divide-border">{[...series].reverse().slice(0, 15).map((s, i) => (
          <li key={i} className="flex justify-between px-4 py-2.5 text-sm"><span className="text-muted">{short(s.date)}</span><span className="num">{fmtKg(s.best)} kg · 1RM {fmtKg(Math.round(s.e1rm * 10) / 10)} · vol {Math.round(s.volume)}</span></li>
        ))}</ul>
      </Card>
    </>
  )
}
