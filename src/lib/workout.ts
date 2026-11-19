import { db, nowIso, type Exercise, type PersonalRecord, type Routine, type Session, type SetLog } from '../db/schema'
import { mine, save } from '../db/repo'
import { currentUserId } from '../store/session'
import { detectPRs, recomputeAll, sessionVolumePR, type PR } from '../domain/records'
import type { PastSession } from '../domain/progression'
import { totalVolume } from '../domain/volume'
import type { TodayPlan } from './plan'

/** Sessão ativa (há no máximo uma). Sessões abertas há mais de 6 h viram "abandonadas". */
export async function activeSession(): Promise<Session | undefined> {
  const list = mine(await db.sessions.where('status').equals('active').toArray())
  for (const s of list) {
    if (Date.now() - Date.parse(s.startedAt) > 6 * 3600_000) {
      await save('sessions', { ...s, status: 'abandoned', endedAt: nowIso() })
    } else return s
  }
}

export async function startSession(routine: Routine, plan: TodayPlan): Promise<Session> {
  const existing = await activeSession()
  if (existing) return existing
  const ph = plan.phase
  return save('sessions', {
    routineId: routine.id,
    routineName: routine.name,
    phaseId: ph?.phase.id,
    phase: ph ? { type: ph.phase.type, week: ph.week, pct: ph.rule?.pct, sets: ph.rule?.sets, rpeMax: ph.rule?.rpeMax, name: ph.phase.name } : null,
    planWeek: plan.week,
    items: routine.items,
    swaps: {},
    currentIndex: 0,
    startedAt: nowIso(),
    status: 'active',
  } as unknown as Session) as Promise<Session>
}

export const exerciseIdAt = (s: Session, i: number) => s.swaps?.[i] ?? s.items?.[i]?.exerciseId

/** Histórico de um exercício em outras sessões (mais antiga → mais recente). */
export async function exerciseHistory(exerciseId: string, exceptSessionId?: string): Promise<{ sessions: (PastSession & { sessionId: string })[]; sets: SetLog[] }> {
  const sets = mine(await db.sets.where('exerciseId').equals(exerciseId).toArray()).sort((a, b) => a.completedAt.localeCompare(b.completedAt))
  const by = new Map<string, SetLog[]>()
  for (const s of sets) {
    if (s.sessionId === exceptSessionId) continue
    by.set(s.sessionId, [...(by.get(s.sessionId) ?? []), s])
  }
  const sessions = [...by.entries()].map(([sessionId, ss]) => ({
    sessionId,
    date: ss[0].completedAt,
    sets: ss.sort((a, b) => a.setIndex - b.setIndex).map((x) => ({ kg: x.kg, reps: x.reps, rpe: x.rpe, type: x.type })),
  }))
  return { sessions, sets }
}

/** Registra uma série e devolve os recordes batidos (se houver). */
export async function logSet(
  session: Session,
  exercise: Exercise,
  data: { setIndex: number; kg?: number; reps?: number; seconds?: number; rpe?: number; type: SetLog['type'] },
  opts: { returnBaselineKg?: number; bodyweightKg?: number } = {},
): Promise<{ set: SetLog; prs: PR[] }> {
  const prior = mine(await db.sets.where('exerciseId').equals(exercise.id).toArray())
  const draft = { id: crypto.randomUUID(), sessionId: session.id, completedAt: nowIso(), ...data }
  const prs = exercise.kind === 'weight' || exercise.kind === 'bodyweight_plus'
    ? detectPRs(draft, prior.map((p) => ({ id: p.id, sessionId: p.sessionId, completedAt: p.completedAt, kg: p.kg, reps: p.reps, type: p.type })), opts)
    : []
  const set = await save('sets', { ...draft, exerciseId: exercise.id, isPR: prs.length > 0 } as unknown as SetLog)
  for (const pr of prs) {
    await save('records', { exerciseId: exercise.id, type: pr.type, value: pr.value, reps: pr.reps ?? data.reps, setLogId: set.id, achievedAt: set.completedAt } as unknown as PersonalRecord)
  }
  return { set: set as SetLog, prs }
}

/** Apaga uma série e recalcula os recordes do exercício. */
export async function deleteSet(set: SetLog, opts: { returnBaselineKg?: number } = {}) {
  const { remove } = await import('../db/repo')
  await remove('sets', set.id)
  const all = mine(await db.sets.where('exerciseId').equals(set.exerciseId).toArray())
  const map = recomputeAll(all.map((p) => ({ id: p.id, sessionId: p.sessionId, completedAt: p.completedAt, kg: p.kg, reps: p.reps, type: p.type })), opts)
  for (const r of mine(await db.records.where('exerciseId').equals(set.exerciseId).toArray())) {
    if (r.type !== 'session_volume') await remove('records', r.id)
  }
  for (const s of all) {
    const prs = map.get(s.id) ?? []
    if (!!s.isPR !== prs.length > 0) await save('sets', { ...s, isPR: prs.length > 0 })
    for (const pr of prs) await save('records', { exerciseId: s.exerciseId, type: pr.type, value: pr.value, reps: pr.reps ?? s.reps, setLogId: s.id, achievedAt: s.completedAt } as unknown as PersonalRecord)
  }
}

export async function sessionSets(sessionId: string) {
  return mine(await db.sets.where('sessionId').equals(sessionId).toArray()).sort((a, b) => a.completedAt.localeCompare(b.completedAt))
}

/** Fecha o treino: volume, recorde de volume, cardio e sensação. */
export async function finishSession(session: Session, extra: { feeling?: Session['feeling']; note?: string; cardio?: { type: string; minutes: number } }) {
  const exs = new Map((await db.exercises.toArray()).map((e) => [e.id, e]))
  const sets = await sessionSets(session.id)
  const volume = Math.round(totalVolume(sets, exs))
  const prevSame = mine(await db.sessions.toArray()).filter((s) => s.status === 'finished' && s.routineId === session.routineId && s.id !== session.id)
  const volPR = sessionVolumePR(volume, prevSame.map((s) => s.volume ?? 0).filter(Boolean))
  if (volPR) await save('records', { exerciseId: '_session', type: 'session_volume', value: volume, setLogId: session.id, achievedAt: nowIso() } as unknown as PersonalRecord)
  if (extra.cardio && extra.cardio.minutes > 0) {
    await save('cardio', { sessionId: session.id, date: nowIso().slice(0, 10), type: extra.cardio.type, minutes: extra.cardio.minutes })
  }
  await save('sessions', { ...session, status: 'finished', endedAt: nowIso(), volume, feeling: extra.feeling, note: extra.note, restEndsAt: undefined })
  return { volume, volPR }
}

export async function lastFinishedOfRoutine(routineId: string | undefined, exceptId: string) {
  if (!routineId) return undefined
  return mine(await db.sessions.toArray())
    .filter((s) => s.status === 'finished' && s.routineId === routineId && s.id !== exceptId)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0]
}

export const uidNow = currentUserId
