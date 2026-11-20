import { supabase } from './supabase'
import { db, type BodyWeight, type Session, type SetLog } from '../db/schema'
import { mine } from '../db/repo'
import { e1rm } from '../domain/records'
import { emaTrend, weeklyRate } from '../domain/trend'
import { getProfile } from './plan'
import { localDate } from '../domain/plan'

export type AIKind = 'build' | 'adapt' | 'weekly' | 'ask'

export function aiAvailability(): { ok: boolean; reason?: string } {
  if (!supabase) return { ok: false, reason: 'A IA precisa de conta (não funciona na prévia local).' }
  if (typeof navigator !== 'undefined' && !navigator.onLine) return { ok: false, reason: 'Sem internet. O resto do app continua funcionando normalmente.' }
  return { ok: true }
}

export async function callAI(kind: AIKind, payload: unknown): Promise<unknown> {
  const a = aiAvailability()
  if (!a.ok) throw new Error(a.reason)
  const { data, error } = await supabase!.functions.invoke('veyro-ai', { body: { kind, payload } })
  if (error) {
    const ctx = (error as { context?: Response }).context
    let msg = error.message
    try { const j = await ctx?.json(); if (j?.error) msg = j.error } catch { /* */ }
    if (/not found|404/i.test(msg)) msg = 'A função da IA ainda não foi publicada no Supabase (veja o passo a passo).'
    throw new Error(msg)
  }
  if (data?.error) throw new Error(data.error)
  return data?.result
}

/** Biblioteca enviada para a IA (só id, nome, músculo e equipamento). */
export async function libraryForAI() {
  return (await db.exercises.toArray()).filter((e) => !e.deleted_at && e.kind !== 'cardio' && !e.id.startsWith('fx-')).map((e) => ({ id: e.id, name: e.name, muscle: e.primaryMuscle, equipment: e.equipment, compound: e.isCompound }))
}

/** Resumo anonimizado: sem nome, e-mail, fotos ou datas de nascimento. */
export async function anonymousSummary() {
  const p = await getProfile()
  const ws = mine(await db.bodyWeights.orderBy('date').toArray()) as BodyWeight[]
  const tr = emaTrend(ws.map((w) => ({ date: w.date, kg: w.kg })))
  const sessions = (mine(await db.sessions.toArray()) as Session[]).filter((s) => s.status === 'finished')
  const since = localDate(new Date(Date.now() - 28 * 86400000))
  const sets = (mine(await db.sets.toArray()) as SetLog[]).filter((s) => s.type !== 'warmup')
  const ex = new Map((await db.exercises.toArray()).map((e) => [e.id, e.name]))
  const best = new Map<string, { now: number; before: number }>()
  for (const s of sets) {
    const v = e1rm(s.kg ?? 0, s.reps ?? 0) ?? 0
    const k = ex.get(s.exerciseId) ?? s.exerciseId
    const cur = best.get(k) ?? { now: 0, before: 0 }
    if (s.completedAt.slice(0, 10) >= since) cur.now = Math.max(cur.now, v)
    else cur.before = Math.max(cur.before, v)
    best.set(k, cur)
  }
  return {
    goal: p?.goal,
    sex: p?.sex,
    trainingDaysPerWeek: p?.settings.trainingDays,
    weightTrendKg: tr.at(-1)?.trend,
    weightRateKgPerWeek: weeklyRate(tr),
    workoutsLast28Days: sessions.filter((s) => s.startedAt.slice(0, 10) >= since).length,
    totalWorkouts: sessions.length,
    lifts: [...best.entries()].slice(0, 15).map(([name, v]) => ({ name, e1rmLast28d: Math.round(v.now), e1rmBefore: Math.round(v.before) })),
  }
}
