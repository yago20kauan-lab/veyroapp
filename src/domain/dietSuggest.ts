/**
 * Dietas prontas: meta de calorias com pisos de segurança, escolha da faixa e ajuste fino das porções.
 * Lógica pura (sem IA, sem rede).
 */
import type { Food, Macros, PlanMeal } from '../db/schema'
import { ACTIVITY, type Activity, type Goal, type Sex } from './diet'
import { kcalFromMacros, macrosFor } from './nutrition'

export type DietStyle = 'tradicional' | 'proteica' | 'pratica'
export type TemplateItem = { alimento: string; g?: number; ml?: number }
export type TemplateMeal = { nome: string; itens: TemplateItem[] }
export type DietTemplate = { estilo: DietStyle; kcal: number; p: number; c: number; g: number; refeicoes: TemplateMeal[] }
export type DietBand = { id: string; min: number; max: number; dietas: DietTemplate[] }
export type DietTemplatesData = { versao: number; faixas: DietBand[] }

export const STYLE_LABEL: Record<DietStyle, string> = {
  tradicional: 'Tradicional brasileira',
  proteica: 'Alta proteína / menos carbo',
  pratica: 'Prática / flexível',
}
export const STYLE_IDEA: Record<DietStyle, string> = {
  tradicional: 'Arroz, feijão, carne, pão e fruta',
  proteica: 'Ovos, carnes, peixe, gordura boa e pouco amido',
  pratica: 'Whey, wrap, tapioca e lanches rápidos',
}

/** Faixas abaixo disso só com escolha manual e aviso. */
export const LOCK_BELOW = 1250
export const SEX_FLOOR: Record<Sex, number> = { m: 1500, f: 1200 }
export const WARN_LOW = 'Dietas abaixo de 1.200 kcal devem ser feitas só com acompanhamento de médico ou nutricionista.'
export const WARN_MINOR = 'Para menores de 18 anos não sugerimos déficit calórico. Procure um nutricionista ou médico para acompanhar.'
export const WARN_SENIOR = 'Com 60 anos ou mais, o déficit fica limitado a 15%.'
export const WARN_AGGRESSIVE = 'Déficit de 25% é agressivo: pode aumentar a fome e a perda de massa muscular. Use por pouco tempo.'
export const DISCLAIMER = 'Sugestão automática baseada em fórmulas. Não substitui um nutricionista. Valores aproximados (tabela TACO), podendo variar ±5%.'

export function bandLevel(min: number) {
  if (min < LOCK_BELOW) return 'Restrita'
  if (min < 1750) return 'Baixa'
  if (min < 2500) return 'Moderada'
  if (min < 3250) return 'Alta'
  if (min < 4000) return 'Muito alta'
  if (min < 5000) return 'Atleta'
  return 'Alto volume'
}

export type TargetInput = {
  sex: Sex
  weightKg: number
  heightCm: number
  age: number
  activity: Activity
  goal: Goal
  /** definição −25% em vez de −20% */
  aggressive?: boolean
  /** ganho +15% em vez de +10% */
  fast?: boolean
  /** gasto real (calorias adaptativas), se já existir */
  realTdee?: number
}

export type TargetResult = {
  bmr: number
  factor: number
  tdee: number
  tdeeSource: 'estimado' | 'real'
  pct: number
  /** meta antes dos pisos */
  raw: number
  kcal: number
  floored: boolean
  warnings: string[]
  explanation: string
}

const exactBmr = (sex: Sex, w: number, h: number, a: number) => 10 * w + 6.25 * h - 5 * a + (sex === 'm' ? 5 : -161)
const fmt = (n: number) => Math.round(n).toLocaleString('pt-BR')
const fmtF = (n: number) => String(n).replace('.', ',')

export function suggestTarget(i: TargetInput): TargetResult {
  const bmrX = exactBmr(i.sex, i.weightKg, i.heightCm, i.age)
  const factor = ACTIVITY[i.activity].f
  const tdeeX = i.realTdee ?? bmrX * factor
  const warnings: string[] = []
  let pct = i.goal === 'cut' ? (i.aggressive ? -0.25 : -0.2) : i.goal === 'bulk' ? (i.fast ? 0.15 : 0.1) : 0
  if (i.age < 18 && pct < 0) {
    pct = 0
    warnings.push(WARN_MINOR)
  } else if (i.age < 18) warnings.push(WARN_MINOR)
  if (i.age >= 60 && pct < -0.15) {
    pct = -0.15
    warnings.push(WARN_SENIOR)
  }
  if (i.goal === 'cut' && i.aggressive && pct === -0.25) warnings.push(WARN_AGGRESSIVE)
  const raw = Math.round(tdeeX * (1 + pct))
  const floor = Math.max(SEX_FLOOR[i.sex], Math.round(bmrX))
  const kcal = Math.max(raw, floor)
  const floored = kcal > raw
  const goalTxt = pct < 0 ? ` − ${Math.round(-pct * 100)}% de definição` : pct > 0 ? ` + ${Math.round(pct * 100)}% para ganhar massa` : ' (manutenção)'
  const base = i.realTdee ? `Gasto real ${fmt(tdeeX)}` : `TMB ${fmt(bmrX)} × atividade ${fmtF(factor)}`
  const explanation = `${base}${goalTxt}${floored ? ` · ajustado para o mínimo seguro de ${fmt(floor)} kcal` : ''}`
  return { bmr: Math.round(bmrX), factor, tdee: Math.round(tdeeX), tdeeSource: i.realTdee ? 'real' : 'estimado', pct, raw, kcal, floored, warnings, explanation }
}

/** Faixa em que min ≤ kcal < max (acima de 6.000, a última; abaixo de 800, a primeira). */
export function findBand(bands: DietBand[], kcal: number): DietBand {
  const sorted = [...bands].sort((a, b) => a.min - b.min)
  if (kcal >= sorted.at(-1)!.max) return sorted.at(-1)!
  return sorted.find((b) => b.min <= kcal && kcal < b.max) ?? sorted[0]
}

/** Faixa recomendada: nunca uma faixa travada (abaixo de 1.250). */
export function recommendedBand(bands: DietBand[], kcal: number): DietBand {
  const b = findBand(bands, kcal)
  if (b.max <= LOCK_BELOW) return findBand(bands, LOCK_BELOW)
  return b
}

export const defaultStyle = (goal: Goal): DietStyle => (goal === 'cut' ? 'proteica' : 'tradicional')

/* ---------------------------------------------------------------- ajuste fino */

type F = Pick<Food, 'id' | 'name' | 'per100g' | 'swapGroup'>
export type FitItem = { foodId: string; grams: number; label: string }
export type FitMeal = { name: string; items: FitItem[] }
export type FitResult = { meals: FitMeal[]; totals: Macros; kcalTarget: number; proteinAdjusted?: 'down' | 'up' }

const STEP5 = /azeite|pasta de amendoim|whey|mel|aveia|castanha/i
const isEgg = (label: string) => /^ovo/i.test(label)
const stepFor = (label: string) => (isEgg(label) ? 50 : STEP5.test(label) ? 5 : 10)
const roundTo = (g: number, step: number) => Math.max(step, Math.round(g / step) * step)

const isFixed = (f?: F) => f?.swapGroup === 'veg'
const isProtein = (f?: F) => f?.swapGroup === 'protein'
/** fontes de carboidrato para compensar calorias: amidos, pães, aveia, mel e banana (outras frutas não) */
const isCarb = (f?: F) => f?.swapGroup === 'carb' || f?.swapGroup === 'bread' || (f?.swapGroup === 'fruit' && /banana/i.test(f.name))

function totalsOf(meals: FitMeal[], foods: Map<string, F>): Macros {
  const t = { kcal: 0, p: 0, c: 0, f: 0 }
  for (const m of meals)
    for (const it of m.items) {
      const f = foods.get(it.foodId)
      if (!f) continue
      const x = macrosFor(f, it.grams)
      t.kcal += x.kcal
      t.p += x.p
      t.c += x.c
      t.f += x.f
    }
  return t
}

function scaleWhere(meals: FitMeal[], foods: Map<string, F>, pick: (f?: F) => boolean, factor: number): FitMeal[] {
  return meals.map((m) => ({ ...m, items: m.items.map((it) => (pick(foods.get(it.foodId)) ? { ...it, grams: it.grams * factor } : it)) }))
}

function kcalWhere(meals: FitMeal[], foods: Map<string, F>, pick: (f?: F) => boolean, key: keyof Macros = 'kcal') {
  let s = 0
  for (const m of meals) for (const it of m.items) {
    const f = foods.get(it.foodId)
    if (f && pick(f)) s += macrosFor(f, it.grams)[key] ?? 0
  }
  return s
}

const roundMeals = (meals: FitMeal[]): FitMeal[] => meals.map((m) => ({ ...m, items: m.items.map((it) => ({ ...it, grams: roundTo(it.grams, stepFor(it.label)) })) }))

/** Converte a dieta do JSON em itens do app (ml → g). */
export function templateToItems(t: DietTemplate, map: Record<string, string>, mlToG = 1.03): FitMeal[] {
  return t.refeicoes.map((m) => ({
    name: m.nome,
    items: m.itens.map((it) => {
      const id = map[it.alimento]
      if (!id) throw new Error(`Alimento sem mapeamento: ${it.alimento}`)
      return { foodId: id, label: it.alimento, grams: it.g ?? Math.round((it.ml ?? 0) * mlToG) }
    }),
  }))
}

/**
 * Escala as porções para a meta exata (salada e legumes não escalam), aplica os limites de proteína
 * (≤ 2,2 g/kg; ≥ 1,6 g/kg em definição) compensando com carboidrato, e arredonda.
 */
export function fitTemplate(base: FitMeal[], foodsIn: Map<string, F>, target: number, weightKg: number, goal: Goal): FitResult {
  // as metas viram os totais em macros, então as calorias aqui são sempre 4/4/9 (batem com os macros)
  const foods = new Map<string, F>([...foodsIn].map(([id, f]) => [id, { ...f, per100g: { ...f.per100g, kcal: f.per100g.p * 4 + f.per100g.c * 4 + f.per100g.f * 9 } }]))
  let meals = base.map((m) => ({ ...m, items: m.items.map((it) => ({ ...it })) }))
  const fixed = kcalWhere(meals, foods, isFixed)
  const scal = kcalWhere(meals, foods, (f) => !isFixed(f))
  if (scal > 0) meals = scaleWhere(meals, foods, (f) => !isFixed(f), Math.max(0.2, (target - fixed) / scal))

  let proteinAdjusted: FitResult['proteinAdjusted']
  const pMax = 2.2 * weightKg
  const pMin = goal === 'cut' ? 1.6 * weightKg : 0
  const isPSource = (f?: F) => isProtein(f) || f?.swapGroup === 'dairy'
  const isFat = (f?: F) => f?.swapGroup === 'fat'
  for (let pass = 0; pass < 8; pass++) {
    // 1) proteína dentro de 1,6–2,2 g/kg (o limite mínimo só em definição)
    const t = totalsOf(meals, foods)
    if (t.p > pMax + 0.5 || t.p < pMin - 0.5) {
      const goalP = t.p > pMax ? pMax : pMin
      const pSrc = kcalWhere(meals, foods, isPSource, 'p')
      if (pSrc > 0) {
        meals = scaleWhere(meals, foods, isPSource, Math.max(0.1, Math.min(3, (pSrc - (t.p - goalP)) / pSrc)))
        proteinAdjusted = t.p > pMax ? 'down' : 'up'
      }
    }
    // 2) calorias de volta na meta pelo carboidrato (arroz, aveia, banana, pão…); se não bastar, pela gordura
    const t2 = totalsOf(meals, foods)
    const carbK = kcalWhere(meals, foods, isCarb)
    let gap = target - t2.kcal
    if (carbK > 0) {
      const k = Math.max(0.2, Math.min(3, (carbK + gap) / carbK))
      meals = scaleWhere(meals, foods, isCarb, k)
      gap -= carbK * (k - 1)
    }
    const fatK = kcalWhere(meals, foods, isFat)
    if (Math.abs(gap) > target * 0.01 && fatK > 0) meals = scaleWhere(meals, foods, isFat, Math.max(0.3, Math.min(3, (fatK + gap) / fatK)))
  }
  meals = roundMeals(meals)
  // o arredondamento (ovo de 50 em 50 g etc.) desloca um pouco: corrige passo a passo (calorias e limites de proteína)
  const score = (kcal: number, p: number) => Math.abs(target - kcal) + 8 * Math.max(0, p - pMax) + 8 * Math.max(0, pMin - p)
  for (let n = 0; n < 200; n++) {
    const t = totalsOf(meals, foods)
    const cur = score(t.kcal, t.p)
    if (Math.abs(target - t.kcal) <= target * 0.01 && cur - Math.abs(target - t.kcal) < 1) break
    let best: { mi: number; ii: number; d: number; sc: number } | null = null
    meals.forEach((m, mi) => m.items.forEach((it, ii) => {
      const f = foods.get(it.foodId)
      if (!f || isFixed(f)) return
      const step = stepFor(it.label)
      for (const d of [step, -step]) {
        if (it.grams + d < step) continue
        const x = macrosFor(f, d)
        const sc = score(t.kcal + x.kcal, t.p + x.p) + (isProtein(f) ? 2 : 0)
        if (!best || sc < best.sc) best = { mi, ii, d, sc }
      }
    }))
    const bb = best as { mi: number; ii: number; d: number; sc: number } | null
    if (!bb || bb.sc >= cur) break
    meals[bb.mi].items[bb.ii] = { ...meals[bb.mi].items[bb.ii], grams: meals[bb.mi].items[bb.ii].grams + bb.d }
  }
  const tt = totalsOf(meals, foods)
  const totals = { p: Math.round(tt.p), c: Math.round(tt.c), f: Math.round(tt.f), kcal: 0 }
  totals.kcal = kcalFromMacros(totals.p, totals.c, totals.f)
  return { meals, totals, kcalTarget: target, proteinAdjusted }
}

const MEAL_TIME: Record<string, string> = { 'Café da manhã': '07:30', Almoço: '12:30', Lanche: '16:00', 'Pré-treino': '18:30', Jantar: '20:30', Ceia: '22:30' }

export function toPlanMeals(meals: FitMeal[]): PlanMeal[] {
  return meals.map((m) => ({ name: m.name, time: MEAL_TIME[m.name] ?? '', items: m.items.map((it) => ({ foodId: it.foodId, grams: it.grams })) }))
}

/** Macros do JSON recalculados com os alimentos mapeados (para o teste de coerência). */
export function templateMacros(t: DietTemplate, foods: Map<string, F>, map: Record<string, string>): Macros {
  return totalsOf(templateToItems(t, map), foods)
}
