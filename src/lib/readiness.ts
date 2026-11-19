import { db, type ReadinessLog } from '../db/schema'
import { mine, save } from '../db/repo'
import { readinessScore, type ReadinessInput } from '../domain/readiness'
import { totalVolume } from '../domain/volume'
import { localDate } from '../domain/plan'

export async function todayReadiness(): Promise<ReadinessLog | undefined> {
  const d = localDate()
  return mine(await db.readiness.where('date').equals(d).toArray()).at(-1) as ReadinessLog | undefined
}

/** Volume dos últimos 3 dias ÷ média de blocos de 3 dias nas últimas 4 semanas. */
export async function loadRatio(now = Date.now()): Promise<number | undefined> {
  const since = new Date(now - 28 * 86400000).toISOString()
  const sets = mine(await db.sets.where('completedAt').above(since).toArray())
  if (sets.length < 10) return undefined
  const exs = new Map((await db.exercises.toArray()).map((e) => [e.id, e]))
  const cut = new Date(now - 3 * 86400000).toISOString()
  const recent = totalVolume(sets.filter((s) => s.completedAt >= cut), exs)
  const all = totalVolume(sets, exs)
  const avg3 = (all / 28) * 3
  return avg3 > 0 ? recent / avg3 : undefined
}

export async function saveReadiness(input: Omit<ReadinessInput, 'loadRatio'>) {
  const lr = await loadRatio()
  const { score } = readinessScore({ ...input, loadRatio: lr })
  const existing = await todayReadiness()
  return save('readiness', { ...(existing ?? {}), date: localDate(), ...input, score } as unknown as ReadinessLog)
}
