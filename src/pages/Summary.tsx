import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema'
import { mine } from '../db/repo'
import { Card, Chip, Label, PrimaryButton } from '../ui/primitives'
import { WheelPicker } from '../ui/WheelPicker'
import { VeyroLoader } from '../ui/brand'
import { useToast } from '../ui/overlays'
import { finishSession, lastFinishedOfRoutine, sessionSets } from '../lib/workout'
import { totalVolume } from '../domain/volume'
import { fmtKg } from '../domain/progression'
import { IconTrophy } from '../ui/icons'

const feelings = [
  { v: 1, e: '😫', t: 'Pesado' },
  { v: 2, e: '😐', t: 'Ok' },
  { v: 3, e: '💪', t: 'Bom' },
  { v: 4, e: '🔥', t: 'Voando' },
] as const
const cardioTypes = ['Esteira inclinada', 'Bike', 'Escada', 'Caminhada']

export default function Summary() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const toast = useToast((s) => s.show)
  const session = useLiveQuery(() => db.sessions.get(id), [id])
  const sets = useLiveQuery(() => sessionSets(id), [id])
  const exercises = useLiveQuery(() => db.exercises.toArray())
  const prev = useLiveQuery(() => (session ? lastFinishedOfRoutine(session.routineId, id) : Promise.resolve(undefined)), [session?.routineId, id])
  const records = useLiveQuery(async () => {
    const ids = new Set((await sessionSets(id)).map((s) => s.id))
    return mine(await db.records.toArray()).filter((r) => ids.has(r.setLogId))
  }, [id])
  const cardioSaved = useLiveQuery(async () => mine(await db.cardio.where('sessionId').equals(id).toArray()), [id])

  const [feeling, setFeeling] = useState<1 | 2 | 3 | 4 | undefined>()
  const [cardioType, setCardioType] = useState<string | null>(null)
  const [minutes, setMinutes] = useState(15)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (session?.feeling) setFeeling(session.feeling)
    if (session?.note) setNote(session.note)
  }, [session?.feeling, session?.note])

  const exMap = useMemo(() => new Map((exercises ?? []).map((e) => [e.id, e])), [exercises])
  if (!session || !sets || !exercises) return <div className="flex h-[80vh] items-center justify-center"><VeyroLoader /></div>

  const working = sets.filter((s) => s.type !== 'warmup')
  const volume = Math.round(totalVolume(sets, exMap))
  const end = session.endedAt ? Date.parse(session.endedAt) : Date.now()
  const mins = Math.round((end - Date.parse(session.startedAt)) / 60000)
  const rpes = working.map((s) => s.rpe).filter((x): x is number => x != null)
  const avgRpe = rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null
  const prevVol = prev?.volume
  const volDelta = prevVol ? Math.round(((volume - prevVol) / prevVol) * 100) : null
  const prList = (records ?? []).filter((r) => r.type === 'max_kg' || r.type === 'reps_at_kg' || r.type === 'e1rm')
  const uniquePR = [...new Map(prList.map((r) => [r.exerciseId, r])).values()]
  const finished = session.status === 'finished'

  async function salvar() {
    if (!session) return
    setBusy(true)
    try {
      if (finished) {
        nav('/')
        return
      }
      const r = await finishSession(session, { feeling, note: note.trim() || undefined, cardio: cardioType ? { type: cardioType, minutes } : undefined })
      if (r.volPR) toast(`Recorde de volume do treino: ${r.volPR.label}`)
      nav('/')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pt-safe mx-auto max-w-md px-4 pb-32 pt-6">
      <Label className="text-lime">{finished ? 'Treino concluído' : 'Resumo do treino'}</Label>
      <h1 className="mt-1 font-display text-2xl font-bold">{session.routineName}</h1>
      <p className="text-sm text-muted">{new Date(session.startedAt).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Card><Label>Duração</Label><div className="num mt-1 font-display text-2xl font-bold">{mins} <span className="text-sm font-semibold text-muted">min</span></div></Card>
        <Card>
          <Label>Volume</Label>
          <div className="num mt-1 font-display text-2xl font-bold">{volume.toLocaleString('pt-BR')} <span className="text-sm font-semibold text-muted">kg</span></div>
          {volDelta != null && <div className={`num mt-1 text-xs font-semibold ${volDelta >= 0 ? 'text-success' : 'text-danger'}`}>{volDelta >= 0 ? '▲' : '▼'} {Math.abs(volDelta)}% vs. última vez</div>}
        </Card>
        <Card><Label>Séries</Label><div className="num mt-1 font-display text-2xl font-bold">{working.length}</div></Card>
        <Card><Label>PSE médio</Label><div className="num mt-1 font-display text-2xl font-bold">{avgRpe ? fmtKg(Math.round(avgRpe * 10) / 10) : '—'}</div></Card>
      </div>

      {uniquePR.length > 0 && (
        <Card className="mt-3 border-gold/40">
          <div className="mb-2 flex items-center gap-2 text-gold"><IconTrophy size={18} /><Label className="!text-gold">Recordes</Label></div>
          <ul className="space-y-1.5 text-sm">
            {uniquePR.map((r) => (
              <li key={r.id} className="flex justify-between">
                <span>{exMap.get(r.exerciseId)?.name}</span>
                <span className="num font-semibold">{r.type === 'reps_at_kg' ? `${r.value} reps` : `${fmtKg(Math.round(r.value * 10) / 10)} kg`}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {!finished && (
        <>
          <Label className="mb-2 mt-6">Fez cardio?</Label>
          <div className="flex flex-wrap gap-2">
            <Chip active={cardioType === null} onClick={() => setCardioType(null)}>Não</Chip>
            {cardioTypes.map((c) => <Chip key={c} active={cardioType === c} onClick={() => setCardioType(c)}>{c}</Chip>)}
          </div>
          {cardioType && (
            <Card className="mt-3">
              <WheelPicker label="minutos" min={5} max={90} step={5} value={minutes} onChange={setMinutes} accent />
            </Card>
          )}
        </>
      )}
      {finished && cardioSaved?.length ? <p className="mt-4 text-sm text-muted">Cardio: {cardioSaved[0].type}, {cardioSaved[0].minutes} min</p> : null}

      <Label className="mb-2 mt-6">Como foi?</Label>
      <div className="grid grid-cols-4 gap-2">
        {feelings.map((f) => (
          <button key={f.v} disabled={finished} onClick={() => setFeeling(f.v)} className={`flex flex-col items-center gap-1 rounded-btn border py-3 ${feeling === f.v ? 'border-lime bg-lime/10' : 'border-border bg-surface'}`}>
            <span className="text-2xl">{f.e}</span>
            <span className="text-[11px] text-muted">{f.t}</span>
          </button>
        ))}
      </div>
      <textarea disabled={finished} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota (opcional)" rows={2} className="mt-3 w-full rounded-btn border border-border bg-surface2 p-3 text-base outline-none focus:border-lime" />

      <div className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-md gap-2 px-4 py-3">
          {!finished && <PrimaryButton variant="ghost" onClick={() => nav(`/treino/${session.id}`)}>Voltar</PrimaryButton>}
          <PrimaryButton full disabled={busy} onClick={salvar}>{finished ? 'Fechar' : 'Salvar treino'}</PrimaryButton>
        </div>
      </div>
    </div>
  )
}
