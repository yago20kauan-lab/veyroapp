/** Trocas, ajuste automático do plano, lista de compras e calorias adaptativas. Lógica pura. */
import type { Food, Macros, PlanMeal } from '../db/schema'
import { kcalFromMacros, macrosFor } from './nutrition'

type F = Pick<Food, 'id' | 'name' | 'per100g' | 'swapGroup' | 'state' | 'yieldFactor' | 'section'> & { rawId?: string }

const round5 = (g: number) => Math.max(5, Math.round(g / 5) * 5)

/** Macro que define a troca de cada grupo. */
export function swapBasis(group?: Food['swapGroup']): keyof Macros {
  switch (group) {
    case 'protein':
    case 'dairy':
      return 'p'
    case 'fat':
      return 'f'
    case 'veg':
      return 'kcal'
    default:
      return 'c'
  }
}

/** Quantos gramas de `to` equivalem a `grams` de `from` (pelo macro principal do grupo). */
export function equivalentGrams(from: F, grams: number, to: F): number {
  const k = swapBasis(from.swapGroup)
  const a = from.per100g[k] ?? 0
  const b = to.per100g[k] ?? 0
  if (!a || !b) return grams
  return round5((grams * a) / b)
}

/** Ajusta os gramas dos carboidratos do plano para fechar a meta de carboidrato. */
export function autoAdjustCarbs(meals: PlanMeal[], foods: Map<string, F>, targetC: number): PlanMeal[] {
  let carbFromCarbItems = 0
  let carbOthers = 0
  for (const m of meals)
    for (const it of m.items) {
      const f = it.foodId ? foods.get(it.foodId) : undefined
      if (!f) continue
      const c = macrosFor(f, it.grams).c
      if (f.swapGroup === 'carb' || f.swapGroup === 'bread') carbFromCarbItems += c
      else carbOthers += c
    }
  if (carbFromCarbItems <= 0) return meals
  const factor = Math.max(0.2, Math.min(3, (targetC - carbOthers) / carbFromCarbItems))
  return meals.map((m) => ({
    ...m,
    items: m.items.map((it) => {
      const f = it.foodId ? foods.get(it.foodId) : undefined
      return f && (f.swapGroup === 'carb' || f.swapGroup === 'bread') ? { ...it, grams: round5(it.grams * factor) } : it
    }),
  }))
}

export type ShoppingItem = { foodId: string; name: string; grams: number; section: string; note?: string; units?: number }

/** Lista de compras: soma os dias, converte cozido → cru e agrupa por seção. */
export function buildShoppingList(days: PlanMeal[][], foods: Map<string, F>, haveAtHome: Record<string, number> = {}): ShoppingItem[] {
  const acc = new Map<string, ShoppingItem>()
  for (const meals of days)
    for (const m of meals)
      for (const it of m.items) {
        const f = it.foodId ? foods.get(it.foodId) : undefined
        if (!f) continue
        let id = f.id
        let name = f.name
        let grams = it.grams
        let note: string | undefined
        if (f.state === 'cooked' && f.yieldFactor && f.yieldFactor !== 1) {
          grams = grams / f.yieldFactor
          const raw = f.rawId ? foods.get(f.rawId) : undefined
          if (raw) {
            id = raw.id
            name = raw.name
          } else {
            id = `${f.id}:cru`
            name = `${f.name.replace(/,?\s*(cozid[oa]|grelhad[oa]|assad[oa])/i, '')} (cru)`
          }
          note = 'peso cru'
        }
        const cur = acc.get(id)
        acc.set(id, { foodId: id, name, grams: (cur?.grams ?? 0) + grams, section: f.section, note })
      }
  return [...acc.values()]
    .map((x) => {
      const g = Math.max(0, x.grams - (haveAtHome[x.foodId] ?? 0))
      const rounded = g > 200 ? Math.ceil(g / 50) * 50 : Math.ceil(g / 10) * 10
      const isEgg = /ovo/i.test(x.name) && !/clara/i.test(x.name)
      return { ...x, grams: rounded, units: isEgg ? Math.ceil(g / 50) : undefined }
    })
    .filter((x) => x.grams > 0)
    .sort((a, b) => a.section.localeCompare(b.section) || a.name.localeCompare(b.name))
}

export type DayLog = { date: string; intakeKcal?: number; weightKg?: number }

/**
 * Calorias adaptativas (A7 8.7):
 *  gasto ≈ média ingerida − (variação da tendência × 7700 / dias)
 *  Exige 14+ dias e 80% dos dias com comida registrada. Suaviza (α 0,3) e limita ±150 kcal/semana.
 */
export function adaptiveTdee(days: DayLog[], previous?: number) {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date))
  if (sorted.length < 2) return { ok: false as const, missingDays: 14 }
  const span = (Date.parse(sorted.at(-1)!.date) - Date.parse(sorted[0].date)) / 86400000 + 1
  const logged = sorted.filter((d) => d.intakeKcal != null && d.intakeKcal > 0)
  const weights = sorted.filter((d) => d.weightKg != null).map((d) => ({ date: d.date, kg: d.weightKg! }))
  const needDays = Math.max(0, 14 - span)
  const needLogged = Math.max(0, Math.ceil(0.8 * Math.max(span, 14)) - logged.length)
  if (needDays > 0 || needLogged > 0 || weights.length < 4) {
    return { ok: false as const, missingDays: Math.max(needDays, needLogged, 4 - weights.length) }
  }
  // inclinação por regressão linear dos pesos (a EMA atrasa e subestimaria a perda)
  const t0 = Date.parse(weights[0].date)
  const xs = weights.map((w) => (Date.parse(w.date) - t0) / 86400000)
  const ys = weights.map((w) => w.kg)
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length
  const my = ys.reduce((a, b) => a + b, 0) / ys.length
  const slope = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / (xs.reduce((a, x) => a + (x - mx) ** 2, 0) || 1)
  const elapsed = xs.at(-1)! - xs[0] || 1
  const delta = slope * elapsed
  const avgIntake = logged.reduce((a, d) => a + d.intakeKcal!, 0) / logged.length
  let tdee = avgIntake - (delta * 7700) / elapsed
  if (previous) {
    tdee = previous + 0.3 * (tdee - previous)
    tdee = Math.max(previous - 150, Math.min(previous + 150, tdee))
  }
  return { ok: true as const, tdee: Math.round(tdee), avgIntake: Math.round(avgIntake), trendDeltaKg: Math.round(delta * 100) / 100, days: Math.round(elapsed) }
}

/** Nova meta para um ritmo desejado (kg/semana, negativo = perder). */
export function targetForRate(tdee: number, rateKgPerWeek: number) {
  return Math.round(tdee + (rateKgPerWeek * 7700) / 7)
}

/** Reescala macros mantendo proteína e gordura e ajustando carboidrato para uma nova meta de kcal. */
export function rescaleToKcal(m: Macros, kcal: number): Macros {
  const c = Math.max(50, Math.round((kcal - m.p * 4 - m.f * 9) / 4))
  return { kcal: kcalFromMacros(m.p, c, m.f), p: m.p, c, f: m.f }
}
