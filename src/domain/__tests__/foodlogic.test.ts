import { describe, expect, it } from 'vitest'
import { adaptiveTdee, autoAdjustCarbs, buildShoppingList, equivalentGrams, rescaleToKcal, targetForRate } from '../foodlogic'
import taco from '../../db/taco.json'
import type { Food } from '../../db/schema'

const foods = new Map((taco as unknown as Food[]).map((f) => [f.id, f]))
const byName = (n: string) => [...foods.values()].find((f) => f.name === n)!

describe('trocas', () => {
  it('150 g de arroz cozido ≈ batata-doce pelo carboidrato', () => {
    const arroz = byName('Arroz, tipo 1, cozido')
    const batata = byName('Batata, doce, cozida')
    const g = equivalentGrams(arroz, 150, batata)
    expect(g).toBeGreaterThanOrEqual(220)
    expect(g).toBeLessThanOrEqual(240)
  })
  it('frango ↔ tilápia pela proteína', () => {
    const frango = byName('Frango, peito, sem pele, grelhado')
    expect(equivalentGrams(frango, 150, frango)).toBe(150)
  })
})

describe('busca TACO', () => {
  it('tem os 597 alimentos com macros', () => {
    expect(foods.size).toBe(597)
    expect(byName('Feijão, carioca, cozido').per100g.p).toBeCloseTo(4.8, 1)
  })
})

describe('lista de compras', () => {
  it('converte arroz cozido em cru e soma 7 dias', () => {
    const arroz = byName('Arroz, tipo 1, cozido')
    const day = [{ name: 'Almoço', time: '13:00', items: [{ foodId: arroz.id, grams: 200 }] }]
    const list = buildShoppingList(Array(7).fill(day), foods)
    expect(list).toHaveLength(1)
    expect(list[0].name).toMatch(/cru/i)
    // 1400 g cozido / 2,8 ≈ 500 g cru
    expect(list[0].grams).toBeGreaterThanOrEqual(450)
    expect(list[0].grams).toBeLessThanOrEqual(600)
  })
  it('desconta o que já tem em casa', () => {
    const banana = byName('Banana, prata, crua')
    const day = [{ name: 'x', time: '', items: [{ foodId: banana.id, grams: 100 }] }]
    expect(buildShoppingList(Array(7).fill(day), foods, { [banana.id]: 700 })).toHaveLength(0)
  })
})

describe('ajuste automático', () => {
  it('fecha a meta de carboidrato mexendo só nos carboidratos', () => {
    const arroz = byName('Arroz, tipo 1, cozido')
    const frango = byName('Frango, peito, sem pele, grelhado')
    const meals = [{ name: 'A', time: '', items: [{ foodId: arroz.id, grams: 100 }, { foodId: frango.id, grams: 150 }] }]
    const out = autoAdjustCarbs(meals, foods, 56)
    expect(out[0].items[0].grams).toBe(200)
    expect(out[0].items[1].grams).toBe(150)
  })
})

describe('calorias adaptativas', () => {
  const mk = (n: number, intake: number, startKg: number, perDay: number, logEvery = 1) =>
    Array.from({ length: n }, (_, i) => ({
      date: new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10),
      intakeKcal: i % logEvery === 0 ? intake : undefined,
      weightKg: startKg + perDay * i,
    }))
  it('precisa de 14 dias e 80% registrados', () => {
    expect(adaptiveTdee(mk(10, 2300, 97, -0.1)).ok).toBe(false)
    expect(adaptiveTdee(mk(21, 2300, 97, -0.1, 3)).ok).toBe(false)
  })
  it('perdendo ~0,7 kg/semana comendo 2.300 → gasto ~3.000', () => {
    const r = adaptiveTdee(mk(28, 2300, 97, -0.1))
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.tdee).toBeGreaterThan(2800)
      expect(r.tdee).toBeLessThan(3200)
    }
  })
  it('limita a variação a ±150 kcal por semana', () => {
    const r = adaptiveTdee(mk(28, 2300, 97, -0.1), 2500)
    expect(r.ok && r.tdee).toBe(2650)
  })
  it('meta para o ritmo e reescala de macros', () => {
    expect(targetForRate(3000, -0.6)).toBe(2340)
    const m = rescaleToKcal({ kcal: 2295, p: 190, c: 260, f: 55 }, 2100)
    expect(m.p).toBe(190)
    expect(m.c).toBeLessThan(260)
  })
})
