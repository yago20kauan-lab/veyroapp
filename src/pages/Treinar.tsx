import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Program, type Routine } from '../db/schema'
import { mine } from '../db/repo'
import { Header } from '../ui/Header'
import { Card, Chip, Label, PrimaryButton, SectionTitle } from '../ui/primitives'
import { BottomSheet, useToast } from '../ui/overlays'
import { VeyroLoader } from '../ui/brand'
import { seedPrograms } from '../db/seed-programs'
import { activateProgram, todayPlan } from '../lib/plan'
import { activeSession, startSession } from '../lib/workout'
import { localDate, nextMonday, routineForDay } from '../domain/plan'
import { useSession } from '../store/session'

const order = new Map(seedPrograms.map((p, i) => [p.id, i]))
const levelLabel = { iniciante: 'Iniciante', intermediario: 'Intermediário', avancado: 'Avançado' } as const
const weekdays = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']
const fmtDate = (iso: string) => new Date(iso + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })

export default function Treinar() {
  const nav = useNavigate()
  const uid = useSession((s) => s.user?.id)
  const programs = useLiveQuery(async () => (await db.programs.toArray()).sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99)))
  const exercises = useLiveQuery(() => db.exercises.toArray())
  const plan = useLiveQuery(() => todayPlan(), [uid])
  const routines = useLiveQuery(async () => mine(await db.routines.toArray()) as Routine[], [uid])
  const [open, setOpen] = useState<Program | null>(null)
  const [activating, setActivating] = useState<Program | null>(null)
  const toast = useToast((s) => s.show)
  const exName = new Map(exercises?.map((e) => [e.id, e.name]))
  const active = plan?.profile?.settings.activePlan

  const weekRoutines = useMemo(() => {
    if (!routines || !plan) return []
    const w = Math.max(1, plan.week)
    return [1, 2, 3, 4, 5, 6, 0].map((d) => routineForDay(routines, d, w)).filter((r): r is Routine => !!r)
  }, [routines, plan])

  async function treinar(r: Routine) {
    if (!plan) return
    const cur = await activeSession()
    if (cur && cur.routineId !== r.id) {
      toast('Você tem um treino em andamento. Conclua ou continue ele.')
      nav(`/treino/${cur.id}`)
      return
    }
    const s = await startSession(r, plan)
    nav(`/treino/${s.id}`)
  }

  return (
    <>
      <Header title="Treinar" />

      {active && plan && (
        <>
          <SectionTitle kicker="Seu plano" title={active.programName} />
          <Card className="mb-6">
            <div className="mb-3 flex flex-wrap gap-2">
              {plan.notStarted ? (
                <span className="label text-lime">Começa em {fmtDate(active.startDate)}</span>
              ) : (
                <span className="label text-lime">
                  Semana {plan.week}{plan.phase ? ` · ${plan.phase.phase.name}${plan.phase.phase.weeks ? ` ${plan.phase.week}/${plan.phase.phase.weeks}` : ''}` : ''}
                </span>
              )}
            </div>
            <div className="flex flex-col divide-y divide-border">
              {weekRoutines.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <span className="label mr-2 text-lime">{weekdays[r.weekday ?? 0]}</span>
                    <span className="font-semibold">{r.name}</span>
                    <div className="mt-0.5 text-xs text-muted">{r.items.length} exercícios</div>
                  </div>
                  <PrimaryButton variant="ghost" className="!min-h-[40px] !px-4 text-sm" onClick={() => treinar(r)}>Treinar</PrimaryButton>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      <SectionTitle kicker="Programas prontos" title={active ? 'Trocar de programa' : 'Escolha um ponto de partida'} />
      {!programs ? (
        <div className="py-16"><VeyroLoader label="Carregando" /></div>
      ) : (
        <div className="flex flex-col gap-3">
          {programs.map((p) => (
            <Card key={p.id} onClick={() => setOpen(p)} className={active?.programId === p.id ? 'border-lime/50' : ''}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-semibold">{p.name}</div>
                  <div className="mt-1 text-sm text-muted">{p.forWho}</div>
                </div>
                <div className="num shrink-0 rounded-full bg-surface2 px-3 py-1 text-xs font-semibold">{p.daysPerWeek}x/sem</div>
              </div>
              <div className="mt-3 flex gap-2">
                <span className="label">{levelLabel[p.level]}</span>
                {p.phases && <span className="label text-lime">· com fase de retorno</span>}
                {active?.programId === p.id && <span className="label text-lime">· ativo</span>}
              </div>
            </Card>
          ))}
        </div>
      )}

      <BottomSheet
        open={!!open}
        onClose={() => setOpen(null)}
        title={open?.name}
        footer={
          <>
            <PrimaryButton full onClick={() => { setActivating(open); setOpen(null) }}>
              {active?.programId === open?.id ? 'Reiniciar este programa' : 'Usar este programa'}
            </PrimaryButton>
            <Label className="mt-2 text-center">Tudo editável depois</Label>
          </>
        }
      >
        {open && (
          <>
            <p className="mb-4 text-sm text-muted">{open.description}</p>
            {open.phases && (
              <div className="mb-4 flex flex-wrap gap-2">
                {open.phases[0].rules.map((r) => <Chip key={r.week}>Sem {r.week}: {Math.round(r.pct * 100)}%</Chip>)}
              </div>
            )}
            <div className="flex flex-col gap-3">
              {open.routines.map((r, i) => (
                <div key={i} className="rounded-btn border border-border bg-surface2 p-3">
                  <div className="mb-2 flex items-center gap-2">
                    {r.weekday !== undefined && <span className="label text-lime">{weekdays[r.weekday]}</span>}
                    <span className="font-semibold">{r.name}</span>
                    {r.fromWeek && r.fromWeek > 1 && <span className="label">· semana {r.fromWeek}+</span>}
                  </div>
                  <ul className="space-y-1 text-sm text-muted">
                    {r.items.map((it, j) => (
                      <li key={j} className="flex justify-between gap-2">
                        <span>{exName.get(it.exerciseId) ?? it.exerciseId}</span>
                        <span className="num shrink-0">
                          {it.minutes ? `${it.minutes} min` : it.seconds ? `${it.sets}×${it.seconds}s` : `${it.sets}×${it.repMin === it.repMax ? it.repMin : `${it.repMin}–${it.repMax}`}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </>
        )}
      </BottomSheet>

      <ActivateSheet program={activating} hasActive={!!active} onClose={() => setActivating(null)} onDone={() => { setActivating(null); toast('Programa ativado!'); nav('/') }} />
    </>
  )
}

function ActivateSheet({ program, hasActive, onClose, onDone }: { program: Program | null; hasActive: boolean; onClose: () => void; onDone: () => void }) {
  const exercises = useLiveQuery(() => db.exercises.toArray())
  const [start, setStart] = useState<'hoje' | 'segunda'>('segunda')
  const [loads, setLoads] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const today = localDate()
  const monday = nextMonday()
  const isReturn = !!program?.phases?.some((p) => p.type === 'return')
  const loadExercises = useMemo(() => {
    if (!program || !exercises) return []
    const map = new Map(exercises.map((e) => [e.id, e]))
    const ids = [...new Set(program.routines.flatMap((r) => r.items.map((i) => i.exerciseId)))]
    return ids.map((id) => map.get(id)).filter((e) => e && e.kind === 'weight' && e.isCompound) as NonNullable<ReturnType<typeof map.get>>[]
  }, [program, exercises])

  async function ativar() {
    if (!program) return
    setBusy(true)
    const parsed: Record<string, number> = {}
    for (const [k, v] of Object.entries(loads)) {
      const n = parseFloat(v.replace(',', '.'))
      if (!Number.isNaN(n) && n > 0) parsed[k] = n
    }
    await activateProgram(program, start === 'hoje' ? today : monday, parsed)
    setBusy(false)
    onDone()
  }

  return (
    <BottomSheet open={!!program} onClose={onClose} title={`Ativar ${program?.name ?? ''}`} footer={<PrimaryButton full disabled={busy} onClick={ativar}>{busy ? 'Ativando…' : 'Ativar programa'}</PrimaryButton>}>
      {hasActive && <p className="mb-4 rounded-btn border border-gold/40 bg-gold/10 px-3 py-2 text-sm text-gold">Substitui seu plano atual. Os treinos já feitos continuam no histórico.</p>}
      <Label className="mb-2">Quando começa a semana 1?</Label>
      <div className="mb-5 flex flex-wrap gap-2">
        <Chip active={start === 'hoje'} onClick={() => setStart('hoje')}>Hoje ({fmtDate(today)})</Chip>
        {monday !== today && <Chip active={start === 'segunda'} onClick={() => setStart('segunda')}>Segunda ({fmtDate(monday)})</Chip>}
      </div>
      {isReturn && (
        <>
          <Label className="mb-1">Suas cargas antigas (opcional)</Label>
          <p className="mb-3 text-sm text-muted">Quanto você fazia antes da pausa. O retorno começa em 55% disso. Pode pular e informar no 1º treino de cada exercício.</p>
          <div className="flex flex-col gap-2">
            {loadExercises.map((e) => (
              <label key={e.id} className="flex items-center justify-between gap-3 rounded-btn border border-border bg-surface2 px-3 py-2">
                <span className="text-sm">{e.name}</span>
                <span className="flex items-center gap-1">
                  <input
                    inputMode="decimal"
                    placeholder="—"
                    value={loads[e.id] ?? ''}
                    onChange={(ev) => setLoads((l) => ({ ...l, [e.id]: ev.target.value }))}
                    className="num h-10 w-20 rounded-[10px] border border-border bg-bg text-center text-base outline-none focus:border-lime"
                  />
                  <span className="text-xs text-muted">kg</span>
                </span>
              </label>
            ))}
          </div>
        </>
      )}
    </BottomSheet>
  )
}
