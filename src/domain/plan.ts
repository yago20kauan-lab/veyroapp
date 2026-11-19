/** Plano ativo: semana do plano, fase atual e treino do dia. Lógica pura. */

const DAY = 86_400_000

export type PhaseLike = {
  id: string
  name: string
  type: 'return' | 'normal' | 'deload'
  startDate: string
  weeks: number | null
  rules: { week: number; pct: number; sets: string; rpeMax: number }[]
}
export type RoutineLike = { id: string; name: string; weekday?: number; fromWeek?: number; deleted_at?: string | null }

const dayStart = (iso: string | Date) => {
  const d = typeof iso === 'string' ? new Date(iso + (iso.length === 10 ? 'T00:00:00' : '')) : new Date(iso)
  d.setHours(0, 0, 0, 0)
  return d
}

export const localDate = (d = new Date()) => {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return z.toISOString().slice(0, 10)
}

/** Semana do plano (1 = primeira semana). 0 = ainda não começou. */
export function planWeek(startDate: string, today = new Date()): number {
  const diff = Math.floor((dayStart(today).getTime() - dayStart(startDate).getTime()) / DAY)
  if (diff < 0) return 0
  return Math.floor(diff / 7) + 1
}

/** Fase vigente e semana dentro dela. */
export function currentPhase(phases: PhaseLike[], today = new Date()) {
  const sorted = [...phases].sort((a, b) => a.startDate.localeCompare(b.startDate))
  let found: { phase: PhaseLike; week: number } | null = null
  for (const ph of sorted) {
    const w = planWeek(ph.startDate, today)
    if (w < 1) continue
    if (ph.weeks == null || w <= ph.weeks) found = { phase: ph, week: w }
  }
  if (!found) return null
  const rule = found.phase.rules.find((r) => r.week === found!.week)
  return { ...found, rule }
}

/** Datas de início das fases em sequência a partir do início do plano. */
export function sequencePhases<T extends { weeks: number | null }>(phases: T[], startDate: string): (T & { startDate: string })[] {
  let cursor = dayStart(startDate)
  return phases.map((p) => {
    const out = { ...p, startDate: localDate(cursor) }
    if (p.weeks != null) cursor = new Date(cursor.getTime() + p.weeks * 7 * DAY)
    return out
  })
}

/** Treino do dia: rotina do dia da semana com o maior fromWeek ≤ semana do plano. */
export function routineForDay<T extends RoutineLike>(routines: T[], weekday: number, week: number): T | null {
  const candidates = routines.filter((r) => !r.deleted_at && r.weekday === weekday && (r.fromWeek ?? 1) <= Math.max(1, week))
  if (!candidates.length) return null
  return candidates.sort((a, b) => (b.fromWeek ?? 1) - (a.fromWeek ?? 1))[0]
}

/** Próxima segunda-feira (ou hoje, se hoje for segunda). */
export function nextMonday(today = new Date()) {
  const d = dayStart(today)
  const add = (8 - d.getDay()) % 7
  return localDate(new Date(d.getTime() + add * DAY))
}
