import { db, type BodyWeight, type Exercise, type Measurement, type Session, type SetLog } from '../db/schema'
import { mine } from '../db/repo'
import { e1rm } from '../domain/records'
import { emaTrend, weeklyRate } from '../domain/trend'
import { navyBodyFat, massSplit } from '../domain/bodycomp'
import { localDate } from '../domain/plan'
import { getProfile } from './plan'

export async function weightTrend() {
  const ws = mine(await db.bodyWeights.orderBy('date').toArray()) as BodyWeight[]
  return emaTrend(ws.map((w) => ({ date: w.date, kg: w.kg })))
}

/** Ritmo agora e há 7 dias (kg/semana). */
export async function ratesNowPrev() {
  const tr = await weightTrend()
  const cut = localDate(new Date(Date.now() - 7 * 86400000))
  return { now: weeklyRate(tr), prev: weeklyRate(tr.filter((p) => p.date <= cut)), trend: tr }
}

/** Melhor 1RM estimado por exercício numa janela de datas. */
export async function bestE1rmBetween(from: string, to: string) {
  const sets = (mine(await db.sets.toArray()) as SetLog[]).filter((s) => s.type !== 'warmup' && s.completedAt.slice(0, 10) >= from && s.completedAt.slice(0, 10) <= to)
  const m = new Map<string, number>()
  for (const s of sets) {
    const v = e1rm(s.kg ?? 0, s.reps ?? 0)
    if (v != null) m.set(s.exerciseId, Math.max(m.get(s.exerciseId) ?? 0, v))
  }
  return m
}

/** Quantos exercícios perderam carga (últimas 2 semanas vs. 2 anteriores). */
export async function strengthDrops() {
  const d = (n: number) => localDate(new Date(Date.now() - n * 86400000))
  const recent = await bestE1rmBetween(d(14), d(0))
  const before = await bestE1rmBetween(d(28), d(15))
  let drops = 0
  for (const [id, v] of recent) if (before.has(id) && v < before.get(id)! * 0.95) drops++
  return drops
}

export async function compositionAt(date: string) {
  const p = await getProfile()
  const ms = (mine(await db.measurements.orderBy('date').toArray()) as Measurement[]).filter((m) => m.date <= date)
  const last = <K extends keyof Measurement>(k: K) => [...ms].reverse().find((m) => m[k] != null)?.[k] as number | undefined
  const waist = last('waistCm')
  const neck = last('neckCm')
  const hip = last('hipCm')
  const tr = (await weightTrend()).filter((x) => x.date <= date).at(-1)
  const bf = p?.sex && p.heightCm && waist && neck ? navyBodyFat(p.sex, p.heightCm, waist, neck, hip) : null
  return { waist, bf, trend: tr?.trend, split: bf != null && tr ? massSplit(tr.trend, bf) : null }
}

export async function finishedSessions() {
  return (mine(await db.sessions.toArray()) as Session[]).filter((s) => s.status === 'finished')
}

export async function exerciseMap() {
  return new Map((await db.exercises.toArray()).map((e) => [e.id, e] as [string, Exercise]))
}
