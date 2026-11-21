import { db, type BodyWeight, type DietTargets, type FoodLog, type Profile } from '../db/schema'
import { mine, save } from '../db/repo'
import { DIET_FOOD_MAP, ML_TO_G } from '../db/dietFoodMap'
import { adaptiveTdee } from '../domain/foodlogic'
import { age as ageOf, cycleTargets, type Activity, type Goal } from '../domain/diet'
import { localDate } from '../domain/plan'
import {
  defaultStyle, fitTemplate, recommendedBand, suggestTarget, templateToItems, toPlanMeals,
  type DietBand, type DietStyle, type DietTemplatesData, type FitResult, type TargetResult,
} from '../domain/dietSuggest'
import { foodsMap, latestTargets, saveDietPlan } from './diet'
import { getProfile } from './plan'

let cache: DietTemplatesData | null = null
export async function loadTemplates(): Promise<DietTemplatesData> {
  if (!cache) cache = (await import('../db/dietTemplates.json')).default as DietTemplatesData
  return cache
}

/** Gasto real (calorias adaptativas) das últimas 4 semanas, se já houver dados suficientes. */
export async function adaptiveForUser(previous?: number) {
  const from = localDate(new Date(Date.now() - 28 * 86400000))
  const logs = mine(await db.foodLogs.where('date').aboveOrEqual(from).toArray()) as FoodLog[]
  const ws = mine(await db.bodyWeights.where('date').aboveOrEqual(from).toArray()) as BodyWeight[]
  const byDay = new Map<string, { intakeKcal?: number; weightKg?: number }>()
  for (const l of logs) byDay.set(l.date, { ...byDay.get(l.date), intakeKcal: (byDay.get(l.date)?.intakeKcal ?? 0) + l.macros.kcal })
  for (const w of ws) byDay.set(w.date, { ...byDay.get(w.date), weightKg: w.kg })
  return adaptiveTdee([...byDay.entries()].map(([date, v]) => ({ date, ...v })), previous)
}

export type DietSettings = {
  diet_template_id?: string
  diet_target_kcal?: number
  diet_activity_level?: Activity
  diet_suggested_at?: string
  diet_weight_kg?: number
  diet_goal?: Goal
}

export type UserDietCtx = {
  profile?: Profile
  weightKg?: number
  age?: number
  activity: Activity
  goal: Goal
  realTdee?: number
  missing: string[]
}

export async function userDietContext(): Promise<UserDietCtx> {
  const profile = await getProfile()
  const weightKg = (mine(await db.bodyWeights.orderBy('date').toArray()) as BodyWeight[]).at(-1)?.kg
  const t = await latestTargets()
  const adaptive = await adaptiveForUser(t?.tdeeEstimate)
  const missing: string[] = []
  if (!profile?.sex) missing.push('sexo')
  if (!profile?.heightCm) missing.push('altura')
  if (!profile?.birthDate) missing.push('data de nascimento')
  if (!weightKg) missing.push('peso')
  return {
    profile,
    weightKg,
    age: profile?.birthDate ? ageOf(profile.birthDate) : undefined,
    activity: (profile?.settings.activity as Activity) ?? 'moderado',
    goal: profile?.goal ?? 'cut',
    realTdee: adaptive.ok ? adaptive.tdee : undefined,
    missing,
  }
}

export type StyleFit = { style: DietStyle; fit: FitResult; templateKcal: number }
export type Suggestion = { target: TargetResult; band: DietBand; recommended: DietBand; manual: boolean; fitKcal: number; styles: StyleFit[]; defaultStyle: DietStyle }

/** Monta a sugestão: meta, faixa (recomendada ou escolhida) e os 3 estilos já ajustados. */
export async function buildSuggestion(
  ctx: { sex: 'm' | 'f'; weightKg: number; heightCm: number; age: number; activity: Activity; goal: Goal; realTdee?: number },
  opts: { aggressive?: boolean; fast?: boolean; bandId?: string } = {},
): Promise<Suggestion> {
  const data = await loadTemplates()
  const foods = await foodsMap()
  const target = suggestTarget({ ...ctx, aggressive: opts.aggressive, fast: opts.fast })
  const recommended = recommendedBand(data.faixas, target.kcal)
  const chosen = opts.bandId ? data.faixas.find((b) => b.id === opts.bandId) ?? recommended : recommended
  const manual = chosen.id !== recommended.id
  // na faixa recomendada, ajusta à meta exata (dentro da faixa); em outra faixa, ao meio dela
  const fitKcal = manual ? Math.round((chosen.min + chosen.max) / 2) : target.kcal
  const styles = chosen.dietas.map((d) => ({
    style: d.estilo,
    templateKcal: d.kcal,
    fit: fitTemplate(templateToItems(d, DIET_FOOD_MAP, ML_TO_G), foods, fitKcal, ctx.weightKg, ctx.goal),
  }))
  return { target, band: chosen, recommended, manual, fitKcal, styles, defaultStyle: defaultStyle(ctx.goal) }
}

/** Aplica como nova versão do plano alimentar e das metas (o histórico continua). */
export async function applySuggestion(s: Suggestion, style: DietStyle, ctx: { weightKg: number; activity: Activity; goal: Goal }) {
  const st = s.styles.find((x) => x.style === style)!
  const names = { tradicional: 'Tradicional', proteica: 'Alta proteína', pratica: 'Prática' }
  await saveDietPlan(`${names[style]} ${st.fit.totals.kcal.toLocaleString('pt-BR')} kcal`, toPlanMeals(st.fit.meals))
  const cur = await latestTargets()
  const p = await getProfile()
  const base = st.fit.totals
  const cyc = cycleTargets(base, Number(p?.settings.trainingDays ?? 5))
  await save('dietTargets', {
    version: (cur?.version ?? 0) + 1,
    base,
    mode: 'grams',
    cycle: cur?.cycle ?? false,
    trainingDay: cyc.training,
    restDay: cyc.rest,
    waterMl: cur?.waterMl ?? Math.round((ctx.weightKg * 35) / 250) * 250,
    redAt: cur?.redAt ?? 1.1,
    validFrom: localDate(),
    rateKgWeek: cur?.rateKgWeek,
    tdeeEstimate: cur?.tdeeEstimate,
  } as unknown as DietTargets)
  if (p) {
    const extra: DietSettings = {
      diet_template_id: `${s.band.id}:${style}`,
      diet_target_kcal: s.target.kcal,
      diet_activity_level: ctx.activity,
      diet_suggested_at: new Date().toISOString(),
      diet_weight_kg: ctx.weightKg,
      diet_goal: ctx.goal,
    }
    await save('profiles', { ...p, goal: ctx.goal, settings: { ...p.settings, ...extra } })
  }
}

/** Aviso de recalcular: peso ±3 kg desde a última sugestão ou objetivo diferente. */
export async function recalcNotice(): Promise<{ kcal: number } | null> {
  const ctx = await userDietContext()
  const s = (ctx.profile?.settings ?? {}) as DietSettings
  if (!s.diet_target_kcal || !ctx.profile?.sex || !ctx.profile.heightCm || !ctx.weightKg || ctx.age == null) return null
  const weightMoved = s.diet_weight_kg != null && Math.abs(ctx.weightKg - s.diet_weight_kg) >= 3
  const goalChanged = s.diet_goal != null && s.diet_goal !== ctx.goal
  if (!weightMoved && !goalChanged) return null
  const t = suggestTarget({ sex: ctx.profile.sex, weightKg: ctx.weightKg, heightCm: ctx.profile.heightCm, age: ctx.age, activity: s.diet_activity_level ?? ctx.activity, goal: ctx.goal, realTdee: ctx.realTdee })
  if (Math.abs(t.kcal - s.diet_target_kcal) < 50) return null
  return { kcal: t.kcal }
}
