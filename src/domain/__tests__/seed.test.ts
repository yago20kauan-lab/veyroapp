import { describe, expect, it } from 'vitest'
import { seedExercises } from '../../db/seed-exercises'
import { seedFoods, templateDefinicao2300 } from '../../db/seed-nutrition'
import { seedPrograms } from '../../db/seed-programs'
import { kcalFromMacros, round, sumItems } from '../nutrition'

const exIds = new Set(seedExercises.map((e) => e.id))
const foods = new Map(seedFoods.map((f) => [f.id, f]))

describe('seed', () => {
  it('ids de exercícios são únicos', () => {
    expect(exIds.size).toBe(seedExercises.length)
  })
  it('todo exercício dos programas existe na biblioteca', () => {
    for (const p of seedPrograms) for (const r of p.routines) for (const i of r.items) expect(exIds.has(i.exerciseId), `${p.id}: ${i.exerciseId}`).toBe(true)
  })
  it('todo alimento do modelo de dieta existe', () => {
    for (const m of templateDefinicao2300.meals) for (const i of m.items) expect(foods.has(i.foodId!), i.foodId).toBe(true)
  })
  it('modelo de dieta fecha perto das metas (±8%)', () => {
    const total = round(templateDefinicao2300.meals.reduce((acc, m) => {
      const s = sumItems(m.items, foods)
      return { kcal: acc.kcal + s.kcal, p: acc.p + s.p, c: acc.c + s.c, f: acc.f + s.f }
    }, { kcal: 0, p: 0, c: 0, f: 0 }))
    const t = templateDefinicao2300.targets
    expect(Math.abs(total.kcal - t.kcal) / t.kcal).toBeLessThan(0.08)
    expect(Math.abs(total.p - t.p) / t.p).toBeLessThan(0.08)
  })
  it('kcal derivadas dos macros', () => {
    expect(kcalFromMacros(190, 245, 55)).toBe(2235)
  })
})
