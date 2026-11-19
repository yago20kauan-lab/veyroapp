import type { Food, Macros, MealItem } from '../db/schema'

export const ZERO: Macros = { kcal: 0, p: 0, c: 0, f: 0 }

export function add(a: Macros, b: Macros): Macros {
  return { kcal: a.kcal + b.kcal, p: a.p + b.p, c: a.c + b.c, f: a.f + b.f }
}

/** Macros de uma quantidade em gramas de um alimento (valores por 100 g). */
export function macrosFor(food: Pick<Food, 'per100g'>, grams: number): Macros {
  const k = grams / 100
  const m = food.per100g
  return { kcal: m.kcal * k, p: m.p * k, c: m.c * k, f: m.f * k }
}

export function sumItems(items: MealItem[], foods: Map<string, Pick<Food, 'per100g'>>): Macros {
  return items.reduce((acc, it) => {
    const f = it.foodId ? foods.get(it.foodId) : undefined
    return f ? add(acc, macrosFor(f, it.grams)) : acc
  }, ZERO)
}

/** Calorias sempre derivadas dos macros (4/4/9), para nunca ficarem incoerentes. */
export function kcalFromMacros(p: number, c: number, f: number) {
  return Math.round(p * 4 + c * 4 + f * 9)
}

export function round(m: Macros): Macros {
  return { kcal: Math.round(m.kcal), p: Math.round(m.p), c: Math.round(m.c), f: Math.round(m.f) }
}
