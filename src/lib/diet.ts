import { db, type DietPlan, type DietTargets, type Food, type FoodLog, type Macros, type MealItem, type PlanMeal, type PlannedDay, type Recipe } from '../db/schema'
import { mine, save } from '../db/repo'
import { currentUserId } from '../store/session'
import { add, macrosFor, ZERO } from '../domain/nutrition'
import { templateDefinicao2300 } from '../db/seed-nutrition'
import { localDate, routineForDay, planWeek } from '../domain/plan'
import { getProfile } from './plan'
import { cycleTargets } from '../domain/diet'

export type FoodLike = Pick<Food, 'id' | 'name' | 'per100g' | 'swapGroup' | 'state' | 'yieldFactor' | 'section'> & { rawId?: string; isRecipe?: boolean; user_id?: string | null; category?: string }

/** Todos os alimentos visíveis para o usuário (base + próprios + receitas como alimentos). */
export async function foodsMap(): Promise<Map<string, FoodLike>> {
  const uid = currentUserId()
  const foods = (await db.foods.toArray()).filter((f) => !f.deleted_at && (f.user_id === null || f.user_id === uid))
  const recipes = mine(await db.recipes.toArray()) as Recipe[]
  const m = new Map<string, FoodLike>(foods.map((f) => [f.id, f]))
  for (const r of recipes) {
    const tot = r.ingredients.reduce((acc, it) => {
      const f = it.foodId ? m.get(it.foodId) : undefined
      return f ? add(acc, macrosFor(f, it.grams)) : acc
    }, ZERO)
    const k = r.cookedWeightG > 0 ? 100 / r.cookedWeightG : 0
    m.set(r.id, { id: r.id, name: r.name, per100g: { kcal: tot.kcal * k, p: tot.p * k, c: tot.c * k, f: tot.f * k }, state: 'na', section: 'mercearia', isRecipe: true, user_id: uid })
  }
  return m
}

export const itemKey = (it: MealItem) => it.foodId ?? it.recipeId ?? ''

export function mealMacros(items: MealItem[], foods: Map<string, FoodLike>): Macros {
  return items.reduce((acc, it) => {
    const f = foods.get(itemKey(it))
    return f ? add(acc, macrosFor(f, it.grams)) : acc
  }, ZERO)
}

export async function latestTargets(date = localDate()): Promise<DietTargets | undefined> {
  return (mine(await db.dietTargets.toArray()) as DietTargets[]).filter((t) => t.validFrom <= date).sort((a, b) => b.validFrom.localeCompare(a.validFrom) || b.version - a.version)[0]
}

/** É dia de treino? (rotina no plano para o dia da semana) */
export async function isTrainingDay(date: string) {
  const p = await getProfile()
  const plan = p?.settings.activePlan
  if (!plan) return false
  const routines = mine(await db.routines.toArray())
  const d = new Date(date + 'T12:00')
  const r = routineForDay(routines, d.getDay(), Math.max(1, planWeek(plan.startDate, d)))
  return !!r && r.items.some((i) => (i.minutes ?? 0) === 0)
}

export async function targetsFor(date: string): Promise<{ targets: Macros; kind: 'base' | 'treino' | 'descanso'; t?: DietTargets }> {
  const t = await latestTargets(date)
  if (!t) return { targets: { kcal: 0, p: 0, c: 0, f: 0 }, kind: 'base' }
  if (t.cycle) {
    const training = await isTrainingDay(date)
    const p = await getProfile()
    const cyc = t.trainingDay && t.restDay ? { training: t.trainingDay, rest: t.restDay } : cycleTargets(t.base, Number(p?.settings.trainingDays ?? 5))
    return { targets: training ? cyc.training : cyc.rest, kind: training ? 'treino' : 'descanso', t }
  }
  return { targets: t.base, kind: 'base', t }
}

export async function currentPlan(date = localDate()): Promise<DietPlan | undefined> {
  return (mine(await db.dietPlans.toArray()) as DietPlan[]).filter((p) => p.validFrom <= date).sort((a, b) => b.validFrom.localeCompare(a.validFrom) || b.version - a.version)[0]
}

/** Refeições planejadas do dia: dia planejado específico, senão o plano-modelo. */
export async function plannedMeals(date: string): Promise<{ meals: PlanMeal[]; planned?: PlannedDay; plan?: DietPlan }> {
  const pd = (mine(await db.plannedDays.where('date').equals(date).toArray()) as PlannedDay[]).at(-1)
  if (pd) return { meals: pd.meals, planned: pd }
  const plan = await currentPlan(date)
  return { meals: plan?.meals ?? [], plan }
}

export async function dayLogs(date: string): Promise<FoodLog[]> {
  return mine(await db.foodLogs.where('date').equals(date).toArray()) as FoodLog[]
}

export async function logFood(date: string, mealName: string, item: MealItem, foods: Map<string, FoodLike>, planned = false, time?: string) {
  const f = foods.get(itemKey(item))
  const macros = f ? macrosFor(f, item.grams) : ZERO
  return save('foodLogs', { date, mealName, time, foodId: f?.isRecipe ? undefined : item.foodId, recipeId: f?.isRecipe ? itemKey(item) : item.recipeId, grams: item.grams, macros, planned } as unknown as FoodLog)
}

export async function updateLogGrams(log: FoodLog, grams: number, foods: Map<string, FoodLike>) {
  const f = foods.get(log.foodId ?? log.recipeId ?? '')
  return save('foodLogs', { ...log, grams, macros: f ? macrosFor(f, grams) : log.macros, planned: false })
}

export function sumLogs(logs: FoodLog[]): Macros {
  return logs.reduce((a, l) => add(a, l.macros), ZERO)
}

export async function ensureTemplatePlan() {
  const exists = await currentPlan()
  if (exists) return exists
  return saveDietPlan(templateDefinicao2300.name, templateDefinicao2300.meals)
}

export async function saveDietPlan(name: string, meals: PlanMeal[]) {
  const prev = await currentPlan()
  return save('dietPlans', { version: (prev?.version ?? 0) + 1, name, validFrom: localDate(), meals } as unknown as DietPlan)
}

/** Aplica o plano aos próximos N dias (cada dia vira editável individualmente). */
export async function applyPlanToDays(plan: DietPlan, days: number) {
  const existing = mine(await db.plannedDays.toArray()) as PlannedDay[]
  for (let i = 0; i < days; i++) {
    const d = new Date()
    d.setDate(d.getDate() + i)
    const date = localDate(d)
    const cur = existing.find((x) => x.date === date)
    await save('plannedDays', { ...(cur ?? {}), date, meals: structuredClone(plan.meals), fromPlanId: plan.id } as unknown as PlannedDay)
  }
}

export async function waterToday(date = localDate()) {
  return (mine(await db.water.where('date').equals(date).toArray()) as { ml: number }[]).reduce((a, w) => a + w.ml, 0)
}
