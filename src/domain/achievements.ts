/** Medalhas e sequência semanal. Lógica pura. */
export type AchievementDef = { code: string; title: string; text: string }

export const ACHIEVEMENTS: AchievementDef[] = [
  { code: 'first-set', title: 'Primeira série', text: 'Registrou a primeira série no VEYRO' },
  { code: 'w10', title: '10 treinos', text: '10 treinos concluídos' },
  { code: 'w50', title: '50 treinos', text: '50 treinos concluídos' },
  { code: 'w100', title: '100 treinos', text: '100 treinos concluídos' },
  { code: 'pr1', title: 'Primeiro recorde', text: 'Bateu o primeiro recorde' },
  { code: 'pr10', title: '10 recordes', text: '10 recordes batidos' },
  { code: 'perfect-week', title: 'Semana perfeita', text: 'Todos os treinos planejados da semana' },
  { code: 'kg-2', title: '−2 kg', text: 'Tendência 2 kg abaixo do início' },
  { code: 'kg-5', title: '−5 kg', text: 'Tendência 5 kg abaixo do início' },
  { code: 'kg-10', title: '−10 kg', text: 'Tendência 10 kg abaixo do início' },
  { code: 'waist-3', title: '−3 cm de cintura', text: 'Cintura 3 cm menor que a primeira medida' },
  { code: 'weigh-30', title: '30 pesagens', text: 'Registrou o peso 30 vezes' },
  { code: 'return-done', title: 'Retorno concluído', text: 'Completou as 4 semanas de retorno' },
]

export type AchInput = {
  setsCount: number
  workouts: number
  prs: number
  perfectWeeks: number
  trendDrop: number // kg (positivo = perdeu)
  waistDrop: number // cm
  weighIns: number
  returnDone: boolean
}

export function unlockedCodes(i: AchInput): string[] {
  const out: string[] = []
  if (i.setsCount > 0) out.push('first-set')
  if (i.workouts >= 10) out.push('w10')
  if (i.workouts >= 50) out.push('w50')
  if (i.workouts >= 100) out.push('w100')
  if (i.prs >= 1) out.push('pr1')
  if (i.prs >= 10) out.push('pr10')
  if (i.perfectWeeks >= 1) out.push('perfect-week')
  if (i.trendDrop >= 2) out.push('kg-2')
  if (i.trendDrop >= 5) out.push('kg-5')
  if (i.trendDrop >= 10) out.push('kg-10')
  if (i.waistDrop >= 3) out.push('waist-3')
  if (i.weighIns >= 30) out.push('weigh-30')
  if (i.returnDone) out.push('return-done')
  return out
}

/** Segunda-feira da semana (YYYY-MM-DD). */
export function mondayOf(dateIso: string) {
  const d = new Date(dateIso.slice(0, 10) + 'T12:00')
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d.toISOString().slice(0, 10)
}

/**
 * Sequência em semanas com ≥ 80% dos treinos planejados. Descanso não quebra.
 * A semana atual só conta se já bateu a meta (não quebra enquanto está em andamento).
 */
export function weeklyStreak(sessionDates: string[], plannedPerWeek: number, today = new Date()) {
  const need = Math.max(1, Math.ceil(plannedPerWeek * 0.8))
  const count = new Map<string, number>()
  for (const d of sessionDates) count.set(mondayOf(d), (count.get(mondayOf(d)) ?? 0) + 1)
  const cur = mondayOf(today.toISOString())
  let streak = (count.get(cur) ?? 0) >= need ? 1 : 0
  const w = new Date(cur + 'T12:00')
  for (;;) {
    w.setDate(w.getDate() - 7)
    const k = w.toISOString().slice(0, 10)
    if ((count.get(k) ?? 0) >= need) streak++
    else break
  }
  const perfect = [...count.values()].filter((n) => n >= plannedPerWeek).length
  return { streak, thisWeek: count.get(cur) ?? 0, need, perfectWeeks: perfect }
}

/** Platô: 1RM estimado não sobe há `n` sessões. */
export function isPlateau(e1rmBySession: number[], n = 4) {
  if (e1rmBySession.length < n + 1) return false
  const best = Math.max(...e1rmBySession.slice(0, -n))
  return Math.max(...e1rmBySession.slice(-n)) <= best + 0.01
}
