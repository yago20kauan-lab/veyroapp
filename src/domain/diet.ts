/** Calculador de metas (A7 item 8.1) e ciclo treino × descanso (8.2). Lógica pura. */
import type { Macros } from '../db/schema'
import { kcalFromMacros } from './nutrition'

export type Sex = 'm' | 'f'
export type Goal = 'cut' | 'maintain' | 'bulk'
export const ACTIVITY = {
  sedentario: { f: 1.2, label: 'Sedentário (trabalho sentado, pouco treino)' },
  leve: { f: 1.375, label: 'Leve (1–3 treinos/semana)' },
  moderado: { f: 1.55, label: 'Moderado (3–5 treinos/semana)' },
  alto: { f: 1.725, label: 'Alto (6–7 treinos/semana ou trabalho em pé)' },
} as const
export type Activity = keyof typeof ACTIVITY

export const KCAL_FLOOR: Record<Sex, number> = { m: 1600, f: 1300 }

export function age(birthDate: string, today = new Date()) {
  const b = new Date(birthDate + 'T12:00')
  let a = today.getFullYear() - b.getFullYear()
  if (today.getMonth() < b.getMonth() || (today.getMonth() === b.getMonth() && today.getDate() < b.getDate())) a--
  return a
}

/** Mifflin-St Jeor */
export function bmr(sex: Sex, weightKg: number, heightCm: number, ageY: number) {
  return Math.round(10 * weightKg + 6.25 * heightCm - 5 * ageY + (sex === 'm' ? 5 : -161))
}

export type CalcInput = { sex: Sex; weightKg: number; heightCm: number; age: number; activity: Activity; goal: Goal; proteinPerKg?: number; fatPerKg?: number; deficitKcal?: number }

export function calcTargets(i: CalcInput) {
  const b = bmr(i.sex, i.weightKg, i.heightCm, i.age)
  const tdee = Math.round(b * ACTIVITY[i.activity].f)
  // perder ~0,75% do peso por semana (7700 kcal/kg), limitado a 300–750 kcal/dia
  const autoDeficit = Math.round(Math.max(300, Math.min(750, (0.0075 * i.weightKg * 7700) / 7)) / 10) * 10
  const adj = i.goal === 'cut' ? -(i.deficitKcal ?? autoDeficit) : i.goal === 'bulk' ? 300 : 0
  let kcal = Math.max(KCAL_FLOOR[i.sex], tdee + adj)
  const p = Math.round((i.proteinPerKg ?? 2.0) * i.weightKg)
  const f = Math.round((i.fatPerKg ?? 0.7) * i.weightKg)
  const c = Math.max(50, Math.round((kcal - p * 4 - f * 9) / 4))
  kcal = kcalFromMacros(p, c, f)
  return { bmr: b, tdee, adjustment: adj, targets: { kcal, p, c, f } as Macros, floored: tdee + adj < KCAL_FLOOR[i.sex] }
}

/** Metas em % → gramas (as kcal ficam fixas, os gramas derivam). */
export function percentToGrams(kcal: number, pct: { p: number; c: number; f: number }): Macros {
  const p = Math.round((kcal * pct.p) / 100 / 4)
  const c = Math.round((kcal * pct.c) / 100 / 4)
  const f = Math.round((kcal * pct.f) / 100 / 9)
  return { kcal: kcalFromMacros(p, c, f), p, c, f }
}

export function gramsToPercent(m: Macros) {
  const k = kcalFromMacros(m.p, m.c, m.f) || 1
  return { p: Math.round((m.p * 400) / k), c: Math.round((m.c * 400) / k), f: Math.round((m.f * 900) / k) }
}

/** Ciclo de carboidrato: mantém a média semanal; a diferença vai toda no carboidrato. */
export function cycleTargets(avg: Macros, trainingDays: number, extraKcal = 150) {
  const n = Math.max(1, Math.min(6, trainingDays))
  const restDelta = -(extraKcal * n) / (7 - n)
  const mk = (delta: number): Macros => {
    const c = Math.max(50, Math.round(avg.c + delta / 4))
    return { kcal: kcalFromMacros(avg.p, c, avg.f), p: avg.p, c, f: avg.f }
  }
  return { training: mk(extraKcal), rest: mk(restDelta) }
}
