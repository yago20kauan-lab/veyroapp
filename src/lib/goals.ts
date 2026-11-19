import { db, type DayNote, type FoodLog, type Goal, type Measurement, type Phase, type PersonalRecord, type Session, type SetLog } from '../db/schema'
import { mine, save } from '../db/repo'
import { e1rm } from '../domain/records'
import { evaluateGoal, type GoalPoint } from '../domain/goals'
import { ACHIEVEMENTS, unlockedCodes, weeklyStreak } from '../domain/achievements'
import { localDate } from '../domain/plan'
import { navyBodyFat } from '../domain/bodycomp'
import { getProfile } from './plan'
import { weightTrend } from './progress'

export const GOAL_TYPES: Record<Goal['type'], { label: string; unit: string }> = {
  weight: { label: 'Peso corporal', unit: 'kg' },
  waist: { label: 'Cintura', unit: 'cm' },
  bodyfat: { label: '% de gordura', unit: '%' },
  lift: { label: 'Carga em exercício (1RM est.)', unit: 'kg' },
  frequency: { label: 'Treinos por semana', unit: 'x/sem' },
  steps: { label: 'Passos por dia', unit: 'passos' },
  protein: { label: 'Proteína por dia', unit: 'g' },
}

export async function sessionE1rmSeries(exerciseId: string) {
  const sets = (mine(await db.sets.where('exerciseId').equals(exerciseId).toArray()) as SetLog[]).filter((s) => s.type !== 'warmup')
  const by = new Map<string, { date: string; e1rm: number; best: number; volume: number }>()
  for (const s of sets) {
    const cur = by.get(s.sessionId) ?? { date: s.completedAt.slice(0, 10), e1rm: 0, best: 0, volume: 0 }
    const v = e1rm(s.kg ?? 0, s.reps ?? 0) ?? 0
    by.set(s.sessionId, { date: cur.date, e1rm: Math.max(cur.e1rm, v), best: Math.max(cur.best, s.kg ?? 0), volume: cur.volume + (s.kg ?? 0) * (s.reps ?? 0) })
  }
  return [...by.values()].sort((a, b) => a.date.localeCompare(b.date))
}

/** Valor atual e série de pontos de cada tipo de meta. */
export async function goalSeries(g: Goal): Promise<{ current: number | null; points: GoalPoint[] }> {
  const avgLast7 = (vals: { date: string; v: number }[]) => {
    const from = localDate(new Date(Date.now() - 6 * 86400000))
    const byDay = new Map<string, number>()
    for (const x of vals) if (x.date >= from) byDay.set(x.date, (byDay.get(x.date) ?? 0) + x.v)
    return byDay.size ? [...byDay.values()].reduce((a, b) => a + b, 0) / byDay.size : null
  }
  switch (g.type) {
    case 'weight': {
      const t = await weightTrend()
      return { current: t.at(-1)?.trend ?? null, points: t.map((p) => ({ date: p.date, value: p.trend })) }
    }
    case 'waist': {
      const ms = (mine(await db.measurements.orderBy('date').toArray()) as Measurement[]).filter((m) => m.waistCm)
      return { current: ms.at(-1)?.waistCm ?? null, points: ms.map((m) => ({ date: m.date, value: m.waistCm! })) }
    }
    case 'bodyfat': {
      const p = await getProfile()
      const ms = mine(await db.measurements.orderBy('date').toArray()) as Measurement[]
      let neck: number | undefined
      let hip: number | undefined
      const pts: GoalPoint[] = []
      for (const m of ms) {
        neck = m.neckCm ?? neck
        hip = m.hipCm ?? hip
        if (m.waistCm && neck && p?.sex && p.heightCm) {
          const v = navyBodyFat(p.sex, p.heightCm, m.waistCm, neck, hip)
          if (v != null) pts.push({ date: m.date, value: v })
        }
      }
      return { current: pts.at(-1)?.value ?? null, points: pts }
    }
    case 'lift': {
      const s = g.exerciseId ? await sessionE1rmSeries(g.exerciseId) : []
      return { current: s.length ? Math.max(...s.map((x) => x.e1rm)) : null, points: s.map((x) => ({ date: x.date, value: x.e1rm })) }
    }
    case 'frequency': {
      const from = localDate(new Date(Date.now() - 28 * 86400000))
      const n = (mine(await db.sessions.toArray()) as Session[]).filter((s) => s.status === 'finished' && s.startedAt.slice(0, 10) >= from).length
      return { current: Math.round((n / 4) * 10) / 10, points: [] }
    }
    case 'steps': {
      const notes = mine(await db.dayNotes.toArray()) as DayNote[]
      return { current: avgLast7(notes.filter((n) => n.steps).map((n) => ({ date: n.date, v: n.steps! }))), points: [] }
    }
    case 'protein': {
      const logs = mine(await db.foodLogs.toArray()) as FoodLog[]
      return { current: avgLast7(logs.map((l) => ({ date: l.date, v: l.macros.p }))), points: [] }
    }
  }
}

export async function evaluate(g: Goal) {
  const s = await goalSeries(g)
  return { ...s, ev: evaluateGoal(g.start, g.target, s.current, s.points, g.deadline) }
}

/** Recalcula medalhas e grava as novas. Devolve as recém-desbloqueadas. */
export async function checkAchievements() {
  const sessions = (mine(await db.sessions.toArray()) as Session[]).filter((s) => s.status === 'finished')
  const sets = await db.sets.count()
  const prs = (mine(await db.records.toArray()) as PersonalRecord[]).filter((r) => r.type === 'max_kg').length
  const p = await getProfile()
  const planned = Number(p?.settings.trainingDays ?? 5)
  const { perfectWeeks } = weeklyStreak(sessions.map((s) => s.startedAt), planned)
  const tr = await weightTrend()
  const ws = await db.bodyWeights.count()
  const waist = (mine(await db.measurements.orderBy('date').toArray()) as Measurement[]).filter((m) => m.waistCm)
  const phases = mine(await db.phases.toArray()) as Phase[]
  const ret = phases.find((x) => x.type === 'return')
  const returnDone = !!ret && Date.now() > Date.parse(ret.startDate + 'T00:00') + 28 * 86400000 && sessions.length >= 12
  const codes = unlockedCodes({
    setsCount: sets,
    workouts: sessions.length,
    prs,
    perfectWeeks,
    trendDrop: tr.length ? tr[0].trend - tr.at(-1)!.trend : 0,
    waistDrop: waist.length ? waist[0].waistCm! - waist.at(-1)!.waistCm! : 0,
    weighIns: ws,
    returnDone,
  })
  // medalhas ficam no perfil (sincroniza junto)
  const have = (p?.settings.achievements ?? {}) as Record<string, string>
  const fresh = codes.filter((c) => !have[c])
  if (fresh.length && p) {
    const now = new Date().toISOString()
    await save('profiles', { ...p, settings: { ...p.settings, achievements: { ...have, ...Object.fromEntries(fresh.map((c) => [c, now])) } } })
  }
  return fresh.map((c) => ACHIEVEMENTS.find((a) => a.code === c)!)
}
