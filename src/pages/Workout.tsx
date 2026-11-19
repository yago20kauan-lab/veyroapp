import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { AnimatePresence, motion } from 'framer-motion'
import { db, type Exercise, type Session, type SetLog } from '../db/schema'
import { save } from '../db/repo'
import { Card, Chip, Label, PrimaryButton } from '../ui/primitives'
import { BottomSheet, RestTimerPill, useToast } from '../ui/overlays'
import { WheelPicker } from '../ui/WheelPicker'
import { Sparkline } from '../ui/charts'
import { IconCheck, IconPlay, IconPlus, IconSwap } from '../ui/icons'
import { VeyroLoader, VeyroMark } from '../ui/brand'
import { RecordOverlay, type RecordShow } from '../ui/RecordOverlay'
import { deleteSet, exerciseHistory, exerciseIdAt, logSet, sessionSets } from '../lib/workout'
import { getProfile, updateSettings } from '../lib/plan'
import { fmtKg, plannedSets, platesPerSide, targetForToday, warmupSets, workingKg } from '../domain/progression'
import { headline } from '../domain/records'
import { haptic } from '../lib/haptics'
import { beep, unlockAudio } from '../lib/sound'

const RPE_NONE = 5.5
const muscleLabel: Record<string, string> = {
  peito: 'peito', costas: 'costas', ombros: 'ombros', biceps: 'bíceps', triceps: 'tríceps', quadriceps: 'quadríceps',
  posterior: 'posterior', gluteos: 'glúteos', panturrilha: 'panturrilha', abdomen: 'abdômen', antebraco: 'antebraço', trapezio: 'trapézio', cardio: 'cardio',
}
const equipLabel: Record<string, string> = { barbell: 'barra', dumbbell: 'halteres', machine: 'máquina', cable: 'polia', bodyweight: 'peso corporal', cardio: 'cardio' }

function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

function Elapsed({ from }: { from: string }) {
  const now = useNow()
  const s = Math.max(0, Math.floor((now - Date.parse(from)) / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return <span className="num">{h ? `${h}:${String(m).padStart(2, '0')}` : m}:{ss}</span>
}

export default function Workout() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const toast = useToast((s) => s.show)
  const session = useLiveQuery(() => db.sessions.get(id), [id])
  const exercises = useLiveQuery(() => db.exercises.toArray())
  const profile = useLiveQuery(() => getProfile())
  const allSets = useLiveQuery(() => sessionSets(id), [id]) ?? []
  const exMap = useMemo(() => new Map((exercises ?? []).map((e) => [e.id, e])), [exercises])

  const idx = session?.currentIndex ?? 0
  const items = session?.items ?? []
  const item = items[idx]
  const exId = session ? exerciseIdAt(session, idx) : undefined
  const ex = exId ? exMap.get(exId) : undefined
  const hist = useLiveQuery(() => (exId ? exerciseHistory(exId, id) : Promise.resolve(undefined)), [exId, id])
  const oldKg = exId ? profile?.settings.oldLoads?.[exId] : undefined

  const target = useMemo(() => {
    if (!ex || !item || !hist || !session) return null
    return targetForToday({ exercise: ex, item, history: hist.sessions, phase: session.phase ?? null, oldKg })
  }, [ex, item, hist, session, oldKg])

  const exSets = allSets.filter((s) => s.exerciseId === exId)
  const done = exSets.filter((s) => s.type !== 'warmup')
  const warmDone = exSets.filter((s) => s.type === 'warmup')
  const [extra, setExtra] = useState(0)
  const planned = target?.sets ?? item?.sets ?? 3
  const rows = Math.max(planned + extra, done.length)
  const activeRow = done.length < planned + extra ? done.length : -1
  const lastSess = hist?.sessions.at(-1)
  const lastWorking = lastSess?.sets.filter((s) => s.type !== 'warmup') ?? []

  // valores dos seletores
  const [kg, setKg] = useState(20)
  const [reps, setReps] = useState(10)
  const [rpe, setRpe] = useState(RPE_NONE)
  const [secs, setSecs] = useState(40)
  const initKey = `${exId}:${activeRow}:${target?.kg ?? 'x'}`
  const lastInit = useRef('')
  useEffect(() => {
    if (!ex || !target || lastInit.current === initKey) return
    lastInit.current = initKey
    const prevHere = done.at(-1)
    const ant = lastWorking[activeRow] ?? lastWorking.at(-1)
    setKg(prevHere?.kg ?? target.kg ?? ant?.kg ?? (ex.equipment === 'barbell' ? 20 : 10))
    setReps(ant?.reps && ant.reps >= target.repMin ? Math.min(ant.reps + (target.kind === 'more-reps' ? 1 : 0), target.repMax) : target.repMin)
    setRpe(RPE_NONE)
    const it = item
    if (ex.kind === 'time') setSecs(it?.seconds ?? 40)
    if (ex.kind === 'cardio') setSecs(it?.minutes ?? 20)
  }, [initKey, ex, target, done, lastWorking, activeRow, item])
  useEffect(() => setExtra(0), [exId])

  // descanso
  const restEndsAt = session?.restEndsAt
  const now = useNow(250)
  const beeped = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (restEndsAt && now >= restEndsAt && beeped.current !== restEndsAt) {
      beeped.current = restEndsAt
      if (profile?.settings.sound !== false) beep()
      haptic('strong')
      if (session) void save('sessions', { ...session, restEndsAt: undefined })
    }
  }, [now, restEndsAt, session, profile])

  // folhas
  const [sheet, setSheet] = useState<null | 'list' | 'swap' | 'how' | 'warmup' | 'plates' | 'calibrate' | 'note' | 'rest' | { set: SetLog }>(null)
  const [record, setRecord] = useState<RecordShow | null>(null)
  const [busy, setBusy] = useState(false)

  if (!session || !exercises || !hist) return <div className="flex h-[80vh] items-center justify-center"><VeyroLoader label="Abrindo treino" /></div>
  if (session.status !== 'active') {
    return (
      <div className="pt-safe mx-auto max-w-md px-4 pt-10 text-center">
        <p className="mb-4 text-muted">Este treino já foi encerrado.</p>
        <PrimaryButton onClick={() => nav(`/resumo/${session.id}`)}>Ver resumo</PrimaryButton>
      </div>
    )
  }
  if (!ex || !item || !target) return null

  const restSec = profile?.settings.restOverrides?.[ex.id] ?? item.restSec ?? ex.defaultRestSec
  const returnBaseline = session.phase?.type === 'return' ? oldKg : undefined
  const exDoneCount = (i: number) => {
    const eid = exerciseIdAt(session, i)
    return allSets.filter((s) => s.exerciseId === eid && s.type !== 'warmup').length
  }
  const finishedExercises = items.filter((it, i) => exDoneCount(i) >= plannedSets(it, session.phase)).length
  const note = profile?.settings.exerciseNotes?.[ex.id]

  async function goTo(i: number) {
    if (!session) return
    await save('sessions', { ...session, currentIndex: Math.max(0, Math.min(items.length - 1, i)) })
  }

  async function concluir() {
    if (!session || !ex || busy || activeRow < 0) return
    unlockAudio()
    setBusy(true)
    try {
      const data =
        ex.kind === 'time' ? { seconds: secs, reps: 1 } :
        ex.kind === 'cardio' ? { seconds: secs * 60, reps: 1 } :
        { kg, reps, rpe: rpe === RPE_NONE ? undefined : rpe }
      const { prs } = await logSet(session, ex, { setIndex: done.length, type: 'normal', ...data }, { returnBaselineKg: returnBaseline })
      haptic('medium')
      const h = headline(prs)
      if (h) {
        const prevBest = hist?.sessions.length ? Math.max(...hist.sessions.map((s) => workingKg(s) ?? 0)) : undefined
        setRecord({ exercise: ex.name, pr: h, kg, reps, previous: prevBest ? `${fmtKg(prevBest)} kg` : undefined })
      }
      // próximo passo: superset sem descanso, senão descanso
      const doneNow = done.length + 1
      const exerciseFinished = doneNow >= planned + extra
      const group = item.supersetGroup
      const nextInGroup = group ? items.findIndex((it, i) => i > idx && it.supersetGroup === group) : -1
      const firstInGroup = group ? items.findIndex((it) => it.supersetGroup === group) : -1
      let nextIndex = idx
      let rest = ex.kind === 'cardio' ? 0 : restSec
      if (group && nextInGroup !== -1) {
        nextIndex = nextInGroup
        rest = 0
      } else if (group && firstInGroup !== idx && !exerciseFinished) {
        nextIndex = firstInGroup
      } else if (exerciseFinished && idx < items.length - 1) {
        nextIndex = idx + 1
      }
      const fresh = await db.sessions.get(session.id)
      await save('sessions', { ...(fresh ?? session), currentIndex: nextIndex, restEndsAt: rest ? Date.now() + rest * 1000 : undefined, restTotal: rest })
      if (exerciseFinished && idx === items.length - 1 && !group) toast('Último exercício feito! Toque em Concluir.')
    } finally {
      setBusy(false)
    }
  }

  async function logWarmup(w: { kg: number; reps: number }, i: number) {
    if (!session || !ex) return
    await logSet(session, ex, { setIndex: 100 + i, type: 'warmup', kg: w.kg, reps: w.reps })
    haptic('light')
  }

  const kgMax = ex.equipment === 'barbell' ? 300 : ex.equipment === 'dumbbell' ? 80 : 250
  const isTime = ex.kind === 'time'
  const isCardio = ex.kind === 'cardio'
  const spark = hist.sessions.slice(-6).map((s) => workingKg(s) ?? 0).filter(Boolean)
  const sameSwap = exercises.filter((e) => e.pattern === ex.pattern && e.id !== ex.id && !e.deleted_at)

  return (
    <div className="pt-safe mx-auto max-w-md pb-40">
      {/* Cabeçalho */}
      <div className="sticky top-0 z-20 border-b border-border bg-bg/90 px-4 pb-3 pt-3 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <button onClick={() => nav('/')} className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-lg" aria-label="Voltar (o treino continua)">
            ‹
          </button>
          <div className="text-center">
            <div className="text-sm font-semibold">{session.routineName}</div>
            <div className="text-xs text-muted">
              <Elapsed from={session.startedAt} /> · {finishedExercises}/{items.length}
            </div>
          </div>
          <button onClick={() => nav(`/resumo/${session.id}`)} className="h-10 rounded-full border border-border px-4 text-sm font-semibold">
            Concluir
          </button>
        </div>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-surface2">
          <motion.div className="h-full bg-lime" animate={{ width: `${(finishedExercises / Math.max(1, items.length)) * 100}%` }} />
        </div>
      </div>

      <div className="px-4 pt-4">
        {/* Card do exercício */}
        <AnimatePresence mode="wait">
          <motion.div key={ex.id + idx} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }}>
            <Card className="mb-3">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className="label mb-1">Exercício {idx + 1} de {items.length}{item.supersetGroup ? ` · superset ${item.supersetGroup}` : ''}</div>
                  <div className="text-lg font-semibold leading-tight">{ex.name}</div>
                  <div className="text-xs text-muted">{muscleLabel[ex.primaryMuscle]} · {equipLabel[ex.equipment]}</div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button onClick={() => setSheet('how')} className="flex h-10 w-10 items-center justify-center rounded-full border border-border" aria-label="Como fazer"><IconPlay size={16} /></button>
                  <button onClick={() => setSheet('swap')} className="flex h-10 w-10 items-center justify-center rounded-full border border-border" aria-label="Trocar exercício"><IconSwap size={16} /></button>
                </div>
              </div>

              {note && <div className="mb-3 rounded-btn bg-surface2 px-3 py-2 text-xs text-muted">📌 {note}</div>}

              {!isTime && !isCardio && (
                <>
                  <Label>Alvo de hoje</Label>
                  {target.kg != null ? (
                    <div className="mt-1 flex items-end gap-2">
                      <span className="num font-display text-[56px] font-extrabold leading-none">{fmtKg(target.kg)}</span>
                      <div className="mb-1 leading-tight">
                        <div className="text-lg font-semibold">kg</div>
                        <div className="text-sm text-muted">× {target.repMin === target.repMax ? target.repMin : `${target.repMin}–${target.repMax}`} reps</div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1 font-display text-2xl font-bold">{target.kind === 'calibrate' ? 'Calibrar' : 'Livre'}</div>
                  )}
                  <div className="mt-1 text-sm text-muted">{planned} séries · {restSec >= 60 ? `${Math.round(restSec / 6) / 10}min`.replace('.', ',') : `${restSec}s`} desc.{target.rpeMax ? ` · PSE máx. ${fmtKg(target.rpeMax)}` : ''}</div>
                  <div className={`mt-1 text-sm ${target.kind === 'up' ? 'text-lime' : target.kind === 'deload' || target.kind === 'gap' ? 'text-gold' : 'text-muted'}`}>{target.reason}</div>
                  {target.kind === 'calibrate' && (
                    <PrimaryButton variant="ghost" className="mt-3 !min-h-[44px] text-sm" onClick={() => setSheet('calibrate')}>Informar carga antiga</PrimaryButton>
                  )}
                  {spark.length >= 2 && (
                    <>
                      <div className="mt-4 flex items-baseline justify-between">
                        <Label>Últimas {spark.length} sessões</Label>
                        <span className="num text-sm font-semibold">{fmtKg(spark.at(-1)!)} kg</span>
                      </div>
                      <Sparkline data={spark} height={56} />
                    </>
                  )}
                </>
              )}
              {(isTime || isCardio) && (
                <div className="text-sm text-muted">{isTime ? `Meta: ${item.sets}× ${item.seconds ?? 40}s com boa postura` : `Meta: ${item.minutes ?? 20} min em ritmo moderado`}</div>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                {ex.isCompound && target.kg != null && done.length === 0 && <Chip onClick={() => setSheet('warmup')}>Aquecimento{warmDone.length ? ` (${warmDone.length})` : ''}</Chip>}
                {ex.equipment === 'barbell' && <Chip onClick={() => setSheet('plates')}>Anilhas</Chip>}
                <Chip onClick={() => setSheet('note')}>{note ? 'Editar nota' : 'Nota'}</Chip>
              </div>
            </Card>
          </motion.div>
        </AnimatePresence>

        {/* Descanso */}
        {restEndsAt && restEndsAt > now && (
          <div className="mb-3">
            <RestTimerPill
              endsAt={restEndsAt}
              totalSec={session.restTotal ?? restSec}
              onAdjust={(d) => save('sessions', { ...session, restEndsAt: restEndsAt + d * 1000, restTotal: (session.restTotal ?? restSec) + d })}
              onSkip={() => save('sessions', { ...session, restEndsAt: undefined })}
            />
          </div>
        )}

        {/* Séries */}
        <Card className="!p-0">
          <div className="grid grid-cols-[36px_1fr_1fr] gap-2 border-b border-border px-4 py-2.5">
            <span className="label">Set</span>
            <span className="label">Anterior</span>
            <span className="label text-right">Hoje</span>
          </div>
          {Array.from({ length: rows }).map((_, i) => {
            const s = done[i]
            const ant = lastWorking[i]
            const antTxt = ant ? (isTime ? `${ant.reps ? '' : ''}—` : `${fmtKg(ant.kg ?? 0)}×${ant.reps}`) : '—'
            const isActive = i === activeRow
            return (
              <div key={i} className={`border-b border-border last:border-0 ${isActive ? 'bg-lime/[0.04]' : ''}`}>
                <button
                  className="grid w-full grid-cols-[36px_1fr_1fr] items-center gap-2 px-4 py-3 text-left"
                  onClick={() => s && setSheet({ set: s })}
                  disabled={!s}
                >
                  <span className={`num font-display text-base font-bold ${isActive ? 'text-lime' : s ? 'text-text' : 'text-muted'}`}>{i + 1}</span>
                  <span className="num text-sm text-muted">{antTxt}</span>
                  <span className="num flex items-center justify-end gap-2 text-sm font-semibold">
                    {s ? (
                      <>
                        {isTime ? `${s.seconds}s` : isCardio ? `${Math.round((s.seconds ?? 0) / 60)} min` : `${fmtKg(s.kg ?? 0)}×${s.reps}`}
                        {s.rpe ? <span className="text-xs text-muted">@{fmtKg(s.rpe)}</span> : null}
                        {s.isPR ? <span className="text-gold">★</span> : <IconCheck size={16} className="text-lime" />}
                      </>
                    ) : isActive ? (
                      <span className="text-xs text-muted">{target.kg != null ? `meta ${fmtKg(target.kg)}×${target.repMin}–${target.repMax}` : 'registrar'}</span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </span>
                </button>
                {isActive && (
                  <div className="px-3 pb-4">
                    <div className="flex gap-2">
                      {isTime ? (
                        <WheelPicker label="segundos" min={5} max={300} step={5} value={secs} onChange={setSecs} accent />
                      ) : isCardio ? (
                        <WheelPicker label="minutos" min={1} max={90} step={1} value={secs} onChange={setSecs} accent />
                      ) : (
                        <>
                          <WheelPicker label={ex.kind === 'bodyweight_plus' ? 'lastro kg' : 'kg'} min={0} max={kgMax} step={ex.stepKg || 0.5} value={kg} onChange={setKg} format={fmtKg} />
                          <WheelPicker label="reps" min={1} max={30} step={1} value={reps} onChange={setReps} />
                          <WheelPicker label="pse" min={RPE_NONE} max={10} step={0.5} value={rpe} onChange={setRpe} format={(v) => (v === RPE_NONE ? '—' : fmtKg(v))} accent />
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          <button onClick={() => setExtra((e) => e + 1)} className="flex w-full items-center justify-center gap-2 py-3 text-sm text-muted">
            <IconPlus size={16} /> Adicionar série
          </button>
        </Card>

        {/* Navegação entre exercícios */}
        <div className="mt-4 flex gap-2">
          <PrimaryButton variant="ghost" full disabled={idx === 0} onClick={() => goTo(idx - 1)}>‹ Anterior</PrimaryButton>
          <PrimaryButton variant="ghost" full disabled={idx >= items.length - 1} onClick={() => goTo(idx + 1)}>Próximo ›</PrimaryButton>
        </div>
      </div>

      {/* Barra inferior */}
      <div className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-md items-center gap-2 px-4 py-3">
          <button onClick={() => setSheet('list')} className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-btn border border-border text-xl" aria-label="Lista de exercícios">☰</button>
          <button onClick={() => setSheet('rest')} className="num h-[52px] shrink-0 rounded-btn border border-border px-3 text-sm" aria-label="Ajustar descanso">⏱ {Math.floor(restSec / 60)}:{String(restSec % 60).padStart(2, '0')}</button>
          <PrimaryButton full disabled={activeRow < 0 || busy} onClick={concluir}>
            {activeRow < 0 ? 'Séries concluídas' : '✓ Concluir série'}
          </PrimaryButton>
        </div>
      </div>

      {/* ---- Folhas ---- */}
      <BottomSheet open={sheet === 'list'} onClose={() => setSheet(null)} title="Exercícios do treino">
        <div className="flex flex-col gap-2">
          {items.map((it, i) => {
            const e = exMap.get(exerciseIdAt(session, i) ?? '')
            const c = exDoneCount(i)
            return (
              <button key={i} onClick={() => { goTo(i); setSheet(null) }} className={`flex items-center justify-between rounded-btn border px-4 py-3 text-left ${i === idx ? 'border-lime' : 'border-border'} bg-surface2`}>
                <span>
                  <span className="block text-sm font-semibold">{e?.name}</span>
                  <span className="text-xs text-muted">{plannedSets(it, session.phase)} séries{it.supersetGroup ? ` · superset ${it.supersetGroup}` : ''}{session.swaps?.[i] ? ' · trocado' : ''}</span>
                </span>
                <span className={`num text-sm font-semibold ${c >= plannedSets(it, session.phase) ? 'text-lime' : 'text-muted'}`}>{c}/{plannedSets(it, session.phase)}</span>
              </button>
            )
          })}
        </div>
      </BottomSheet>

      <BottomSheet open={sheet === 'swap'} onClose={() => setSheet(null)} title="Trocar por um equivalente">
        <p className="mb-3 text-sm text-muted">Mesmo padrão de movimento. O histórico de cada exercício fica separado.</p>
        <div className="flex flex-col gap-2">
          {sameSwap.length === 0 && <p className="text-sm text-muted">Nenhum equivalente na biblioteca.</p>}
          {sameSwap.map((e) => (
            <button
              key={e.id}
              onClick={async () => {
                await save('sessions', { ...session, swaps: { ...(session.swaps ?? {}), [idx]: e.id } })
                setSheet(null)
                toast(`Trocado por ${e.name}`)
              }}
              className="rounded-btn border border-border bg-surface2 px-4 py-3 text-left"
            >
              <span className="block text-sm font-semibold">{e.name}</span>
              <span className="text-xs text-muted">{equipLabel[e.equipment]}</span>
            </button>
          ))}
          {session.swaps?.[idx] && (
            <PrimaryButton variant="ghost" full onClick={async () => {
              const sw = { ...(session.swaps ?? {}) }
              delete sw[idx]
              await save('sessions', { ...session, swaps: sw })
              setSheet(null)
            }}>Voltar ao original</PrimaryButton>
          )}
        </div>
      </BottomSheet>

      <BottomSheet open={sheet === 'how'} onClose={() => setSheet(null)} title={`Como fazer · ${ex.name}`}>
        <div className="mb-4 flex aspect-video items-center justify-center rounded-btn border border-border bg-surface2">
          {ex.videoUrl ? <video src={ex.videoUrl} autoPlay loop muted playsInline className="h-full w-full rounded-btn object-cover" /> : <div className="flex flex-col items-center gap-2 text-xs text-muted"><VeyroMark size={36} variant="mono" />Vídeo em breve</div>}
        </div>
        <Label className="mb-2">Pontos-chave</Label>
        {ex.cues?.length ? <ul className="mb-4 list-disc space-y-1 pl-5 text-sm">{ex.cues.map((c) => <li key={c}>{c}</li>)}</ul> : <p className="mb-4 text-sm text-muted">Movimento controlado, amplitude completa e sem balanço.</p>}
        {ex.commonMistakes?.length ? (
          <>
            <Label className="mb-2">Erros comuns</Label>
            <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-muted">{ex.commonMistakes.map((c) => <li key={c}>{c}</li>)}</ul>
          </>
        ) : null}
        <Label className="mb-1">Músculos</Label>
        <p className="text-sm">{[ex.primaryMuscle, ...ex.secondaryMuscles].map((m) => muscleLabel[m]).join(' · ')}</p>
      </BottomSheet>

      <BottomSheet open={sheet === 'warmup'} onClose={() => setSheet(null)} title="Aquecimento">
        <p className="mb-3 text-sm text-muted">Séries leves antes do trabalho. Não contam para recorde nem volume.</p>
        <div className="flex flex-col gap-2">
          {warmupSets(target.kg ?? 20, ex.stepKg || 0.5, ex.equipment === 'barbell' ? 20 : 0).map((w, i) => {
            const isDone = warmDone.some((d) => d.setIndex === 100 + i)
            return (
              <button key={i} disabled={isDone} onClick={() => logWarmup(w, i)} className={`flex items-center justify-between rounded-btn border px-4 py-3 ${isDone ? 'border-lime/40 text-muted' : 'border-border'} bg-surface2`}>
                <span className="num font-semibold">W{i + 1} · {fmtKg(w.kg)} kg × {w.reps}</span>
                {isDone ? <IconCheck className="text-lime" /> : <span className="text-sm text-lime">Feito</span>}
              </button>
            )
          })}
        </div>
      </BottomSheet>

      <BottomSheet open={sheet === 'plates'} onClose={() => setSheet(null)} title={`Anilhas para ${fmtKg(kg)} kg`}>
        {(() => {
          const { plates, remainder } = platesPerSide(kg, 20)
          return (
            <>
              <p className="mb-4 text-sm text-muted">Barra de 20 kg. De cada lado:</p>
              <div className="mb-4 flex items-center justify-center gap-1 py-4">
                <div className="h-3 w-16 rounded-full bg-border" />
                {plates.map((p, i) => (
                  <div key={i} className="flex items-center justify-center rounded-sm bg-lime font-bold text-onlime" style={{ height: 40 + p * 3, width: 18 + Math.min(p, 20) }}>
                    <span className="text-[10px] [writing-mode:vertical-rl]">{fmtKg(p)}</span>
                  </div>
                ))}
                <div className="h-3 w-6 rounded-full bg-border" />
              </div>
              <p className="num text-center text-lg font-semibold">{plates.length ? plates.map(fmtKg).join(' + ') : 'Só a barra'}</p>
              {remainder > 0 && <p className="mt-2 text-center text-sm text-gold">Faltam {fmtKg(remainder)} kg por lado (sem anilha desse peso)</p>}
            </>
          )
        })()}
      </BottomSheet>

      <CalibrateSheet open={sheet === 'calibrate'} ex={ex} onClose={() => setSheet(null)} />
      <NoteSheet open={sheet === 'note'} ex={ex} initial={note ?? ''} onClose={() => setSheet(null)} />
      <RestSheet open={sheet === 'rest'} ex={ex} current={restSec} onClose={() => setSheet(null)} />

      <BottomSheet open={typeof sheet === 'object' && sheet !== null} onClose={() => setSheet(null)} title="Série registrada">
        {typeof sheet === 'object' && sheet && (
          <>
            <p className="num mb-4 text-lg font-semibold">
              {isTime ? `${sheet.set.seconds}s` : isCardio ? `${Math.round((sheet.set.seconds ?? 0) / 60)} min` : `${fmtKg(sheet.set.kg ?? 0)} kg × ${sheet.set.reps}`}
              {sheet.set.rpe ? ` · PSE ${fmtKg(sheet.set.rpe)}` : ''}
            </p>
            <button
              className="h-[52px] w-full rounded-btn border border-danger/50 font-semibold text-danger"
              onClick={async () => {
                await deleteSet(sheet.set, { returnBaselineKg: returnBaseline })
                setSheet(null)
                toast('Série apagada. Recordes recalculados.')
              }}
            >
              Apagar série
            </button>
          </>
        )}
      </BottomSheet>

      <RecordOverlay show={record} onClose={() => setRecord(null)} />
    </div>
  )
}

function CalibrateSheet({ open, ex, onClose }: { open: boolean; ex: Exercise; onClose: () => void }) {
  const [v, setV] = useState(40)
  return (
    <BottomSheet open={open} onClose={onClose} title="Carga antiga" footer={
      <PrimaryButton full onClick={async () => {
        const p = await getProfile()
        await updateSettings({ oldLoads: { ...(p?.settings.oldLoads ?? {}), [ex.id]: v } })
        onClose()
      }}>Salvar {fmtKg(v)} kg</PrimaryButton>
    }>
      <p className="mb-3 text-sm text-muted">Quanto você fazia em {ex.name} antes da pausa (carga de trabalho)?</p>
      <WheelPicker min={0} max={300} step={ex.stepKg || 0.5} value={v} onChange={setV} format={fmtKg} label="kg" accent />
    </BottomSheet>
  )
}

function NoteSheet({ open, ex, initial, onClose }: { open: boolean; ex: Exercise; initial: string; onClose: () => void }) {
  const [t, setT] = useState(initial)
  useEffect(() => setT(initial), [initial, open])
  return (
    <BottomSheet open={open} onClose={onClose} title={`Nota · ${ex.name}`} footer={
      <PrimaryButton full onClick={async () => {
        const p = await getProfile()
        const notes = { ...(p?.settings.exerciseNotes ?? {}) }
        if (t.trim()) notes[ex.id] = t.trim()
        else delete notes[ex.id]
        await updateSettings({ exerciseNotes: notes })
        onClose()
      }}>Salvar nota</PrimaryButton>
    }>
      <p className="mb-2 text-sm text-muted">Aparece sempre que este exercício abrir. Ex.: "banco no furo 4".</p>
      <textarea value={t} onChange={(e) => setT(e.target.value)} rows={3} className="w-full rounded-btn border border-border bg-surface2 p-3 text-base outline-none focus:border-lime" />
    </BottomSheet>
  )
}

function RestSheet({ open, ex, current, onClose }: { open: boolean; ex: Exercise; current: number; onClose: () => void }) {
  const [v, setV] = useState(current)
  useEffect(() => setV(current), [current, open])
  return (
    <BottomSheet open={open} onClose={onClose} title="Descanso deste exercício" footer={
      <PrimaryButton full onClick={async () => {
        const p = await getProfile()
        await updateSettings({ restOverrides: { ...(p?.settings.restOverrides ?? {}), [ex.id]: v } })
        onClose()
      }}>Salvar como padrão</PrimaryButton>
    }>
      <WheelPicker min={15} max={300} step={15} value={v} onChange={setV} format={(s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`} label="min:seg" accent />
    </BottomSheet>
  )
}

export type { Session }
