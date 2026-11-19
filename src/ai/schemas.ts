/** Validação das respostas da IA (nunca aplicar nada sem passar por aqui). */
import { z } from 'zod'

const item = z.object({
  exerciseId: z.string(),
  sets: z.number().int().min(1).max(6),
  repMin: z.number().int().min(1).max(30),
  repMax: z.number().int().min(1).max(30),
  restSec: z.number().int().min(0).max(300),
})

export const BuildSchema = z.object({
  name: z.string().min(1).max(60),
  notes: z.string().max(600).optional().default(''),
  routines: z.array(z.object({ name: z.string().min(1).max(40), weekday: z.number().int().min(0).max(6), items: z.array(item).min(1).max(12) })).min(1).max(7),
})
export const AdaptSchema = z.object({ notes: z.string().max(600).optional().default(''), items: z.array(item).min(1).max(12) })
export const WeeklySchema = z.object({ good: z.string().max(400), stuck: z.string().max(400), adjust: z.string().max(400) })
export const AskSchema = z.object({ answer: z.string().max(1200) })

export type BuildResult = z.infer<typeof BuildSchema>
export type AdaptResult = z.infer<typeof AdaptSchema>

/** Rejeita exercício fora da biblioteca e corrige repMin > repMax. */
export function validateItems<T extends { exerciseId: string; repMin: number; repMax: number }>(items: T[], library: Set<string>): T[] {
  const bad = items.filter((i) => !library.has(i.exerciseId))
  if (bad.length) throw new Error(`A IA sugeriu exercício fora da biblioteca: ${bad.map((b) => b.exerciseId).join(', ')}`)
  return items.map((i) => (i.repMin > i.repMax ? { ...i, repMin: i.repMax, repMax: i.repMin } : i))
}

export function parseBuild(raw: unknown, library: Set<string>): BuildResult {
  const r = BuildSchema.parse(raw)
  return { ...r, routines: r.routines.map((rt) => ({ ...rt, items: validateItems(rt.items, library) })) }
}

export function parseAdapt(raw: unknown, library: Set<string>): AdaptResult {
  const r = AdaptSchema.parse(raw)
  return { ...r, items: validateItems(r.items, library) }
}

/** Piso de segurança para qualquer sugestão de calorias. */
export function safeKcal(kcal: number, sex: 'm' | 'f' = 'm') {
  return Math.max(sex === 'f' ? 1300 : 1600, Math.round(kcal))
}
