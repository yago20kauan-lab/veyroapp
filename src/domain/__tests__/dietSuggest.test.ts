import { describe, expect, it } from 'vitest'
import data from '../../db/dietTemplates.json'
import taco from '../../db/taco.json'
import { seedFoods } from '../../db/seed-nutrition'
import { DIET_FOOD_MAP } from '../../db/dietFoodMap'
import type { Food } from '../../db/schema'
import { defaultStyle, findBand, fitTemplate, recommendedBand, suggestTarget, templateMacros, templateToItems, type DietTemplatesData } from '../dietSuggest'

const D = data as DietTemplatesData
const foods = new Map<string, Pick<Food, 'id' | 'name' | 'per100g' | 'swapGroup'>>([...(taco as unknown as Food[]), ...seedFoods].map((f) => [f.id, f]))

describe('dietas prontas: dados', () => {
  it('17 faixas × 3 estilos', () => {
    expect(D.faixas).toHaveLength(17)
    for (const b of D.faixas) expect(b.dietas.map((d) => d.estilo).sort()).toEqual(['pratica', 'proteica', 'tradicional'])
  })
  it('todo alimento tem mapeamento e existe no app', () => {
    for (const b of D.faixas) for (const d of b.dietas) for (const m of d.refeicoes) for (const it of m.itens) {
      const id = DIET_FOOD_MAP[it.alimento]
      expect(id, it.alimento).toBeTruthy()
      expect(foods.get(id)?.per100g.kcal, `${it.alimento} → ${id}`).toBeGreaterThan(0)
    }
  })
  it('as 51 dietas recalculadas ficam a até 8% do kcal do JSON', () => {
    for (const b of D.faixas) for (const d of b.dietas) {
      const m = templateMacros(d, foods, DIET_FOOD_MAP)
      expect(Math.abs(m.kcal - d.kcal) / d.kcal, `${b.id}:${d.estilo} ${Math.round(m.kcal)} × ${d.kcal}`).toBeLessThan(0.08)
    }
  })
})

describe('meta de calorias', () => {
  it('TMB Mifflin-St Jeor (homem e mulher) e TDEE', () => {
    const h = suggestTarget({ sex: 'm', weightKg: 85, heightCm: 180, age: 28, activity: 'moderado', goal: 'maintain' })
    expect(h.bmr).toBe(1840)
    expect(h.tdee).toBe(2852)
    expect(h.kcal).toBe(2852)
    const m = suggestTarget({ sex: 'f', weightKg: 60, heightCm: 162, age: 35, activity: 'leve', goal: 'maintain' })
    expect(Math.abs(m.bmr - 1277)).toBeLessThanOrEqual(1)
  })
  it('ajuste por objetivo: −20%, −25% agressiva, +10%, +15% rápida', () => {
    const b = { sex: 'm' as const, weightKg: 85, heightCm: 180, age: 28, activity: 'moderado' as const }
    expect(suggestTarget({ ...b, goal: 'cut' }).pct).toBe(-0.2)
    const ag = suggestTarget({ ...b, goal: 'cut', aggressive: true })
    expect(ag.pct).toBe(-0.25)
    expect(ag.warnings.length).toBe(1)
    expect(suggestTarget({ ...b, goal: 'bulk' }).pct).toBe(0.1)
    expect(suggestTarget({ ...b, goal: 'bulk', fast: true }).pct).toBe(0.15)
  })
  it('caso 1: homem 28a 180cm 85kg moderado definição → faixa 2.250–2.500', () => {
    const t = suggestTarget({ sex: 'm', weightKg: 85, heightCm: 180, age: 28, activity: 'moderado', goal: 'cut' })
    expect(Math.abs(t.kcal - 2282)).toBeLessThanOrEqual(2)
    expect(recommendedBand(D.faixas, t.kcal).id).toBe('k2250_2500')
  })
  it('caso 2: mulher 35a 162cm 60kg leve definição → faixa 1.250–1.500', () => {
    const t = suggestTarget({ sex: 'f', weightKg: 60, heightCm: 162, age: 35, activity: 'leve', goal: 'cut' })
    expect(Math.abs(t.kcal - 1404)).toBeLessThanOrEqual(2)
    expect(recommendedBand(D.faixas, t.kcal).id).toBe('k1250_1500')
  })
  it('caso 3: mulher 50a 155cm 52kg sedentária, definição agressiva → piso 1.200', () => {
    const t = suggestTarget({ sex: 'f', weightKg: 52, heightCm: 155, age: 50, activity: 'sedentario', goal: 'cut', aggressive: true })
    expect(Math.abs(t.bmr - 1078)).toBeLessThanOrEqual(1)
    expect(Math.abs(t.raw - 970)).toBeLessThanOrEqual(2)
    expect(t.kcal).toBe(1200)
    expect(t.floored).toBe(true)
    // faixa travada nunca é recomendada
    expect(recommendedBand(D.faixas, t.kcal).id).toBe('k1250_1500')
  })
  it('caso 4: homem 22a 190cm 95kg atleta ganho → faixa 4.000–4.500', () => {
    const t = suggestTarget({ sex: 'm', weightKg: 95, heightCm: 190, age: 22, activity: 'atleta', goal: 'bulk' })
    expect(Math.abs(t.bmr - 2033)).toBeLessThanOrEqual(1)
    expect(Math.abs(t.tdee - 3862)).toBeLessThanOrEqual(1)
    expect(Math.abs(t.kcal - 4248)).toBeLessThanOrEqual(2)
    expect(recommendedBand(D.faixas, t.kcal).id).toBe('k4000_4500')
  })
  it('pisos: homem nunca abaixo de 1.500 nem da TMB', () => {
    const t = suggestTarget({ sex: 'm', weightKg: 55, heightCm: 160, age: 45, activity: 'sedentario', goal: 'cut', aggressive: true })
    expect(t.kcal).toBeGreaterThanOrEqual(1500)
    expect(t.kcal).toBeGreaterThanOrEqual(t.bmr)
  })
  it('menor de 18: sem déficit e com aviso', () => {
    const t = suggestTarget({ sex: 'm', weightKg: 70, heightCm: 175, age: 16, activity: 'moderado', goal: 'cut' })
    expect(t.pct).toBe(0)
    expect(t.kcal).toBe(t.tdee)
    expect(t.warnings.join(' ')).toMatch(/menores de 18/)
  })
  it('60+: déficit limitado a 15%', () => {
    const t = suggestTarget({ sex: 'm', weightKg: 90, heightCm: 175, age: 65, activity: 'leve', goal: 'cut', aggressive: true })
    expect(t.pct).toBe(-0.15)
  })
  it('gasto real substitui o estimado', () => {
    const t = suggestTarget({ sex: 'm', weightKg: 85, heightCm: 180, age: 28, activity: 'moderado', goal: 'cut', realTdee: 2700 })
    expect(t.tdeeSource).toBe('real')
    expect(t.kcal).toBe(2160)
  })
})

describe('faixa e ajuste fino', () => {
  it('limites exatos das faixas', () => {
    expect(findBand(D.faixas, 2000).id).toBe('k2000_2250')
    expect(findBand(D.faixas, 2249).id).toBe('k2000_2250')
    expect(findBand(D.faixas, 2250).id).toBe('k2250_2500')
    expect(findBand(D.faixas, 7000).id).toBe('k5500_6000')
    expect(findBand(D.faixas, 1100).id).toBe('k1000_1250')
    expect(recommendedBand(D.faixas, 1100).id).toBe('k1250_1500')
  })
  it('estilo padrão por objetivo', () => {
    expect(defaultStyle('cut')).toBe('proteica')
    expect(defaultStyle('maintain')).toBe('tradicional')
    expect(defaultStyle('bulk')).toBe('tradicional')
  })
  it('todas as dietas ajustadas ficam a ±3% da meta, com proteína entre 1,6 e 2,2 g/kg', () => {
    const cases: [number, number, 'cut' | 'maintain' | 'bulk'][] = []
    for (const b of D.faixas) {
      if (b.max <= 1250) continue
      const mid = Math.round((b.min + b.max) / 2)
      const t = mid + 37
      // pesos coerentes com a faixa (gasto de ~30 a ~48 kcal/kg)
      for (const w of [Math.min(150, Math.max(45, Math.round(t / 48))), Math.min(150, Math.max(45, Math.round(t / 30)))]) for (const g of ['cut', 'maintain', 'bulk'] as const) cases.push([t, w, g])
    }
    for (const [target, w, goal] of cases) {
      const b = findBand(D.faixas, target)
      for (const d of b.dietas) {
        const r = fitTemplate(templateToItems(d, DIET_FOOD_MAP), foods, target, w, goal)
        const tag = `${b.id}:${d.estilo} meta ${target} → ${r.totals.kcal} (${w} kg, ${goal}, P ${r.totals.p})`
        expect(Math.abs(r.totals.kcal - target) / target, tag).toBeLessThanOrEqual(0.03)
        expect(r.totals.p, tag).toBeLessThanOrEqual(Math.ceil(2.2 * w) + 3)
        if (goal === 'cut' && r.proteinAdjusted !== undefined) expect(r.totals.p, tag).toBeGreaterThanOrEqual(Math.floor(1.6 * w) - 3)
        for (const m of r.meals) for (const it of m.items) {
          if (/^ovo/i.test(it.label)) expect(it.grams % 50).toBe(0)
          else if (/azeite|whey|aveia|mel|castanha|pasta de amendoim/i.test(it.label)) expect(it.grams % 5).toBe(0)
          else expect(it.grams % 10).toBe(0)
        }
      }
    }
  })
  it('limite de proteína em alta caloria proteica', () => {
    const b = findBand(D.faixas, 5200)
    const d = b.dietas.find((x) => x.estilo === 'proteica')!
    const r = fitTemplate(templateToItems(d, DIET_FOOD_MAP), foods, 5200, 80, 'bulk')
    expect(r.totals.p).toBeLessThanOrEqual(176 + 3)
    expect(r.proteinAdjusted).toBe('down')
  })
})
