import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Equipment, type Exercise, type Muscle, type Routine, type RoutineItem } from '../db/schema'
import { mine, remove, save } from '../db/repo'
import { Header } from '../ui/Header'
import { Card, Chip, EmptyState, Label, PrimaryButton, SectionTitle } from '../ui/primitives'
import { BottomSheet, useToast } from '../ui/overlays'
import { useSession } from '../store/session'
import { currentUserId } from '../store/session'
import { nowIso } from '../db/schema'

const weekdays = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']
const muscles: { id: Muscle; label: string }[] = [
  { id: 'peito', label: 'Peito' }, { id: 'costas', label: 'Costas' }, { id: 'ombros', label: 'Ombros' }, { id: 'biceps', label: 'Bíceps' },
  { id: 'triceps', label: 'Tríceps' }, { id: 'quadriceps', label: 'Quadríceps' }, { id: 'posterior', label: 'Posterior' }, { id: 'gluteos', label: 'Glúteos' },
  { id: 'panturrilha', label: 'Panturrilha' }, { id: 'abdomen', label: 'Abdômen' }, { id: 'trapezio', label: 'Trapézio' }, { id: 'cardio', label: 'Cardio' },
]
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function PlanEditor() {
  const nav = useNavigate()
  const uid = useSession((s) => s.user?.id)
  const routines = useLiveQuery(async () => (mine(await db.routines.toArray()) as Routine[]).sort((a, b) => (a.fromWeek ?? 1) - (b.fromWeek ?? 1) || ((a.weekday ?? 9) || 7) - ((b.weekday ?? 9) || 7)), [uid])
  const groups = useMemo(() => {
    const m = new Map<number, Routine[]>()
    for (const r of routines ?? []) m.set(r.fromWeek ?? 1, [...(m.get(r.fromWeek ?? 1) ?? []), r])
    return [...m.entries()]
  }, [routines])

  async function novo() {
    const r = await save('routines', { name: 'Novo treino', weekday: undefined, fromWeek: groups.at(-1)?.[0] ?? 1, order: (routines?.length ?? 0), items: [], planVersion: 1 } as unknown as Routine)
    nav(`/plano/${r.id}`)
  }

  return (
    <>
      <Header title="Editar plano" />
      <p className="mb-4 text-sm text-muted">Mude exercícios, séries, reps, descanso e dias. Vale dali para frente: os treinos já feitos continuam como foram.</p>
      {!routines?.length ? (
        <EmptyState title="Nenhum treino no plano" text="Ative um programa pronto ou crie seu primeiro treino." action={<PrimaryButton onClick={novo}>Criar treino</PrimaryButton>} />
      ) : (
        groups.map(([fromWeek, rs]) => (
          <div key={fromWeek} className="mb-5">
            <Label className="mb-2 text-lime">{groups.length > 1 ? (fromWeek === 1 ? `Semanas 1–${(groups.find(([w]) => w > 1)?.[0] ?? 2) - 1}` : `Semana ${fromWeek} em diante`) : 'Treinos da semana'}</Label>
            <div className="flex flex-col gap-2">
              {rs.map((r) => (
                <Card key={r.id} onClick={() => nav(`/plano/${r.id}`)}>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="label mr-2 text-lime">{r.weekday != null ? weekdays[r.weekday] : '—'}</span>
                      <span className="font-semibold">{r.name}</span>
                      <div className="mt-0.5 text-xs text-muted">{r.items.length} exercícios{r.planVersion > 1 ? ` · versão ${r.planVersion}` : ''}</div>
                    </div>
                    <span className="text-muted">›</span>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ))
      )}
      {!!routines?.length && <PrimaryButton variant="ghost" full onClick={novo}>+ Novo treino</PrimaryButton>}
    </>
  )
}

function Stepper({ value, onChange, min = 1, max = 99, step = 1, suffix = '' }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; suffix?: string }) {
  return (
    <div className="flex items-center gap-1">
      <button className="h-8 w-8 rounded-full border border-border text-lg leading-none" onClick={() => onChange(Math.max(min, value - step))} aria-label="menos">−</button>
      <span className="num min-w-[38px] text-center text-sm font-semibold">{value}{suffix}</span>
      <button className="h-8 w-8 rounded-full border border-border text-lg leading-none" onClick={() => onChange(Math.min(max, value + step))} aria-label="mais">+</button>
    </div>
  )
}

export function RoutineEditor() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const toast = useToast((s) => s.show)
  const routine = useLiveQuery(() => db.routines.get(id), [id])
  const exercises = useLiveQuery(() => db.exercises.toArray())
  const exMap = useMemo(() => new Map((exercises ?? []).map((e) => [e.id, e])), [exercises])
  const [draft, setDraft] = useState<Routine | null>(null)
  const [adding, setAdding] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (routine && !draft) setDraft(structuredClone(routine))
  }, [routine, draft])

  if (!draft || !exercises) return null
  const set = (patch: Partial<Routine>) => { setDraft({ ...draft, ...patch }); setDirty(true) }
  const setItem = (i: number, patch: Partial<RoutineItem>) => set({ items: draft.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) })
  const move = (i: number, d: number) => {
    const j = i + d
    if (j < 0 || j >= draft.items.length) return
    const items = [...draft.items]
    ;[items[i], items[j]] = [items[j], items[i]]
    set({ items })
  }

  async function salvar() {
    if (!draft || !routine) return
    await save('planVersions', { kind: 'training', version: routine.planVersion, snapshot: routine, createdAt: nowIso() } as never)
    await save('routines', { ...draft, planVersion: (routine.planVersion ?? 1) + 1 })
    setDirty(false)
    toast('Treino salvo')
    nav('/plano')
  }

  async function excluir() {
    await remove('routines', draft!.id)
    toast('Treino removido do plano')
    nav('/plano')
  }

  return (
    <div className="pb-24">
      <Header title="Editar treino" />
      <Label className="mb-1.5">Nome</Label>
      <input value={draft.name} onChange={(e) => set({ name: e.target.value })} className="mb-4 h-12 w-full rounded-btn border border-border bg-surface2 px-4 text-base outline-none focus:border-lime" />
      <Label className="mb-2">Dia da semana</Label>
      <div className="mb-4 flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5, 6, 0].map((d) => <Chip key={d} active={draft.weekday === d} onClick={() => set({ weekday: draft.weekday === d ? undefined : d })}>{weekdays[d]}</Chip>)}
      </div>
      <div className="mb-5 flex items-center justify-between">
        <Label>Vale a partir da semana</Label>
        <Stepper value={draft.fromWeek ?? 1} onChange={(v) => set({ fromWeek: v })} min={1} max={52} />
      </div>

      <SectionTitle kicker="Exercícios" title={`${draft.items.length} no treino`} />
      <div className="flex flex-col gap-2">
        {draft.items.map((it, i) => {
          const e = exMap.get(it.exerciseId)
          const isTime = e?.kind === 'time'
          const isCardio = e?.kind === 'cardio'
          return (
            <Card key={i} className="!p-3">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">{e?.name ?? it.exerciseId}</div>
                  {it.supersetGroup && <div className="label text-lime">Superset {it.supersetGroup}</div>}
                </div>
                <div className="flex shrink-0 gap-1">
                  <button className="h-8 w-8 rounded-full border border-border" onClick={() => move(i, -1)} aria-label="subir">↑</button>
                  <button className="h-8 w-8 rounded-full border border-border" onClick={() => move(i, 1)} aria-label="descer">↓</button>
                  <button className="h-8 w-8 rounded-full border border-danger/40 text-danger" onClick={() => set({ items: draft.items.filter((_, j) => j !== i) })} aria-label="remover">×</button>
                </div>
              </div>
              {isCardio ? (
                <div className="flex items-center justify-between"><span className="text-xs text-muted">Minutos</span><Stepper value={it.minutes ?? 20} onChange={(v) => setItem(i, { minutes: v })} min={5} max={120} step={5} /></div>
              ) : (
                <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                  <div className="flex items-center justify-between"><span className="text-xs text-muted">Séries</span><Stepper value={it.sets} onChange={(v) => setItem(i, { sets: v })} min={1} max={10} /></div>
                  {isTime ? (
                    <div className="flex items-center justify-between"><span className="text-xs text-muted">Seg</span><Stepper value={it.seconds ?? 40} onChange={(v) => setItem(i, { seconds: v })} min={10} max={300} step={5} /></div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between"><span className="text-xs text-muted">Mín</span><Stepper value={it.repMin} onChange={(v) => setItem(i, { repMin: v, repMax: Math.max(v, it.repMax) })} min={1} max={30} /></div>
                      <div className="flex items-center justify-between"><span className="text-xs text-muted">Máx</span><Stepper value={it.repMax} onChange={(v) => setItem(i, { repMax: v, repMin: Math.min(v, it.repMin) })} min={1} max={30} /></div>
                    </>
                  )}
                  <div className="flex items-center justify-between"><span className="text-xs text-muted">Desc.</span><Stepper value={it.restSec} onChange={(v) => setItem(i, { restSec: v })} min={0} max={300} step={15} suffix="s" /></div>
                  <div className="col-span-2 flex items-center justify-between">
                    <span className="text-xs text-muted">Superset</span>
                    <div className="flex gap-1.5">
                      {[undefined, 'A', 'B', 'C'].map((g) => (
                        <button key={g ?? 'n'} onClick={() => setItem(i, { supersetGroup: g })} className={`h-8 min-w-8 rounded-full border px-2 text-xs ${it.supersetGroup === g ? 'border-lime bg-lime text-onlime' : 'border-border'}`}>{g ?? '—'}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </Card>
          )
        })}
      </div>
      <PrimaryButton variant="ghost" full className="mt-3" onClick={() => setAdding(true)}>+ Adicionar exercício</PrimaryButton>
      <button className="mt-6 w-full py-3 text-sm font-semibold text-danger" onClick={excluir}>Remover este treino do plano</button>

      <div className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-md gap-2 px-4 py-3">
          <PrimaryButton variant="ghost" onClick={() => nav('/plano')}>Cancelar</PrimaryButton>
          <PrimaryButton full disabled={!dirty} onClick={salvar}>Salvar treino</PrimaryButton>
        </div>
      </div>

      <ExercisePicker
        open={adding}
        onClose={() => setAdding(false)}
        exercises={exercises}
        onPick={(e) => {
          set({ items: [...draft.items, { exerciseId: e.id, sets: 3, repMin: 8, repMax: 12, restSec: e.defaultRestSec, ...(e.kind === 'cardio' ? { minutes: 20, sets: 1, repMin: 1, repMax: 1, restSec: 0 } : e.kind === 'time' ? { seconds: 40, repMin: 1, repMax: 1 } : {}) }] })
          setAdding(false)
        }}
      />
    </div>
  )
}

export function ExercisePicker({ open, onClose, exercises, onPick }: { open: boolean; onClose: () => void; exercises: Exercise[]; onPick: (e: Exercise) => void }) {
  const [q, setQ] = useState('')
  const [m, setM] = useState<Muscle | null>(null)
  const [creating, setCreating] = useState(false)
  const list = exercises.filter((e) => !e.deleted_at && (e.user_id === null || e.user_id === currentUserId()) && (!m || e.primaryMuscle === m) && (!q || norm(e.name).includes(norm(q))))
  return (
    <BottomSheet open={open} onClose={onClose} title="Adicionar exercício">
      {creating ? (
        <CreateExercise onCreated={(e) => { setCreating(false); onPick(e) }} onCancel={() => setCreating(false)} />
      ) : (
        <>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar exercício" className="mb-3 h-12 w-full rounded-btn border border-border bg-surface2 px-4 text-base outline-none focus:border-lime" />
          <div className="no-scrollbar -mx-5 mb-3 flex gap-2 overflow-x-auto px-5">
            <Chip active={!m} onClick={() => setM(null)}>Todos</Chip>
            {muscles.map((x) => <Chip key={x.id} active={m === x.id} onClick={() => setM(x.id)}>{x.label}</Chip>)}
          </div>
          <div className="flex flex-col divide-y divide-border">
            {list.map((e) => (
              <button key={e.id} onClick={() => onPick(e)} className="flex items-center justify-between py-3 text-left">
                <span className="text-sm">{e.name}{e.user_id ? <span className="label ml-2 text-lime">seu</span> : null}</span>
                <span className="text-lime">+</span>
              </button>
            ))}
          </div>
          <PrimaryButton variant="ghost" full className="mt-3" onClick={() => setCreating(true)}>Criar exercício próprio</PrimaryButton>
        </>
      )}
    </BottomSheet>
  )
}

function CreateExercise({ onCreated, onCancel }: { onCreated: (e: Exercise) => void; onCancel: () => void }) {
  const [name, setName] = useState('')
  const [muscle, setMuscle] = useState<Muscle>('peito')
  const [equip, setEquip] = useState<Equipment>('machine')
  const [compound, setCompound] = useState(false)
  const equips: [Equipment, string][] = [['barbell', 'Barra'], ['dumbbell', 'Halteres'], ['machine', 'Máquina'], ['cable', 'Polia'], ['bodyweight', 'Peso corporal']]
  return (
    <>
      <Label className="mb-1.5">Nome</Label>
      <input value={name} onChange={(e) => setName(e.target.value)} className="mb-4 h-12 w-full rounded-btn border border-border bg-surface2 px-4 text-base outline-none focus:border-lime" />
      <Label className="mb-2">Músculo principal</Label>
      <div className="mb-4 flex flex-wrap gap-2">{muscles.filter((x) => x.id !== 'cardio').map((x) => <Chip key={x.id} active={muscle === x.id} onClick={() => setMuscle(x.id)}>{x.label}</Chip>)}</div>
      <Label className="mb-2">Equipamento</Label>
      <div className="mb-4 flex flex-wrap gap-2">{equips.map(([k, l]) => <Chip key={k} active={equip === k} onClick={() => setEquip(k)}>{l}</Chip>)}</div>
      <div className="mb-5 flex gap-2"><Chip active={!compound} onClick={() => setCompound(false)}>Isolado</Chip><Chip active={compound} onClick={() => setCompound(true)}>Composto</Chip></div>
      <div className="flex gap-2">
        <PrimaryButton variant="ghost" onClick={onCancel}>Voltar</PrimaryButton>
        <PrimaryButton full disabled={!name.trim()} onClick={async () => {
          const e = await save('exercises', {
            name: name.trim(), primaryMuscle: muscle, secondaryMuscles: [], equipment: equip, kind: equip === 'bodyweight' ? 'bodyweight_plus' : 'weight',
            pattern: `custom-${muscle}`, isCompound: compound, isUnilateral: false, stepKg: equip === 'barbell' ? 0.5 : 1, incrementKg: compound ? 2.5 : 1, defaultRestSec: compound ? 150 : 75,
          } as unknown as Exercise)
          onCreated(e as Exercise)
        }}>Criar e adicionar</PrimaryButton>
      </div>
    </>
  )
}
