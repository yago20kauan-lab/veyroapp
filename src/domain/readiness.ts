/** Recuperação (A7 item 13): prontidão 0–100, fadiga por músculo e sugestão de deload. Lógica pura. */
import type { Muscle } from '../db/schema'

export type ReadinessInput = {
  sleep: number // 1–5
  soreness: number // 1–5 (5 = muito dolorido)
  energy: number // 1–5
  sleepHours?: number
  restingHr?: number
  restingHrBaseline?: number
  hrv?: number
  hrvBaseline?: number
  /** volume dos últimos 3 dias ÷ média de 3 dias nas últimas 4 semanas */
  loadRatio?: number
}

const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x))

export function readinessScore(i: ReadinessInput) {
  const parts: { w: number; v: number; key: string }[] = []
  const check = ((i.sleep + (6 - i.soreness) + i.energy) / 3 - 1) / 4
  parts.push({ key: 'checkin', w: 0.4, v: clamp(check) * 100 })
  if (i.sleepHours != null) parts.push({ key: 'sono', w: 0.3, v: clamp((i.sleepHours - 5) / 3) * 100 })
  if (i.loadRatio != null) parts.push({ key: 'carga', w: 0.3, v: (1 - clamp(i.loadRatio - 1)) * 100 })
  const wsum = parts.reduce((a, p) => a + p.w, 0)
  let score = parts.reduce((a, p) => a + (p.w / wsum) * p.v, 0)
  const notes: string[] = []
  if (i.restingHr != null && i.restingHrBaseline != null && i.restingHr > i.restingHrBaseline + 5) {
    score -= 10
    notes.push('Frequência de repouso acima do normal')
  }
  if (i.hrv != null && i.hrvBaseline != null && i.hrv < i.hrvBaseline * 0.85) {
    score -= 10
    notes.push('Variabilidade cardíaca abaixo do normal')
  }
  return { score: Math.round(clamp(score, 0, 100)), parts: parts.map((p) => ({ ...p, w: p.w / wsum, v: Math.round(p.v) })), notes }
}

export function readinessAdvice(score: number) {
  if (score >= 75) return { level: 'alta' as const, title: 'Pronto para treinar pesado', text: 'Cargas como calculadas.' }
  if (score >= 50) return { level: 'media' as const, title: 'Treino normal, sem exagero', text: 'PSE máximo 8 e sem subir carga hoje.' }
  return { level: 'baixa' as const, title: 'Hoje, treino leve', text: '−10% nas cargas e 1 série a menos por exercício.' }
}

/** Fadiga por músculo: séries efetivas com decaimento de meia-vida 48 h. 0–1 (1 ≈ 6+ séries "frescas"). */
export function muscleFatigue(
  sets: { exerciseId: string; completedAt: string; type?: string }[],
  exercises: Map<string, { primaryMuscle: Muscle; secondaryMuscles: Muscle[] }>,
  now = Date.now(),
  halfLifeH = 48,
) {
  const acc = new Map<Muscle, number>()
  const k = Math.LN2 / halfLifeH
  for (const s of sets) {
    if (s.type === 'warmup') continue
    const ex = exercises.get(s.exerciseId)
    if (!ex) continue
    const h = (now - Date.parse(s.completedAt)) / 3_600_000
    if (h < 0 || h > 24 * 7) continue
    const f = Math.exp(-k * h)
    acc.set(ex.primaryMuscle, (acc.get(ex.primaryMuscle) ?? 0) + f)
    for (const m of ex.secondaryMuscles) acc.set(m, (acc.get(m) ?? 0) + 0.5 * f)
  }
  const out = new Map<Muscle, number>()
  for (const [m, v] of acc) out.set(m, Math.round(clamp(v / 6) * 100) / 100)
  return out
}

/** Deload: a cada 6–8 semanas de progressão, ou prontidão < 50 em 3 dias de uma semana. */
export function shouldDeload(weeksSinceDeload: number, lowDaysThisWeek: number) {
  if (lowDaysThisWeek >= 3) return { yes: true, reason: 'Prontidão baixa em 3 dias desta semana' }
  if (weeksSinceDeload >= 7) return { yes: true, reason: `${weeksSinceDeload} semanas seguidas de progressão` }
  return { yes: false, reason: '' }
}
