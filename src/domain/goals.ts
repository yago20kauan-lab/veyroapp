/** Metas: progresso, previsão e status. Lógica pura. */
export type GoalPoint = { date: string; value: number }

const DAY = 86_400_000

/** Inclinação por dia (regressão linear) dos últimos `windowDays`. */
export function slopePerDay(points: GoalPoint[], windowDays = 28): number | null {
  if (points.length < 2) return null
  const last = Date.parse(points.at(-1)!.date)
  const pts = points.filter((p) => (last - Date.parse(p.date)) / DAY <= windowDays)
  if (pts.length < 2) return null
  const xs = pts.map((p) => (Date.parse(p.date) - last) / DAY)
  const ys = pts.map((p) => p.value)
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length
  const my = ys.reduce((a, b) => a + b, 0) / ys.length
  const den = xs.reduce((a, x) => a + (x - mx) ** 2, 0)
  if (!den) return null
  return xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / den
}

export type GoalEval = { progress: number; reached: boolean; etaDate: string | null; status: 'no-ritmo' | 'adiantada' | 'atrasada' | 'sem-dados' | 'concluida' }

/** Funciona para metas de subir (carga) e de descer (peso, cintura) pelo sinal de target − start. */
export function evaluateGoal(start: number, target: number, current: number | null, points: GoalPoint[], deadline?: string, today = new Date(), minSpanDays = 14): GoalEval {
  if (current == null) return { progress: 0, reached: false, etaDate: null, status: 'sem-dados' }
  const dir = Math.sign(target - start) || 1
  const total = Math.abs(target - start) || 1
  const done = (current - start) * dir
  const progress = Math.max(0, Math.min(1, done / total))
  const reached = (current - target) * dir >= 0
  if (reached) return { progress: 1, reached, etaDate: null, status: 'concluida' }
  const span = points.length ? (Date.parse(points.at(-1)!.date) - Date.parse(points[0].date)) / DAY : 0
  const slope = span >= minSpanDays ? slopePerDay(points) : null
  if (slope == null || slope * dir <= 0) return { progress, reached, etaDate: null, status: 'sem-dados' }
  const days = Math.ceil(Math.abs(target - current) / Math.abs(slope))
  const eta = new Date(today.getTime() + days * DAY).toISOString().slice(0, 10)
  if (!deadline) return { progress, reached, etaDate: eta, status: 'no-ritmo' }
  const diff = (Date.parse(deadline) - Date.parse(eta)) / DAY
  return { progress, reached, etaDate: eta, status: diff >= 14 ? 'adiantada' : diff >= -7 ? 'no-ritmo' : 'atrasada' }
}
