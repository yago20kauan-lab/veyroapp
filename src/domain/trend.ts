/** Peso corporal: tendência suavizada (EMA α = 0,1), ritmo semanal e previsão. Lógica pura. */
export type WeightPoint = { date: string; kg: number }
export type TrendPoint = { date: string; kg: number; trend: number }

const DAY = 86_400_000

/** t_n = t_{n−1} + α × (peso_n − t_{n−1}). Dias sem registro: a tendência só segue, sem interpolar. */
export function emaTrend(points: WeightPoint[], alpha = 0.1): TrendPoint[] {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date))
  let t: number | undefined
  return sorted.map((p) => {
    t = t == null ? p.kg : t + alpha * (p.kg - t)
    return { ...p, trend: Math.round(t * 100) / 100 }
  })
}

/** Ritmo em kg/semana = inclinação (regressão linear) da tendência nos últimos `windowDays`. null com menos de 14 dias de dados. */
export function weeklyRate(trend: TrendPoint[], windowDays = 14, minSpanDays = 14): number | null {
  if (trend.length < 3) return null
  const first = Date.parse(trend[0].date)
  const lastT = Date.parse(trend[trend.length - 1].date)
  if ((lastT - first) / DAY < minSpanDays) return null
  const recent = trend.filter((p) => (lastT - Date.parse(p.date)) / DAY <= windowDays)
  if (recent.length < 3) return null
  const xs = recent.map((p) => (Date.parse(p.date) - lastT) / DAY)
  const ys = recent.map((p) => p.trend)
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length
  const my = ys.reduce((a, b) => a + b, 0) / ys.length
  const num = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0)
  const den = xs.reduce((a, x) => a + (x - mx) ** 2, 0)
  if (!den) return null
  return Math.round((num / den) * 7 * 100) / 100
}

/** Semanas até a meta no ritmo atual (null se o ritmo não leva à meta). */
export function weeksToGoal(currentTrend: number, goalKg: number, ratePerWeek: number | null): number | null {
  if (ratePerWeek == null || ratePerWeek === 0) return null
  const weeks = (goalKg - currentTrend) / ratePerWeek
  return weeks > 0 ? Math.ceil(weeks) : null
}
