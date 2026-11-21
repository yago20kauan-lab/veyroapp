import { describe, expect, it } from 'vitest'
import { age, bmr, calcTargets, cycleTargets, gramsToPercent, percentToGrams } from '../diet'
import { kcalFromMacros } from '../nutrition'

describe('calculador de metas', () => {
  it('Mifflin-St Jeor', () => {
    expect(bmr('m', 97.5, 180, 30)).toBe(1955)
    expect(bmr('f', 60, 165, 30)).toBe(1320)
  })
  it('definição: −20% do gasto e macros coerentes', () => {
    const r = calcTargets({ sex: 'm', weightKg: 97.5, heightCm: 180, age: 30, activity: 'moderado', goal: 'cut' })
    expect(r.tdee).toBe(3030)
    expect(r.adjustment).toBe(-606)
    expect(r.targets.p).toBe(195)
    expect(r.targets.f).toBe(68)
    expect(r.targets.kcal).toBe(kcalFromMacros(r.targets.p, r.targets.c, r.targets.f))
    expect(Math.abs(r.targets.kcal - 2424)).toBeLessThan(10)
  })
  it('nunca abaixo do piso sem acompanhamento', () => {
    const r = calcTargets({ sex: 'f', weightKg: 50, heightCm: 155, age: 40, activity: 'sedentario', goal: 'cut' })
    expect(r.floored).toBe(true)
    expect(r.targets.kcal).toBeGreaterThanOrEqual(1195)
  })
  it('% ↔ gramas mantém 4/4/9', () => {
    const g = percentToGrams(2300, { p: 33, c: 45, f: 22 })
    expect(g.kcal).toBe(kcalFromMacros(g.p, g.c, g.f))
    const back = gramsToPercent(g)
    expect(back.p + back.c + back.f).toBeGreaterThanOrEqual(99)
  })
  it('idade', () => {
    expect(age('1996-11-20', new Date('2026-11-19T12:00'))).toBe(29)
    expect(age('1996-11-19', new Date('2026-11-19T12:00'))).toBe(30)
  })
})

describe('treino × descanso', () => {
  it('média semanal preservada (5 dias de treino)', () => {
    const avg = { kcal: 2300, p: 190, c: 260, f: 55 }
    const { training, rest } = cycleTargets(avg, 5, 150)
    expect(training.p).toBe(190)
    expect(Math.abs((training.kcal * 5 + rest.kcal * 2) / 7 - kcalFromMacros(190, 260, 55))).toBeLessThan(5)
    expect(training.kcal - rest.kcal).toBeGreaterThan(450)
  })
})
